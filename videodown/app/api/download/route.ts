import { NextRequest, NextResponse } from "next/server";
import axios, { AxiosRequestConfig } from "axios";
import { detectPlatform, isValidUrl } from "@/app/lib/utils";
import { ApiResponse, VideoInfo, VideoQuality } from "@/app/types";

// Retry helper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries exceeded");
}

// Shared axios config
const axiosConfig: AxiosRequestConfig = {
  timeout: 30000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
  },
};

// Helper to ensure absolute URL (tikwm sometimes returns relative paths)
function toAbsoluteUrl(u: string, base = "https://www.tikwm.com"): string {
  if (!u) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `${base}${u.startsWith("/") ? "" : "/"}${u}`;
}

// TikTok downloader using tikwm API with retry
async function downloadTikTok(url: string): Promise<VideoInfo> {
  const fetchFromTikwm = async () => {
    const response = await axios.post(
      "https://www.tikwm.com/api/",
      new URLSearchParams({ url, count: "12", cursor: "0", web: "1", hd: "1" }),
      {
        ...axiosConfig,
        headers: {
          ...axiosConfig.headers,
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: "https://www.tikwm.com/",
          Origin: "https://www.tikwm.com",
        },
      }
    );

    const data = response.data;
    if (data.code !== 0 || !data.data) {
      throw new Error(`tikwm API error: ${data.msg || "Unknown error"}`);
    }

    return data.data;
  };

  try {
    const videoData = await withRetry(fetchFromTikwm, 3, 2000);
    const downloads: VideoQuality[] = [];

    // Note: hdplay uses BVC2 codec (TikTok proprietary) which is not widely supported.
    // We use 'play' (H.264) as the primary no-watermark option.
    if (videoData.play) {
      downloads.push({
        label: "Video (No Watermark)",
        url: toAbsoluteUrl(videoData.play),
        quality: "HD",
        format: "mp4",
      });
    }

    if (videoData.wmplay) {
      downloads.push({
        label: "Video (With Watermark)",
        url: toAbsoluteUrl(videoData.wmplay),
        quality: "SD",
        format: "mp4",
      });
    }

    if (videoData.music) {
      downloads.push({
        label: "Audio Only (MP3)",
        url: toAbsoluteUrl(videoData.music),
        quality: "Audio",
        format: "mp3",
      });
    }

    if (downloads.length === 0) {
      throw new Error("No download links found");
    }

    // Prefer TikTok CDN URLs for thumbnail (tikwm.com blocks cross-origin)
    const getThumbnail = () => {
      const candidates = [
        videoData.origin_cover,
        videoData.cover,
        videoData.ai_dynamic_cover,
      ].filter(Boolean);

      for (const u of candidates) {
        const absUrl = toAbsoluteUrl(u);
        if (!absUrl.includes("tikwm.com")) return absUrl;
      }
      return candidates.length > 0 ? toAbsoluteUrl(candidates[0]) : "";
    };

    return {
      title: videoData.title || "TikTok Video",
      thumbnail: getThumbnail(),
      duration: videoData.duration
        ? `${Math.floor(videoData.duration / 60)}:${String(videoData.duration % 60).padStart(2, "0")}`
        : undefined,
      author: videoData.author?.nickname || videoData.author?.unique_id,
      platform: "tiktok",
      downloads,
    };
  } catch (error) {
    throw new Error(
      `TikTok download failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// Twitter/X downloader with multiple fallback APIs
async function downloadTwitter(url: string): Promise<VideoInfo> {
  // Normalize URL (x.com -> twitter.com)
  const normalizedUrl = url.replace("x.com", "twitter.com");

  // Method 1: vxtwitter API (fast and reliable)
  const tryVxTwitter = async (): Promise<VideoInfo> => {
    const tweetId = normalizedUrl.match(/status\/(\d+)/)?.[1];
    if (!tweetId) throw new Error("Could not extract tweet ID");

    const response = await axios.get(
      `https://api.vxtwitter.com/Twitter/status/${tweetId}`,
      {
        ...axiosConfig,
        headers: {
          ...axiosConfig.headers,
          Accept: "application/json",
        },
      }
    );

    const data = response.data;
    if (!data || !data.media_extended) throw new Error("No media found");

    const downloads: VideoQuality[] = [];
    const videos = data.media_extended.filter(
      (m: { type: string }) => m.type === "video" || m.type === "gif"
    );

    if (videos.length === 0) throw new Error("No video found in tweet");

    videos.forEach((video: { url: string; thumbnail_url?: string; size?: { width: number; height: number } }, index: number) => {
      const quality = video.size
        ? `${video.size.width}x${video.size.height}`
        : index === 0
        ? "HD"
        : "SD";
      downloads.push({
        label: index === 0 ? "Video HD" : `Video ${index + 1}`,
        url: video.url,
        quality,
        format: "mp4",
      });
    });

    return {
      title: data.text?.slice(0, 100) || "Twitter Video",
      thumbnail: data.mediaURLs?.[0] || data.media_extended?.[0]?.thumbnail_url || "",
      author: data.user_name || data.user_screen_name,
      platform: "twitter",
      downloads,
    };
  };

  // Method 2: twitsave scraping
  const tryTwitSave = async (): Promise<VideoInfo> => {
    const response = await axios.get(
      `https://twitsave.com/info?url=${encodeURIComponent(normalizedUrl)}`,
      {
        ...axiosConfig,
        headers: {
          ...axiosConfig.headers,
          Accept: "text/html",
          Referer: "https://twitsave.com/",
        },
      }
    );

    const html = response.data as string;
    const downloads: VideoQuality[] = [];

    const downloadMatches = html.matchAll(
      /href="(https:\/\/[^"]+\.mp4[^"]*)"[^>]*>([^<]+)</g
    );
    for (const match of downloadMatches) {
      const videoUrl = match[1];
      const label = match[2].trim();
      if (videoUrl && !downloads.find((d) => d.url === videoUrl)) {
        downloads.push({
          label: label || "Download Video",
          url: videoUrl,
          quality: label.includes("720") ? "720p" : label.includes("480") ? "480p" : "SD",
          format: "mp4",
        });
      }
    }

    if (downloads.length === 0) throw new Error("No download links found");

    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(" - TwitSave", "").trim() : "Twitter Video";
    const thumbMatch = html.match(/property="og:image"\s+content="([^"]+)"/);

    return {
      title,
      thumbnail: thumbMatch ? thumbMatch[1] : "",
      platform: "twitter",
      downloads,
    };
  };

  // Try methods in order
  const methods = [tryVxTwitter, tryTwitSave];
  let lastError: Error = new Error("All methods failed");

  for (const method of methods) {
    try {
      return await withRetry(method, 2, 1000);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
      continue;
    }
  }

  throw new Error(`Twitter download failed: ${lastError.message}`);
}

