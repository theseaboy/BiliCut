export enum TabOption {
  TRANSCRIPT = 'Transcript',
  CHAT = 'Chat',
  NOTES = 'Notes'
}

export interface Highlight {
  id: string;
  title: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  color: string; // Hex code
  description?: string;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: string;
  startTime: number;
}

export interface VideoData {
  platform: 'bilibili' | 'youtube'; // New: Support multiple platforms
  bvid: string; // For YouTube, this will store the Video ID
  title: string;
  author: string;
  category?: string;
  duration: number; // in seconds
  thumbnail: string;
  highlights: Highlight[];
  transcript: TranscriptSegment[];
  isTranscriptSimulated?: boolean;
  isAiTranscribed?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}