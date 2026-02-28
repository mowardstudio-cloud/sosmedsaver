import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

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

    // Validate that it's an absolute URL
    let absoluteUrl = decodedUrl;
    if (!decodedUrl.startsWith("http://") && !decodedUrl.startsWith("https://")) {
      // If it's a relative path, try to prepend tikwm base URL
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
    let referer = "https://www.tiktok.com/";
    if (absoluteUrl.includes("facebook.com") || absoluteUrl.includes("fbcdn.net")) {
      referer = "https://www.facebook.com/";
    } else if (absoluteUrl.includes("twitter.com") || absoluteUrl.includes("twimg.com")) {
      referer = "https://twitter.com/";
    } else if (absoluteUrl.includes("threads.net") || absoluteUrl.includes("cdninstagram.com")) {
      referer = "https://www.threads.net/";
    } else if (absoluteUrl.includes("tikwm.com")) {
      referer = "https://www.tikwm.com/";
    }

    // Fetch the video from the source
    const response = await axios.get(absoluteUrl, {
      responseType: "stream",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: referer,
        Accept: "*/*",
        "Accept-Encoding": "identity",
        Connection: "keep-alive",
        Range: "bytes=0-",
      },
      timeout: 120000,
      maxRedirects: 10,
    });

    const contentType =
      (response.headers["content-type"] as string) || "video/mp4";
    const contentLength = response.headers["content-length"] as string;

    // Sanitize filename
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

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

    // Stream the response
    const stream = response.data as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", resolve);
      stream.on("error", reject);
    });

    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
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
