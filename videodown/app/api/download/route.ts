import { NextRequest, NextResponse } from "next/server";
import axios, { AxiosRequestConfig } from "axios";
import { detectPlatform, isValidUrl } from "@/app/lib/utils";
import { ApiResponse, VideoInfo, VideoQuality } from "@/app/types";

// Retry helper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delay = 1500
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error("Max retries exceeded");
}

// Shared axios config
const baseConfig: AxiosRequestConfig = {
  timeout: 25000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  },
};

// Helper to ensure absolute URL
function toAbsoluteUrl(u: string, base = "https://www.tikwm.com"): string {
  if (!u) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `${base}${u.startsWith("/") ? "" : "/"}${u}`;
}

// ============================================================
// TIKTOK DOWNLOADER
// ============================================================

// Method 1: ssstik.io (most reliable)
async function tiktokViaSsstik(url: string): Promise<VideoInfo> {
  // Step 1: Get token
  const pageResp = await axios.get("https://ssstik.io/en", {
    ...baseConfig,
    timeout: 15000,
  });

  const tokenMatch = (pageResp.data as string).match(/s_tt\s*=\s*["']([^"']+)["']/);
  if (!tokenMatch) throw new Error("Could not get ssstik token");

  // Step 2: Download
  const dlResp = await axios.post(
    "https://ssstik.io/abc?url=dl",
    new URLSearchParams({
      id: url,
      locale: "en",
      tt: tokenMatch[1],
    }),
    {
      ...baseConfig,
      headers: {
        ...baseConfig.headers,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://ssstik.io/en",
        Origin: "https://ssstik.io",
        "HX-Request": "true",
        "HX-Target": "target",
        "HX-Current-URL": "https://ssstik.io/en",
      },
    }
  );

  const html = dlResp.data as string;
  const downloads: VideoQuality[] = [];

  // Extract video links
  const videoLinks = html.matchAll(/href="(https:\/\/[^"]+)"[^>]*>\s*([^<]*(?:Without|With|HD|SD|MP3|Audio)[^<]*)</gi);
  for (const match of videoLinks) {
    const videoUrl = match[1];
    const label = match[2].trim();
    if (videoUrl && !downloads.find((d) => d.url === videoUrl)) {
      const isAudio = label.toLowerCase().includes("mp3") || label.toLowerCase().includes("audio");
      downloads.push({
        label: label || "Download",
        url: videoUrl,
        quality: isAudio ? "Audio" : label.toLowerCase().includes("hd") ? "HD" : "SD",
        format: isAudio ? "mp3" : "mp4",
      });
    }
  }

  // Fallback: extract any mp4/mp3 links
  if (downloads.length === 0) {
    const allLinks = html.matchAll(/href="(https:\/\/[^"]+\.(?:mp4|mp3)[^"]*)"/gi);
    for (const match of allLinks) {
      if (!downloads.find((d) => d.url === match[1])) {
        const isAudio = match[1].includes(".mp3");
        downloads.push({
          label: downloads.length === 0 ? "Video (No Watermark)" : `Download ${downloads.length + 1}`,
          url: match[1],
          quality: isAudio ? "Audio" : "HD",
          format: isAudio ? "mp3" : "mp4",
        });
      }
    }
  }

  // Extract tikcdn links
  if (downloads.length === 0) {
    const tikcLinks = html.matchAll(/href="(https:\/\/tikcdn\.io\/[^"]+)"/gi);
    for (const match of tikcLinks) {
      if (!downloads.find((d) => d.url === match[1])) {
        downloads.push({
          label: downloads.length === 0 ? "Video (No Watermark)" : `Download ${downloads.length + 1}`,
          url: match[1],
          quality: "HD",
          format: "mp4",
        });
      }
    }
  }

  if (downloads.length === 0) throw new Error("No download links found in ssstik response");

  // Extract thumbnail
  const thumbMatch = html.match(/src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
  const titleMatch = html.match(/<p[^>]*>([^<]{10,200})<\/p>/);

  return {
    title: titleMatch ? titleMatch[1].trim() : "TikTok Video",
    thumbnail: thumbMatch ? thumbMatch[1] : "",
    platform: "tiktok",
    downloads,
  };
}

