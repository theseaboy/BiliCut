/**
 * BiliCut Backend Server
 * 
 * Capabilities:
 * 1. Support for Bilibili AND YouTube.
 * 2. Bilibili: Proxies official subtitles or downloads audio for Gemini ASR.
 * 3. YouTube: Fetches transcripts via scraper or downloads audio for Gemini ASR (NotebookLLM style).
 * 
 * Usage:
 * 1. Install: npm install express cors node-fetch @google/genai dotenv ytdl-core youtube-transcript
 * 2. Set Env: export API_KEY=your_key
 * 3. Run: node server.js
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const ytdl = require('ytdl-core');
const { YoutubeTranscript } = require('youtube-transcript');

// Fix for ESM-only node-fetch in CommonJS
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = 3000;

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

app.use(cors());
app.use(express.json());

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Detect Platform
function detectPlatform(url) {
  if (url.includes('bilibili.com') || url.startsWith('BV')) return 'bilibili';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return 'unknown';
}

// Extract ID based on platform
function extractId(url, platform) {
  if (platform === 'bilibili') {
    const match = url.match(/(BV[a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }
  if (platform === 'youtube') {
    return ytdl.getVideoID(url);
  }
  return null;
}

// ------------------------------------------------------------------
// Shared Logic: Gemini Audio Transcription
// ------------------------------------------------------------------

async function transcribeAudioWithGemini(audioBuffer) {
  console.log("Starting Gemini 1.5 Flash Transcription...");
  const model = "gemini-1.5-flash";
  const prompt = `
    You are a professional transcriber. 
    Listen to the provided audio from a video.
    Generate a strictly formatted JSON transcript.
    
    Requirements:
    1. Output must be a JSON object with a key "transcript".
    2. "transcript" is an array of objects.
    3. Each object must have:
       - "startTime": number (start time in seconds, precise to 1 decimal)
       - "text": string (the transcribed text)
    4. Segment the text naturally by sentence or roughly every 5-15 seconds.
    5. Do not include markdown formatting. Return raw JSON only.
  `;

  const base64Audio = Buffer.from(audioBuffer).toString('base64');

  try {
    const result = await ai.models.generateContent({
        model: model,
        contents: {
            parts: [
                { inlineData: { mimeType: "audio/mp3", data: base64Audio } },
                { text: prompt }
            ]
        },
        config: {
            responseMimeType: "application/json"
        }
    });

    const text = result.response.text();
    const json = JSON.parse(text);
    
    return json.transcript.map((item, index) => ({
        id: `ai-t${index}`,
        startTime: item.startTime,
        text: item.text,
        timestamp: formatTime(item.startTime)
    }));

  } catch (error) {
    console.error("Gemini Transcription Failed:", error);
    throw new Error("AI Transcription failed");
  }
}

// ------------------------------------------------------------------
// Platform Specific Logic
// ------------------------------------------------------------------

// --- BILIBILI LOGIC ---
async function handleBilibili(bvid, res) {
    // 1. Get Metadata
    const viewResponse = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
    const viewJson = await viewResponse.json();
    if (viewJson.code !== 0) throw new Error(`Bilibili API Error: ${viewJson.message}`);
    
    const videoData = viewJson.data;
    const cid = videoData.cid;

    let transcript = [];
    let source = 'none';

    // 2. Try Official Subtitles
    const playerResponse = await fetch(`https://api.bilibili.com/x/player/v2?bvid=${bvid}&cid=${cid}`);
    const playerJson = await playerResponse.json();

    if (playerJson.data?.subtitle?.subtitles?.length > 0) {
      const subUrl = playerJson.data.subtitle.subtitles[0].subtitle_url;
      const secureUrl = subUrl.startsWith('//') ? `https:${subUrl}` : subUrl;
      const subRes = await fetch(secureUrl);
      const subData = await subRes.json();
      
      transcript = subData.body.map((item, index) => ({
        id: `t${index}`,
        startTime: item.from,
        text: item.content,
        timestamp: formatTime(item.from)
      }));
      source = 'official';
    } 
    // 3. Fallback: Download Audio & Transcribe
    else {
        try {
            const apiUrl = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&fnval=16`;
            const playRes = await fetch(apiUrl);
            const playJson = await playRes.json();
            if (!playJson.data.dash) throw new Error("No DASH audio");
            
            const audioUrl = playJson.data.dash.audio[0].baseUrl || playJson.data.dash.audio[0].backup_url[0];
            
            const audioRes = await fetch(audioUrl, {
                headers: { 'Referer': 'https://www.bilibili.com', 'User-Agent': 'Mozilla/5.0' }
            });
            const audioBuffer = await audioRes.arrayBuffer();

            // Safety clip for demo (Gemini REST limit)
            const bufferToUse = audioBuffer.byteLength > 20 * 1024 * 1024 ? audioBuffer.slice(0, 20 * 1024 * 1024) : audioBuffer;
            
            transcript = await transcribeAudioWithGemini(bufferToUse);
            source = 'ai_transcription';
        } catch (err) {
            console.error("Bili Audio fallback failed:", err);
        }
    }

    res.json({
      platform: 'bilibili',
      bvid: videoData.bvid,
      title: videoData.title,
      author: videoData.owner.name,
      category: videoData.tname,
      duration: videoData.duration,
      thumbnail: videoData.pic,
      description: videoData.desc,
      transcript: transcript,
      subtitleSource: source
    });
}

// --- YOUTUBE LOGIC ---
async function handleYoutube(videoId, res) {
    console.log(`Processing YouTube ID: ${videoId}`);

    // 1. Get Metadata using ytdl-core
    const info = await ytdl.getInfo(videoId);
    const videoDetails = info.videoDetails;

    let transcript = [];
    let source = 'none';

    // 2. Try fetching transcript (official or auto-generated)
    try {
        console.log("Attempting to fetch YouTube transcript...");
        const ytTranscript = await YoutubeTranscript.fetchTranscript(videoId);
        
        transcript = ytTranscript.map((item, index) => ({
            id: `yt-t${index}`,
            startTime: item.offset / 1000, // library returns ms
            text: item.text,
            timestamp: formatTime(item.offset / 1000)
        }));
        source = 'official'; // YoutubeTranscript fetches what's available (CC or Auto)
        console.log("YouTube transcript found.");
    } catch (e) {
        console.log("No text transcript found via scraper. Falling back to Audio Download + Gemini ASR...");
        
        // 3. Fallback: Download Audio & Transcribe (NotebookLLM style)
        try {
            // Get audio stream
            // Note: In production, use a dedicated proxy or robust downloader. 
            // ytdl-core can be flaky with IP blocks.
            const audioStream = ytdl(videoId, { 
                quality: 'lowestaudio', 
                filter: 'audioonly' 
            });

            // Stream to buffer
            const chunks = [];
            for await (const chunk of audioStream) {
                chunks.push(chunk);
            }
            const audioBuffer = Buffer.concat(chunks);
            
            console.log(`YouTube Audio Downloaded: ${(audioBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);

            // Clip for demo limits
            const bufferToUse = audioBuffer.byteLength > 20 * 1024 * 1024 ? audioBuffer.slice(0, 20 * 1024 * 1024) : audioBuffer;

            transcript = await transcribeAudioWithGemini(bufferToUse);
            source = 'ai_transcription';

        } catch (audioErr) {
            console.error("YouTube Audio fallback failed:", audioErr.message);
        }
    }

    // Map YouTube category ID to string (simplified)
    const categoryMap = { '10': 'Music', '20': 'Gaming', '27': 'Education', '28': 'Science & Tech' };

    res.json({
        platform: 'youtube',
        bvid: videoDetails.videoId, // map videoId to bvid field for frontend consistency
        title: videoDetails.title,
        author: videoDetails.author.name,
        category: categoryMap[videoDetails.categoryId] || 'General',
        duration: parseInt(videoDetails.lengthSeconds),
        thumbnail: videoDetails.thumbnails[videoDetails.thumbnails.length - 1].url, // Highest res
        description: videoDetails.description,
        transcript: transcript,
        subtitleSource: source
    });
}

// ------------------------------------------------------------------
// API Route
// ------------------------------------------------------------------

app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    const platform = detectPlatform(url);
    const id = extractId(url, platform);

    if (!id) return res.status(400).json({ error: 'Invalid Video URL' });

    if (platform === 'bilibili') {
        await handleBilibili(id, res);
    } else if (platform === 'youtube') {
        await handleYoutube(id, res);
    } else {
        res.status(400).json({ error: 'Unsupported Platform' });
    }

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`BiliCut Backend running on http://localhost:${PORT}`);
});