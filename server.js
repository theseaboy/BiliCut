/**
 * BiliCut Backend Server
 * 
 * Capabilities:
 * 1. Fetches Bilibili Metadata.
 * 2. Proxies official subtitles if available.
 * 3. FALLBACK: Downloads audio stream and uses Gemini 1.5 Flash for Speech-to-Text (ASR).
 * 
 * Usage:
 * 1. Install: npm install express cors node-fetch @google/genai dotenv
 * 2. Set Env: export API_KEY=your_key (or create .env file)
 * 3. Run: node server.js
 */

require('dotenv').config(); // Load environment variables if .env file exists
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

// Fix for ESM-only node-fetch in CommonJS
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = 3000;

// Initialize Google GenAI
// Note: We use gemini-1.5-flash for audio processing as it is multimodal and fast
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

app.use(cors());
app.use(express.json());

// Helper: Extract BVID
const extractBvid = (url) => {
  const match = url.match(/(BV[a-zA-Z0-9]+)/);
  return match ? match[1] : null;
};

// Helper: Format seconds to MM:SS
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ------------------------------------------------------------------
// Core Logic: Audio Download & Transcription
// ------------------------------------------------------------------

async function getAudioStreamUrl(bvid, cid) {
  // fnval=16 requests DASH format which separates audio/video streams
  const apiUrl = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&fnval=16`;
  const response = await fetch(apiUrl);
  const json = await response.json();

  if (json.code !== 0 || !json.data.dash) {
    throw new Error('Could not retrieve DASH stream url');
  }

  // Get the first audio stream (usually best quality)
  const audioObj = json.data.dash.audio[0];
  return audioObj.baseUrl || audioObj.backup_url[0];
}

async function downloadAudioToBuffer(url) {
  // Bilibili streams require the Referer header
  const response = await fetch(url, {
    headers: {
      'Referer': 'https://www.bilibili.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.statusText}`);
  }

  return await response.arrayBuffer();
}

async function transcribeAudioWithGemini(audioBuffer) {
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
       - "text": string (the transcribed text in Simplified Chinese)
    4. Segment the text naturally by sentence or roughly every 5-15 seconds.
    5. Do not include markdown formatting. Return raw JSON only.
  `;

  // Convert ArrayBuffer to Base64
  const base64Audio = Buffer.from(audioBuffer).toString('base64');

  try {
    const result = await ai.models.generateContent({
        model: model,
        contents: {
            parts: [
                { inlineData: { mimeType: "audio/mp3", data: base64Audio } }, // mimeType can be generic for m4s/aac often, mp3 usually works for prompting
                { text: prompt }
            ]
        },
        config: {
            responseMimeType: "application/json"
        }
    });

    const text = result.response.text();
    const json = JSON.parse(text);
    
    // Post-process to add formatted timestamps and IDs
    return json.transcript.map((item, index) => ({
        id: `ai-t${index}`,
        startTime: item.startTime,
        // We estimate endTime if not provided, or next segment start
        text: item.text,
        timestamp: formatTime(item.startTime)
    }));

  } catch (error) {
    console.error("Gemini Transcription Failed:", error);
    throw new Error("AI Transcription failed");
  }
}


// ------------------------------------------------------------------
// API Route
// ------------------------------------------------------------------

app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    const bvid = extractBvid(url);

    if (!bvid) {
      return res.status(400).json({ error: 'Invalid Bilibili URL' });
    }

    console.log(`Analyzing BVID: ${bvid}`);

    // 1. Get Metadata
    const viewResponse = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
    const viewJson = await viewResponse.json();

    if (viewJson.code !== 0) throw new Error(`Bilibili API Error: ${viewJson.message}`);
    
    const videoData = viewJson.data;
    const cid = videoData.cid;

    // 2. Try Official Subtitles
    let transcript = [];
    let source = 'none'; // 'official', 'ai_transcription', 'none'

    const playerResponse = await fetch(`https://api.bilibili.com/x/player/v2?bvid=${bvid}&cid=${cid}`);
    const playerJson = await playerResponse.json();

    if (playerJson.data?.subtitle?.subtitles?.length > 0) {
      const subUrl = playerJson.data.subtitle.subtitles[0].subtitle_url;
      const secureUrl = subUrl.startsWith('//') ? `https:${subUrl}` : subUrl;
      console.log(`Found official subtitles: ${secureUrl}`);
      
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
    
    // 3. Fallback: Download Audio & Transcribe (If no official subs)
    else {
        console.log("No official subtitles. Starting AI audio transcription...");
        try {
            // A. Get Audio URL
            const audioUrl = await getAudioStreamUrl(bvid, cid);
            console.log("Audio URL obtained. Downloading...");
            
            // B. Download Audio
            const audioBuffer = await downloadAudioToBuffer(audioUrl);
            console.log(`Audio downloaded (${(audioBuffer.byteLength / 1024 / 1024).toFixed(2)} MB). Sending to Gemini...`);

            // C. Transcribe
            // Safety Check: Gemini Flash has limits, usually ~20MB for REST API or larger for File API.
            // For this demo, if audio is > 20MB, we might clip it or warn.
            if (audioBuffer.byteLength > 25 * 1024 * 1024) {
                 console.warn("Audio too large for single pass via REST. Clipping to first 20MB...");
                 // In a real app, you'd chunk this or use the File API.
                 // We slice buffer to avoid 413 Payload Too Large
                 transcript = await transcribeAudioWithGemini(audioBuffer.slice(0, 20 * 1024 * 1024));
            } else {
                 transcript = await transcribeAudioWithGemini(audioBuffer);
            }
            
            source = 'ai_transcription';
            console.log("AI Transcription complete.");

        } catch (err) {
            console.error("Audio fallback failed:", err);
            // If download/transcribe fails, we return empty and let frontend do the 'hallucination' fallback
            source = 'none';
        }
    }

    res.json({
      bvid: videoData.bvid,
      title: videoData.title,
      author: videoData.owner.name,
      category: videoData.tname,
      duration: videoData.duration,
      thumbnail: videoData.pic,
      description: videoData.desc,
      transcript: transcript,
      subtitleSource: source // 'official', 'ai_transcription', 'none'
    });

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`BiliCut Backend running on http://localhost:${PORT}`);
});