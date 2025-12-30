import { VideoData, TranscriptSegment } from '../types';
import { fetchBilibiliVideoInfo, extractBvid } from './bilibiliService';
import { generateVideoContent } from './geminiService';

const BACKEND_URL = 'http://localhost:3000/api/analyze';

interface AnalyzeResult {
  data: VideoData;
  source: 'backend' | 'ai-simulated';
}

export const analyzeVideo = async (url: string): Promise<AnalyzeResult> => {
  // 1. Try Backend
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (response.ok) {
      const json = await response.json();
      
      let finalTranscript = json.transcript;
      let highlights = [];
      let isSimulated = false;
      let isAiTranscribed = false;

      // Check source returned by backend
      if (json.subtitleSource === 'official') {
         // Has Official Subtitles
         isSimulated = false;
         isAiTranscribed = false;
      } else if (json.subtitleSource === 'ai_transcription') {
         // Has Real AI Transcribed Subtitles (High Quality)
         isSimulated = false;
         isAiTranscribed = true;
      } else {
         // No subtitles found even after audio download attempt
         isSimulated = true;
         isAiTranscribed = false;
      }

      // Logic to generate Highlights
      // If we have ANY transcript (Official or AI Transcribed), we use it to generate highlights
      if (!isSimulated && finalTranscript.length > 0) {
         const transcriptText = finalTranscript.map((t: any) => t.text).join(" ").slice(0, 15000); 
         const aiContent = await generateVideoContent(
            json.title, 
            `TRANSCRIPT_CONTEXT: ${transcriptText}`, 
            json.duration,
            json.category,
            json.author
         );
         highlights = aiContent.highlights;
      } 
      // If completely simulated
      else {
         console.log("No transcript available. Using full simulation.");
         const aiContent = await generateVideoContent(
            json.title, 
            json.description, 
            json.duration,
            json.category,
            json.author
         );
         finalTranscript = aiContent.transcript;
         highlights = aiContent.highlights;
      }

      const videoData: VideoData = {
        platform: (json.platform as 'bilibili' | 'youtube') || 'bilibili',
        bvid: json.bvid,
        title: json.title,
        author: json.author,
        category: json.category,
        duration: json.duration,
        thumbnail: json.thumbnail,
        highlights: highlights,
        transcript: finalTranscript,
        isTranscriptSimulated: isSimulated,
        isAiTranscribed: isAiTranscribed
      };

      return { data: videoData, source: 'backend' };
    }
  } catch (error) {
    console.warn("Backend connection failed, falling back to client-side mode.", error);
  }

  // 2. Fallback: Client Side Proxy + AI Hallucination (Offline Mode)
  console.log("Using Fallback Mode");
  const bvid = extractBvid(url);
  if (!bvid) throw new Error("Invalid URL");

  let metaInfo;
  try {
      metaInfo = await fetchBilibiliVideoInfo(bvid);
  } catch (e) {
      metaInfo = {
        bvid: bvid,
        title: "Video (Offline Mode)",
        author: "Unknown",
        duration: 600,
        thumbnail: "",
        description: "Could not fetch metadata.",
        category: "General"
      };
  }

  const aiContent = await generateVideoContent(
    metaInfo.title || "Unknown", 
    metaInfo.description || "", 
    metaInfo.duration || 600,
    (metaInfo as any).category || "General",
    metaInfo.author || "Unknown"
  );

  return {
    data: {
        platform: 'bilibili',
        bvid: metaInfo.bvid!,
        title: metaInfo.title || "Untitled",
        author: metaInfo.author || "Unknown",
        category: (metaInfo as any).category,
        duration: metaInfo.duration || 600,
        thumbnail: metaInfo.thumbnail || "",
        highlights: aiContent.highlights,
        transcript: aiContent.transcript,
        isTranscriptSimulated: true
    },
    source: 'ai-simulated'
  };
};