// Facebook downloader with multiple methods
async function downloadFacebook(url: string): Promise<VideoInfo> {
  // Method 1: getfvid.com
  const tryGetFvid = async (): Promise<VideoInfo> => {
    const response = await axios.post(
      "https://getfvid.com/downloader",
      new URLSearchParams({ url }),
      {
        ...axiosConfig,
        headers: {
          ...axiosConfig.headers,
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: "https://getfvid.com/",
          Origin: "https://getfvid.com",
        },
      }
    );

    const html = response.data as string;
    const downloads: VideoQuality[] = [];

    const hdMatch = html.match(/href="(https:\/\/[^"]+)"[^>]*>\s*HD\s*</);
    if (hdMatch) {
      downloads.push({
        label: "HD Video",
        url: hdMatch[1],
        quality: "HD",
        format: "mp4",
      });
    }

    const sdMatch = html.match(/href="(https:\/\/[^"]+)"[^>]*>\s*SD\s*</);
    if (sdMatch) {
      downloads.push({
        label: "SD Video",
        url: sdMatch[1],
        quality: "SD",
        format: "mp4",
      });
    }

    if (downloads.length === 0) throw new Error("No download links found");

    const thumbMatch = html.match(/src="(https:\/\/[^"]+\.jpg[^"]*)"[^>]*class="[^"]*thumbnail/);

    return {
      title: "Facebook Video",
      thumbnail: thumbMatch ? thumbMatch[1] : "",
      platform: "facebook",
      downloads,
    };
  };

  // Method 2: fdown.net
  const tryFdown = async (): Promise<VideoInfo> => {
    const response = await axios.post(
      "https://fdown.net/download.php",
      new URLSearchParams({ URLz: url }),
      {
        ...axiosConfig,
        headers: {
          ...axiosConfig.headers,
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: "https://fdown.net/",
          Origin: "https://fdown.net",
        },
      }
    );

    const html = response.data as string;
    const downloads: VideoQuality[] = [];

    // Extract HD
    const hdMatch = html.match(/id="hdlink"[^>]*href="([^"]+)"/);
    if (hdMatch) {
      downloads.push({
        label: "HD Video",
        url: hdMatch[1],
        quality: "HD",
        format: "mp4",
      });
    }

    // Extract SD
    const sdMatch = html.match(/id="sdlink"[^>]*href="([^"]+)"/);
    if (sdMatch) {
      downloads.push({
        label: "SD Video",
        url: sdMatch[1],
        quality: "SD",
        format: "mp4",
      });
    }

    if (downloads.length === 0) throw new Error("No download links found");

    return {
      title: "Facebook Video",
      thumbnail: "",
      platform: "facebook",
      downloads,
    };
  };

  const methods = [tryGetFvid, tryFdown];
  let lastError: Error = new Error("All methods failed");

  for (const method of methods) {
    try {
      return await withRetry(method, 2, 1000);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
      continue;
    }
  }

  throw new Error(`Facebook download failed: ${lastError.message}`);
}

