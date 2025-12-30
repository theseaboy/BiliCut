import { VideoData } from '../types';

// This simulates the data we would get after "Analyzing" a video
export const MOCK_VIDEO_DATA: VideoData = {
  bvid: "BV1J4411C76B", // Example ID, will be overwritten by user input if valid
  title: "AI Roadmap 2026: Essential Skills for the Future",
  author: "Tech Visionary",
  duration: 1124, // 18 mins 44 secs
  thumbnail: "https://picsum.photos/800/450",
  highlights: [
    {
      id: "h1",
      title: "Prompting Unlocks All AI",
      startTime: 0,
      endTime: 180,
      color: "#FCA5A5", // Red-300ish
      description: "Understanding the fundamental shift in how we interact with software."
    },
    {
      id: "h2",
      title: "Master One Chatbot Stack",
      startTime: 181,
      endTime: 420,
      color: "#FDBA74", // Orange-300ish
      description: "Why sticking to Claude, GPT-4, or Gemini creates mastery."
    },
    {
      id: "h3",
      title: "Build Custom AI Agents",
      startTime: 421,
      endTime: 650,
      color: "#A7F3D0", // Emerald-200ish
      description: "Moving from chat to autonomous agents that perform tasks."
    },
    {
      id: "h4",
      title: "Open-Source AI Trends",
      startTime: 651,
      endTime: 900,
      color: "#C4B5FD", // Violet-300ish
      description: "The rise of Llama 3 and local models for privacy."
    },
    {
      id: "h5",
      title: "Vibe Code Products Instantly",
      startTime: 901,
      endTime: 1124,
      color: "#BAE6FD", // Sky-200ish
      description: "Using AI to generate UI/UX and functional prototypes in minutes."
    }
  ],
  transcript: [
    { id: "t1", timestamp: "00:00", startTime: 0, text: "Here are the essential AI skills that I think you should know in 2026. Starting from beginner, intermediate to advanced." },
    { id: "t2", timestamp: "00:15", startTime: 15, text: "And there is one AI trend that actually really caught me by surprise, but I really think we'll be transforming the world of AI." },
    { id: "t3", timestamp: "00:45", startTime: 45, text: "But before I get to that, let us start from the beginning, the basics. Prompt engineering isn't dead, it's just evolved." },
    { id: "t4", timestamp: "01:20", startTime: 80, text: "When we talk about 'Prompting Unlocks All AI', we mean that natural language is becoming the new programming syntax." },
    { id: "t5", timestamp: "03:01", startTime: 181, text: "Moving on to the second point: Master One Chatbot Stack. Don't jump between tools constantly." },
    { id: "t6", timestamp: "03:45", startTime: 225, text: "Whether it's Gemini or ChatGPT, learning the nuances of one model is far more valuable than shallow knowledge of five." },
    { id: "t7", timestamp: "07:10", startTime: 430, text: "Now let's talk about Agents. This is where the industry is heading. Agents act, they don't just talk." },
    { id: "t8", timestamp: "11:00", startTime: 660, text: "Open source is catching up. The gap between proprietary models and open weights is closing rapidly." },
    { id: "t9", timestamp: "15:20", startTime: 920, text: "Finally, 'Vibe Coding'. It's about iterating on product feel using AI to write the boilerplate instantly." }
  ]
};