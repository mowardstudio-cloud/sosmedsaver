import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

// Transparent 1x1 PNG fallback
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return new NextResponse(TRANSPARENT_PNG, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  }

  try {
    const decodedUrl = decodeURIComponent(imageUrl);

    // Validate URL
    let absoluteUrl = decodedUrl;
    if (!decodedUrl.startsWith("http://") && !decodedUrl.startsWith("https://")) {
      absoluteUrl = `https://www.tikwm.com${decodedUrl.startsWith("/") ? "" : "/"}${decodedUrl}`;
    }

    try {
      new URL(absoluteUrl);
    } catch {
      return new NextResponse(TRANSPARENT_PNG, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }

    // Determine referer based on URL
    let referer = "https://www.tiktok.com/";
    if (absoluteUrl.includes("tikwm.com")) {
      referer = "https://www.tikwm.com/";
    } else if (absoluteUrl.includes("cdninstagram.com") || absoluteUrl.includes("threads.net")) {
      referer = "https://www.threads.net/";
    } else if (absoluteUrl.includes("fbcdn.net") || absoluteUrl.includes("facebook.com")) {
      referer = "https://www.facebook.com/";
    } else if (absoluteUrl.includes("twimg.com")) {
      referer = "https://twitter.com/";
    }

    // Use axios (works better with TikTok CDN than native fetch)
    const response = await axios.get(absoluteUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: referer,
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const contentType = (response.headers["content-type"] as string) || "image/jpeg";
    const imageBuffer = Buffer.from(response.data);

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error instanceof Error ? error.message : error);
    // Return transparent pixel instead of error
    return new NextResponse(TRANSPARENT_PNG, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60",
      },
    });
  }
}
