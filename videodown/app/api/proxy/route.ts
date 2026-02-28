import { NextRequest, NextResponse } from "next/server";

export async function HEAD(request: NextRequest) {
  // HEAD request to check if proxy URL is accessible
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get("url");

  if (!videoUrl) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const decodedUrl = decodeURIComponent(videoUrl);
    let absoluteUrl = decodedUrl;
    if (!decodedUrl.startsWith("http://") && !decodedUrl.startsWith("https://")) {
      absoluteUrl = `https://www.tikwm.com${decodedUrl.startsWith("/") ? "" : "/"}${decodedUrl}`;
    }

    try {
      new URL(absoluteUrl);
    } catch {
      return new NextResponse(null, { status: 400 });
    }

    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get("url");
  const filename = searchParams.get("filename") || "video.mp4";

  if (!videoUrl) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    // Decode the URL
    const decodedUrl = decodeURIComponent(videoUrl);

    // Validate and ensure absolute URL
    let absoluteUrl = decodedUrl;
    if (!decodedUrl.startsWith("http://") && !decodedUrl.startsWith("https://")) {
      // If it's a relative path, prepend tikwm base URL
      absoluteUrl = `https://www.tikwm.com${decodedUrl.startsWith("/") ? "" : "/"}${decodedUrl}`;
    }

    // Validate URL format
    try {
      new URL(absoluteUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format", url: absoluteUrl },
        { status: 400 }
      );
    }

    // Determine referer based on URL
    let referer = "https://www.tikwm.com/";
    if (absoluteUrl.includes("facebook.com") || absoluteUrl.includes("fbcdn.net")) {
      referer = "https://www.facebook.com/";
    } else if (absoluteUrl.includes("twitter.com") || absoluteUrl.includes("twimg.com")) {
      referer = "https://twitter.com/";
    } else if (absoluteUrl.includes("threads.net") || absoluteUrl.includes("cdninstagram.com")) {
      referer = "https://www.threads.net/";
    } else if (absoluteUrl.includes("tiktok.com") || absoluteUrl.includes("tiktokcdn")) {
      referer = "https://www.tiktok.com/";
    }

    // Sanitize filename
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

    // Use native fetch to stream the response
    const response = await fetch(absoluteUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: referer,
        Accept: "*/*",
        "Accept-Encoding": "identity",
        Connection: "keep-alive",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Source returned ${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "video/mp4";
    const contentLength = response.headers.get("content-length");

    // Build response headers
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    };

    if (contentLength) {
      headers["Content-Length"] = contentLength;
    }

    // Stream the response body directly
    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      {
        error: "Failed to download video",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
