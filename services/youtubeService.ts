
import { STORAGE_KEY } from "../config";

export const performYouTubeSearch = async (query: string) => {
  const token = localStorage.getItem(STORAGE_KEY);
  if (!token) throw new Error("No Access Token Found. Connect Drive first.");

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '5',
    q: query
  });

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      // Parse the detailed JSON error from Google to show the real reason (Scope, Quota, etc.)
      const errorData = await response.json().catch(() => null);
      const detailedMessage = errorData?.error?.message || response.statusText;
      const code = errorData?.error?.code || response.status;

      if (code === 401) throw new Error("Access Token Expired or Invalid.");
      if (code === 403) {
          // Check for quota specifically
          if (detailedMessage.includes('quota')) {
              throw new Error("YouTube API Quota Exceeded for this key. Video search is temporarily unavailable.");
          }
          throw new Error(`Permission Denied: ${detailedMessage}. (Check if YouTube scope is enabled)`);
      }
      
      throw new Error(`YouTube API Error (${code}): ${detailedMessage}`);
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return { text: "No videos found for this query.", videos: [] };
    }

    const videos = data.items.map((item: any) => ({
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      description: item.snippet.description,
      videoId: item.id.videoId,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`
    }));

    const textSummary = videos.map((v: any) => 
      `- [${v.title}](${v.url}) by ${v.channel}: ${v.description}`
    ).join('\n');

    return { text: textSummary, videos };

  } catch (error: any) {
    // Re-throw so the Agent knows exactly what went wrong
    throw new Error(error.message || "Network error while searching YouTube.");
  }
};