// Threads downloader
async function downloadThreads(url: string): Promise<VideoInfo> {
  // Method 1: Threads API
  const tryThreadsApi = async (): Promise<VideoInfo> => {
    const postIdMatch = url.match(/\/p\/([A-Za-z0-9_-]+)/);
    if (!postIdMatch) throw new Error("Invalid Threads URL format");

    const response = await axios.get("https://www.threads.net/api/graphql", {
      params: {
        doc_id: "6232751443445612",
        variables: JSON.stringify({ postID: postIdMatch[1] }),
      },
      ...axiosConfig,
      headers: {
        ...axiosConfig.headers,
        "X-IG-App-ID": "238260118697367",
        Accept: "application/json",
        Referer: "https://www.threads.net/",
      },
    });

    const data = response.data;
    const post = data?.data?.data?.edges?.[0]?.node?.thread_items?.[0]?.post;

    if (!post) throw new Error("Could not fetch Threads post data");

    const downloads: VideoQuality[] = [];
    const videoVersions = post?.video_versions;

    if (videoVersions && videoVersions.length > 0) {
      videoVersions.forEach(
        (version: { url: string; width: number; height: number }, index: number) => {
          downloads.push({
            label: index === 0 ? "HD Video" : `Video ${index + 1}`,
            url: version.url,
            quality: `${version.width}x${version.height}`,
            format: "mp4",
          });
        }
      );
    }

    if (downloads.length === 0) throw new Error("No video found in this Threads post");

    const thumbnail =
      post?.image_versions2?.candidates?.[0]?.url ||
      post?.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url ||
      "";

    return {
      title: post?.caption?.text?.slice(0, 100) || "Threads Video",
      thumbnail,
      author: post?.user?.username,
      platform: "threads",
      downloads,
    };
  };

  // Method 2: savethreads.net scraping
  const trySaveThreads = async (): Promise<VideoInfo> => {
    const response = await axios.post(
      "https://savethreads.net/",
      new URLSearchParams({ url }),
      {
        ...axiosConfig,
        headers: {
          ...axiosConfig.headers,
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: "https://savethreads.net/",
          Origin: "https://savethreads.net",
        },
      }
    );

    const html = response.data as string;
    const downloads: VideoQuality[] = [];

    const videoMatches = html.matchAll(/href="(https:\/\/[^"]+\.mp4[^"]*)"[^>]*>/g);
    for (const match of videoMatches) {
      if (!downloads.find((d) => d.url === match[1])) {
        downloads.push({
          label: `Video ${downloads.length + 1}`,
          url: match[1],
          quality: downloads.length === 0 ? "HD" : "SD",
          format: "mp4",
        });
      }
    }

    if (downloads.length === 0) throw new Error("No video found");

    const thumbMatch = html.match(/src="(https:\/\/[^"]+\.jpg[^"]*)"/);

    return {
      title: "Threads Video",
      thumbnail: thumbMatch ? thumbMatch[1] : "",
      platform: "threads",
      downloads,
    };
  };

  const methods = [tryThreadsApi, trySaveThreads];
  let lastError: Error = new Error("All methods failed");

  for (const method of methods) {
    try {
      return await withRetry(method, 2, 1000);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
      continue;
    }
  }

  throw new Error(`Threads download failed: ${lastError.message}`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "URL is required" },
        { status: 400 }
      );
    }

    if (!isValidUrl(url)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Invalid URL format" },
        { status: 400 }
      );
    }

    const platform = detectPlatform(url);

    if (platform === "unknown") {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Unsupported platform. Please use TikTok, Threads, Facebook, or Twitter/X URLs.",
        },
        { status: 400 }
      );
    }

    let videoInfo: VideoInfo;

    switch (platform) {
      case "tiktok":
        videoInfo = await downloadTikTok(url);
        break;
      case "twitter":
        videoInfo = await downloadTwitter(url);
        break;
      case "facebook":
        videoInfo = await downloadFacebook(url);
        break;
      case "threads":
        videoInfo = await downloadThreads(url);
        break;
      default:
        return NextResponse.json<ApiResponse>(
          { success: false, error: "Unsupported platform" },
          { status: 400 }
        );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: videoInfo,
    });
  } catch (error) {
    console.error("Download API error:", error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}
