import { VideoData } from '../types';

interface BilibiliApiResponse {
  code: number;
  data: {
    bvid: string;
    title: string;
    desc: string;
    pic: string;
    duration: number; // seconds
    owner: {
      name: string;
    };
  };
}

export const extractBvid = (inputUrl: string): string | null => {
  const regex = /(BV[a-zA-Z0-9]+)/;
  const match = inputUrl.match(regex);
  return match ? match[1] : null;
};

// Fallback: Fetch metadata using a public CORS proxy (allorigins)
// This is used when the local backend server is not running
export const fetchBilibiliVideoInfo = async (bvid: string): Promise<Partial<VideoData> & { description: string }> => {
  try {
    const targetUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    // Using a public proxy to bypass CORS for client-side only demo
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error("Network response was not ok");

    const json = await response.json() as BilibiliApiResponse;
    if (json.code !== 0) throw new Error("Bilibili API Error");

    const data = json.data;

    return {
      bvid: data.bvid,
      title: data.title,
      author: data.owner.name,
      duration: data.duration,
      thumbnail: data.pic,
      description: data.desc,
    };
  } catch (error) {
    console.error("Failed to fetch Bilibili metadata via proxy", error);
    throw error;
  }
};