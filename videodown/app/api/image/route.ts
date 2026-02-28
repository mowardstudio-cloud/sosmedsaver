import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
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
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Determine referer and headers based on URL
    let referer = "https://www.tiktok.com/";
    let origin = "https://www.tiktok.com";

    if (absoluteUrl.includes("tikwm.com")) {
      referer = "https://www.tikwm.com/";
      origin = "https://www.tikwm.com";
    } else if (absoluteUrl.includes("cdninstagram.com") || absoluteUrl.includes("threads.net")) {
      referer = "https://www.threads.net/";
      origin = "https://www.threads.net";
    } else if (absoluteUrl.includes("fbcdn.net") || absoluteUrl.includes("facebook.com")) {
      referer = "https://www.facebook.com/";
      origin = "https://www.facebook.com";
    } else if (absoluteUrl.includes("twimg.com")) {
      referer = "https://twitter.com/";
      origin = "https://twitter.com";
    }

    const response = await fetch(absoluteUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: referer,
        Origin: origin,
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
      },
    });

    if (!response.ok) {
      // Return a transparent 1x1 pixel as fallback
      const transparentPixel = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
      );
      return new NextResponse(transparentPixel, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    // Return a transparent 1x1 pixel as fallback instead of error
    const transparentPixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    return new NextResponse(transparentPixel, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60",
      },
    });
  }
}
