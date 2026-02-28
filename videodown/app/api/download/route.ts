import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { detectPlatform, isValidUrl } from "@/app/lib/utils";
import { ApiResponse, VideoInfo, VideoQuality } from "@/app/types";

// TikTok downloader using tikwm API
async function downloadTikTok(url: string): Promise<VideoInfo> {
  try {
    const response = await axios.post(
      "https://www.tikwm.com/api/",
      new URLSearchParams({ url, count: "12", cursor: "0", web: "1", hd: "1" }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 15000,
      }
    );

    const data = response.data;
    if (data.code !== 0 || !data.data) {
      throw new Error("Failed to fetch TikTok video info");
    }

    const videoData = data.data;
    const downloads: VideoQuality[] = [];

    // Helper to ensure absolute URL (tikwm sometimes returns relative paths)
    const toAbsoluteUrl = (u: string) => {
      if (!u) return u;
      if (u.startsWith("http://") || u.startsWith("https://")) return u;
      return `https://www.tikwm.com${u.startsWith("/") ? "" : "/"}${u}`;
    };

    // Note: hdplay uses BVC2 codec (TikTok proprietary) which is not widely supported.
    // We use 'play' (H.264) as the primary no-watermark option.
    if (videoData.play) {
      downloads.push({
        label: "Video HD (No Watermark)",
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

    return {
      title: videoData.title || "TikTok Video",
      thumbnail: toAbsoluteUrl(videoData.cover || videoData.origin_cover || ""),
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

// Twitter/X downloader using twitsave API
async function downloadTwitter(url: string): Promise<VideoInfo> {
  try {
    // Use the twitsave.com API
    const response = await axios.get(
      `https://twitsave.com/info?url=${encodeURIComponent(url)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          Referer: "https://twitsave.com/",
        },
        timeout: 15000,
      }
    );

    const html = response.data as string;

    // Parse the response to extract video URLs
    const downloads: VideoQuality[] = [];

    // Extract download links from the HTML
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

    // Extract title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(" - TwitSave", "").trim() : "Twitter Video";

    // Extract thumbnail
    const thumbMatch = html.match(/property="og:image"\s+content="([^"]+)"/);
    const thumbnail = thumbMatch ? thumbMatch[1] : "";

    if (downloads.length === 0) {
      // Fallback: try another approach
      throw new Error("No download links found");
    }

    return {
      title,
      thumbnail,
      platform: "twitter",
      downloads,
    };
  } catch {
    // Try alternative API
    try {
      const apiResponse = await axios.get(
        `https://api.savetweetvid.com/v1?url=${encodeURIComponent(url)}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
          },
          timeout: 15000,
        }
      );

      const data = apiResponse.data;
      if (data && data.links) {
        const downloads: VideoQuality[] = data.links.map(
          (link: { url: string; quality: string }) => ({
            label: `Video ${link.quality}`,
            url: link.url,
            quality: link.quality,
            format: "mp4",
          })
        );

        return {
          title: data.title || "Twitter Video",
          thumbnail: data.thumbnail || "",
          platform: "twitter",
          downloads,
        };
      }
      throw new Error("No video data found");
    } catch (fallbackError) {
      throw new Error(
        `Twitter download failed: ${fallbackError instanceof Error ? fallbackError.message : "Unknown error"}`
      );
    }
  }
}

// Facebook downloader using getfvid API
async function downloadFacebook(url: string): Promise<VideoInfo> {
  try {
    const response = await axios.post(
      "https://getfvid.com/downloader",
      new URLSearchParams({ url }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://getfvid.com/",
          Origin: "https://getfvid.com",
        },
        timeout: 15000,
      }
    );

    const html = response.data as string;
    const downloads: VideoQuality[] = [];

    // Extract HD video
    const hdMatch = html.match(/href="(https:\/\/[^"]+)"[^>]*>\s*HD\s*</);
    if (hdMatch) {
      downloads.push({
        label: "HD Video",
        url: hdMatch[1],
        quality: "HD",
        format: "mp4",
      });
    }

    // Extract SD video
    const sdMatch = html.match(/href="(https:\/\/[^"]+)"[^>]*>\s*SD\s*</);
    if (sdMatch) {
      downloads.push({
        label: "SD Video",
        url: sdMatch[1],
        quality: "SD",
        format: "mp4",
      });
    }

    // Extract thumbnail
    const thumbMatch = html.match(/src="(https:\/\/[^"]+\.jpg[^"]*)"[^>]*class="[^"]*thumbnail/);
    const thumbnail = thumbMatch ? thumbMatch[1] : "";

    if (downloads.length === 0) {
      throw new Error("No download links found for this Facebook video");
    }

    return {
      title: "Facebook Video",
      thumbnail,
      platform: "facebook",
      downloads,
    };
  } catch (error) {
    throw new Error(
      `Facebook download failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// Threads downloader
async function downloadThreads(url: string): Promise<VideoInfo> {
  try {
    // Threads uses Instagram's infrastructure
    // Try to get the post ID from URL
    const postIdMatch = url.match(/\/p\/([A-Za-z0-9_-]+)/);
    if (!postIdMatch) {
      throw new Error("Invalid Threads URL format");
    }

    const response = await axios.get(
      `https://www.threads.net/api/graphql`,
      {
        params: {
          doc_id: "6232751443445612",
          variables: JSON.stringify({ postID: postIdMatch[1] }),
        },
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "X-IG-App-ID": "238260118697367",
          Accept: "application/json",
        },
        timeout: 15000,
      }
    );

    const data = response.data;
    const post = data?.data?.data?.edges?.[0]?.node?.thread_items?.[0]?.post;

    if (!post) {
      throw new Error("Could not fetch Threads post data");
    }

    const downloads: VideoQuality[] = [];
    const videoVersions = post?.video_versions;

    if (videoVersions && videoVersions.length > 0) {
      videoVersions.forEach((version: { url: string; width: number; height: number }, index: number) => {
        downloads.push({
          label: index === 0 ? "HD Video" : `Video ${index + 1}`,
          url: version.url,
          quality: `${version.width}x${version.height}`,
          format: "mp4",
        });
      });
    }

    const thumbnail =
      post?.image_versions2?.candidates?.[0]?.url ||
      post?.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url ||
      "";

    if (downloads.length === 0) {
      throw new Error("No video found in this Threads post");
    }

    return {
      title: post?.caption?.text?.slice(0, 100) || "Threads Video",
      thumbnail,
      author: post?.user?.username,
      platform: "threads",
      downloads,
    };
  } catch (error) {
    throw new Error(
      `Threads download failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
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
            : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