// Method 2: tikwm API
async function tiktokViaTikwm(url: string): Promise<VideoInfo> {
  const response = await axios.post(
    "https://www.tikwm.com/api/",
    new URLSearchParams({ url, count: "12", cursor: "0", web: "1", hd: "1" }),
    {
      ...baseConfig,
      headers: {
        ...baseConfig.headers,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://www.tikwm.com/",
        Origin: "https://www.tikwm.com",
      },
    }
  );

  const data = response.data;
  if (data.code !== 0 || !data.data) {
    throw new Error(`tikwm error: ${data.msg || "Unknown error"}`);
  }

  const videoData = data.data;
  const downloads: VideoQuality[] = [];

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

  if (downloads.length === 0) throw new Error("No download links found");

  const getThumbnail = () => {
    const candidates = [videoData.origin_cover, videoData.cover, videoData.ai_dynamic_cover].filter(Boolean);
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
}

async function downloadTikTok(url: string): Promise<VideoInfo> {
  const methods = [
    () => withRetry(() => tiktokViaSsstik(url), 2, 2000),
    () => withRetry(() => tiktokViaTikwm(url), 2, 2000),
  ];

  let lastError: Error = new Error("All TikTok methods failed");
  for (const method of methods) {
    try {
      return await method();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
    }
  }
  throw new Error(`TikTok download failed: ${lastError.message}`);
}

// ============================================================
// TWITTER/X DOWNLOADER
// ============================================================

async function twitterViaVxTwitter(url: string): Promise<VideoInfo> {
  const normalizedUrl = url.replace("x.com", "twitter.com");
  const tweetId = normalizedUrl.match(/status\/(\d+)/)?.[1];
  if (!tweetId) throw new Error("Could not extract tweet ID");

  const response = await axios.get(
    `https://api.vxtwitter.com/Twitter/status/${tweetId}`,
    {
      ...baseConfig,
      headers: { ...baseConfig.headers, Accept: "application/json" },
    }
  );

  const data = response.data;
  if (!data?.media_extended?.length) throw new Error("No media found in tweet");

  const downloads: VideoQuality[] = [];
  const videos = data.media_extended.filter(
    (m: { type: string }) => m.type === "video" || m.type === "gif"
  );

  if (videos.length === 0) throw new Error("No video found in tweet");

  videos.forEach((video: { url: string; size?: { width: number; height: number } }, index: number) => {
    const quality = video.size ? `${video.size.width}x${video.size.height}` : index === 0 ? "HD" : "SD";
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
}

async function twitterViaTwitsave(url: string): Promise<VideoInfo> {
  const normalizedUrl = url.replace("x.com", "twitter.com");
  const response = await axios.get(
    `https://twitsave.com/info?url=${encodeURIComponent(normalizedUrl)}`,
    {
      ...baseConfig,
      headers: { ...baseConfig.headers, Accept: "text/html", Referer: "https://twitsave.com/" },
    }
  );

  const html = response.data as string;
  const downloads: VideoQuality[] = [];

  const downloadMatches = html.matchAll(/href="(https:\/\/[^"]+\.mp4[^"]*)"[^>]*>([^<]+)</g);
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
  const thumbMatch = html.match(/property="og:image"\s+content="([^"]+)"/);

  return {
    title: titleMatch ? titleMatch[1].replace(" - TwitSave", "").trim() : "Twitter Video",
    thumbnail: thumbMatch ? thumbMatch[1] : "",
    platform: "twitter",
    downloads,
  };
}

async function downloadTwitter(url: string): Promise<VideoInfo> {
  const methods = [
    () => withRetry(() => twitterViaVxTwitter(url), 2, 1500),
    () => withRetry(() => twitterViaTwitsave(url), 2, 1500),
  ];

  let lastError: Error = new Error("All Twitter methods failed");
  for (const method of methods) {
    try {
      return await method();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
    }
  }
  throw new Error(`Twitter download failed: ${lastError.message}`);
}

// ============================================================
// FACEBOOK DOWNLOADER
// ============================================================

async function facebookViaGetfvid(url: string): Promise<VideoInfo> {
  const response = await axios.post(
    "https://getfvid.com/downloader",
    new URLSearchParams({ url }),
    {
      ...baseConfig,
      headers: {
        ...baseConfig.headers,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://getfvid.com/",
        Origin: "https://getfvid.com",
      },
    }
  );

  const html = response.data as string;
  const downloads: VideoQuality[] = [];

  const hdMatch = html.match(/href="(https:\/\/[^"]+)"[^>]*>\s*HD\s*</);
  if (hdMatch) downloads.push({ label: "HD Video", url: hdMatch[1], quality: "HD", format: "mp4" });

  const sdMatch = html.match(/href="(https:\/\/[^"]+)"[^>]*>\s*SD\s*</);
  if (sdMatch) downloads.push({ label: "SD Video", url: sdMatch[1], quality: "SD", format: "mp4" });

  if (downloads.length === 0) throw new Error("No download links found");

  const thumbMatch = html.match(/src="(https:\/\/[^"]+\.jpg[^"]*)"[^>]*class="[^"]*thumbnail/);

  return {
    title: "Facebook Video",
    thumbnail: thumbMatch ? thumbMatch[1] : "",
    platform: "facebook",
    downloads,
  };
}

