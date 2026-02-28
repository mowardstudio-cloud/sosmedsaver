"use client";

import { useState } from "react";
import { Download, Music, Video, Clock, User, ExternalLink, Loader2, CheckCircle, AlertCircle, ImageOff } from "lucide-react";
import { VideoInfo, VideoQuality } from "../types";
import PlatformIcon from "./PlatformIcon";
import { getPlatformName } from "../lib/utils";

interface DownloadResultProps {
  data: VideoInfo;
}

// Thumbnail component with error handling
function ThumbnailImage({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (error) {
    return (
      <div className="w-full aspect-video bg-white/5 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-white/20">
          <ImageOff size={24} />
          <span className="text-xs">Thumbnail unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-black/50 overflow-hidden">
      {!loaded && (
        <div className="absolute inset-0 shimmer" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/image?url=${encodeURIComponent(src)}`}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-90" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
      {loaded && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      )}
    </div>
  );
}

function DownloadButton({ item, index, videoTitle }: { item: VideoQuality; index: number; videoTitle: string }) {
  const [status, setStatus] = useState<"idle" | "downloading" | "done" | "error">("idle");
  const isAudio = item.format === "mp3" || item.quality === "Audio";

  const handleDownload = async () => {
    if (status === "downloading") return;
    setStatus("downloading");

    try {
      // Generate a clean filename
      const ext = item.format || (isAudio ? "mp3" : "mp4");
      const cleanTitle = videoTitle
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .slice(0, 50) || "video";
      const filename = `${cleanTitle}_${item.quality}.${ext}`;

      // Use proxy API to force download
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(filename)}`;

      // Use anchor click for streaming download
      const a = document.createElement("a");
      a.href = proxyUrl;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setStatus("done");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      // Fallback: open in new tab
      window.open(item.url, "_blank");
      setStatus("idle");
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={status === "downloading"}
      className="group flex items-center justify-between w-full p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer disabled:cursor-wait"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/15 transition-colors">
          {isAudio ? (
            <Music size={18} className="text-white/70" />
          ) : (
            <Video size={18} className="text-white/70" />
          )}
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-white">{item.label}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {item.quality} {item.format ? `• ${item.format.toUpperCase()}` : ""}
            {item.size ? ` • ${item.size}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {status === "idle" && (
          <>
            <span className="text-xs text-white/40 hidden sm:block">Download</span>
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all duration-200">
              <Download size={14} />
            </div>
          </>
        )}
        {status === "downloading" && (
          <>
            <span className="text-xs text-white/40 hidden sm:block">Preparing...</span>
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Loader2 size={14} className="animate-spin text-white/60" />
            </div>
          </>
        )}
        {status === "done" && (
          <>
            <span className="text-xs text-green-400/70 hidden sm:block">Done!</span>
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle size={14} className="text-green-400" />
            </div>
          </>
        )}
        {status === "error" && (
          <>
            <span className="text-xs text-red-400/70 hidden sm:block">Failed</span>
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertCircle size={14} className="text-red-400" />
            </div>
          </>
        )}
      </div>
    </button>
  );
}

export default function DownloadResult({ data }: DownloadResultProps) {
  const platformName = getPlatformName(data.platform);

  return (
    <div className="w-full max-w-2xl mx-auto fade-in-up">
      {/* Platform badge */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10">
          <PlatformIcon platform={data.platform} size={14} />
          <span className="text-xs font-medium text-white/70">{platformName}</span>
        </div>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {/* Video info card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden mb-4">
        {/* Thumbnail */}
        {data.thumbnail && (
          <ThumbnailImage src={data.thumbnail} alt={data.title} />
        )}

        {/* Info */}
        <div className="p-5">
          <h3 className="text-base font-medium text-white leading-snug line-clamp-2 mb-3">
            {data.title}
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/40">
            {data.author && (
              <span className="flex items-center gap-1.5">
                <User size={12} />
                {data.author}
              </span>
            )}
            {data.duration && (
              <span className="flex items-center gap-1.5">
                <Clock size={12} />
                {data.duration}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <ExternalLink size={12} />
              {platformName}
            </span>
          </div>
        </div>
      </div>

      {/* Download options */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          Download Options
        </p>
        {data.downloads.map((item, index) => (
          <DownloadButton key={index} item={item} index={index} videoTitle={data.title} />
        ))}
      </div>
    </div>
  );
}
