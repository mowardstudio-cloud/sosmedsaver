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

    // Determine referer
    let referer = "https://www.tikwm.com/";
    if (absoluteUrl.includes("tiktok.com") || absoluteUrl.includes("tiktokcdn")) {
      referer = "https://www.tiktok.com/";
    } else if (absoluteUrl.includes("cdninstagram.com") || absoluteUrl.includes("threads.net")) {
      referer = "https://www.threads.net/";
    } else if (absoluteUrl.includes("fbcdn.net") || absoluteUrl.includes("facebook.com")) {
      referer = "https://www.facebook.com/";
    } else if (absoluteUrl.includes("twimg.com")) {
      referer = "https://twitter.com/";
    }

    const response = await fetch(absoluteUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: referer,
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Image fetch failed: ${response.status}` },
        { status: response.status }
      );
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
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 500 }
    );
  }
}