async function facebookViaSnapSave(url: string): Promise<VideoInfo> {
  // SnapSave returns obfuscated JS, need to decode it
  const response = await axios.post(
    "https://snapsave.app/action.php",
    new URLSearchParams({ url }),
    {
      ...baseConfig,
      headers: {
        ...baseConfig.headers,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://snapsave.app/",
        Origin: "https://snapsave.app",
      },
    }
  );

  const jsCode = response.data as string;

  // The response is obfuscated JS that decodes to HTML
  // Try to extract URLs directly from the obfuscated code
  const urlMatches = jsCode.matchAll(/https:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*/g);
  const downloads: VideoQuality[] = [];

  for (const match of urlMatches) {
    const videoUrl = match[0].replace(/\\u002F/g, "/").replace(/\\/g, "");
    if (!downloads.find((d) => d.url === videoUrl)) {
      downloads.push({
        label: downloads.length === 0 ? "HD Video" : "SD Video",
        url: videoUrl,
        quality: downloads.length === 0 ? "HD" : "SD",
        format: "mp4",
      });
    }
  }

  if (downloads.length === 0) throw new Error("No download links found in snapsave response");

  return {
    title: "Facebook Video",
    thumbnail: "",
    platform: "facebook",
    downloads,
  };
}

async function downloadFacebook(url: string): Promise<VideoInfo> {
  const methods = [
    () => withRetry(() => facebookViaGetfvid(url), 2, 2000),
    () => withRetry(() => facebookViaSnapSave(url), 2, 2000),
  ];

  let lastError: Error = new Error("All Facebook methods failed");
  for (const method of methods) {
    try {
      return await method();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
    }
  }
  throw new Error(`Facebook download failed: ${lastError.message}`);
}

// ============================================================
// THREADS DOWNLOADER
// ============================================================

async function threadsViaApi(url: string): Promise<VideoInfo> {
  const postIdMatch = url.match(/\/p\/([A-Za-z0-9_-]+)/);
  if (!postIdMatch) throw new Error("Invalid Threads URL format");

  const response = await axios.get("https://www.threads.net/api/graphql", {
    params: {
      doc_id: "6232751443445612",
      variables: JSON.stringify({ postID: postIdMatch[1] }),
    },
    ...baseConfig,
    headers: {
      ...baseConfig.headers,
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

  if (videoVersions?.length > 0) {
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
}

async function threadsViaSaveThreads(url: string): Promise<VideoInfo> {
  const response = await axios.post(
    "https://savethreads.net/",
    new URLSearchParams({ url }),
    {
      ...baseConfig,
      headers: {
        ...baseConfig.headers,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://savethreads.net/",
        Origin: "https://savethreads.net",
      },
    }
  );

  const html = response.data as string;
  const downloads: VideoQuality[] = [];

  const videoMatches = html.matchAll(/href="(https:\/\/[^"]+\.mp4[^"]*)"/g);
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
}

async function downloadThreads(url: string): Promise<VideoInfo> {
  const methods = [
    () => withRetry(() => threadsViaApi(url), 2, 1500),
    () => withRetry(() => threadsViaSaveThreads(url), 2, 1500),
  ];

  let lastError: Error = new Error("All Threads methods failed");
  for (const method of methods) {
    try {
      return await method();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
    }
  }
  throw new Error(`Threads download failed: ${lastError.message}`);
}

// ============================================================
// MAIN POST HANDLER
// ============================================================

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
          error: "Unsupported platform. Please use TikTok, Threads, Facebook, or Twitter/X URLs.",
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
