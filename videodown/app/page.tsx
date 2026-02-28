"use client";

import { useState, useCallback } from "react";
import { AlertCircle, Zap, Shield, Download, RefreshCw } from "lucide-react";
import UrlInput from "./components/UrlInput";
import DownloadResult from "./components/DownloadResult";
import LoadingSkeleton from "./components/LoadingSkeleton";
import { TikTokIcon, ThreadsIcon, FacebookIcon, TwitterIcon } from "./components/PlatformIcon";
import { ApiResponse, VideoInfo } from "./types";

const SUPPORTED_PLATFORMS = [
  {
    name: "TikTok",
    icon: TikTokIcon,
    color: "#ff0050",
    description: "Videos & Audio",
  },
  {
    name: "Threads",
    icon: ThreadsIcon,
    color: "#ffffff",
    description: "Video Posts",
  },
  {
    name: "Facebook",
    icon: FacebookIcon,
    color: "#1877f2",
    description: "Public Videos",
  },
  {
    name: "Twitter / X",
    icon: TwitterIcon,
    color: "#1da1f2",
    description: "Video Tweets",
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Get your download links in seconds",
  },
  {
    icon: Shield,
    title: "No Watermark",
    description: "Clean videos without any branding",
  },
  {
    icon: Download,
    title: "Multiple Formats",
    description: "Choose from HD, SD, or audio only",
  },
];

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryUrl, setRetryUrl] = useState<string | null>(null);

  const handleDownload = useCallback(async (url: string) => {
    setIsLoading(true);
    setResult(null);
    setError(null);
    setRetryUrl(url);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s client timeout

      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data: ApiResponse = await response.json();

      if (data.success && data.data) {
        setResult(data.data);
        setRetryUrl(null);
      } else {
        setError(data.error || "Failed to fetch video information. Please try again.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Request timed out. The server is taking too long. Please try again.");
      } else {
        setError("Network error. Please check your connection and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRetry = () => {
    if (retryUrl) {
      handleDownload(retryUrl);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setRetryUrl(null);
  };

  const showContent = isLoading || result || error;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <button
          onClick={handleReset}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
            <Download size={14} className="text-black" />
          </div>
          <span className="text-sm font-semibold tracking-tight">VideoDown</span>
        </button>
        <nav className="hidden sm:flex items-center gap-6">
          <a href="#features" className="text-xs text-white/40 hover:text-white/70 transition-colors">
            Features
          </a>
          <a href="#platforms" className="text-xs text-white/40 hover:text-white/70 transition-colors">
            Platforms
          </a>
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {/* Hero section */}
        <section className="flex flex-col items-center justify-center px-6 pt-16 pb-12 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 mb-8 fade-in-up">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-white/50">Free • No Registration • No Watermark</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-5 fade-in-up-delay-1">
            <span className="gradient-text">Download Videos</span>
            <br />
            <span className="text-white/90">Without Watermark</span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-white/40 max-w-md mb-10 leading-relaxed fade-in-up-delay-2">
            Paste any TikTok, Threads, Facebook, or Twitter video URL and get
            clean, watermark-free downloads instantly.
          </p>

          {/* URL Input */}
          <div className="w-full max-w-2xl fade-in-up-delay-3">
            <UrlInput onSubmit={handleDownload} isLoading={isLoading} />
          </div>
        </section>

        {/* Result section */}
        {showContent && (
          <section className="px-6 pb-16">
            <div className="max-w-2xl mx-auto">
              {isLoading && <LoadingSkeleton />}

              {error && !isLoading && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5 fade-in-up">
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-400">Download Failed</p>
                    <p className="text-xs text-red-400/70 mt-1 break-words">{error}</p>
                    <div className="flex items-center gap-3 mt-3">
                      {retryUrl && (
                        <button
                          onClick={handleRetry}
                          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
                        >
                          <RefreshCw size={11} />
                          Try again
                        </button>
                      )}
                      <button
                        onClick={handleReset}
                        className="text-xs text-white/30 hover:text-white/60 transition-colors underline underline-offset-2"
                      >
                        New URL
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {result && !isLoading && (
                <div>
                  <DownloadResult data={result} />
                  <div className="mt-6 text-center">
                    <button
                      onClick={handleReset}
                      className="text-xs text-white/30 hover:text-white/60 transition-colors underline underline-offset-2"
                    >
                      Download another video
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Features section - only show when no result */}
        {!showContent && (
          <>
            <section id="features" className="px-6 py-16 border-t border-white/5">
              <div className="max-w-3xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {FEATURES.map((feature, index) => (
                    <div
                      key={feature.title}
                      className="flex flex-col items-center text-center p-6 rounded-2xl border border-white/5 bg-white/[0.03] hover:bg-white/5 hover:border-white/10 transition-all duration-200"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                        <feature.icon size={18} className="text-white/70" />
                      </div>
                      <h3 className="text-sm font-semibold text-white mb-2">{feature.title}</h3>
                      <p className="text-xs text-white/40 leading-relaxed">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Platforms section */}
            <section id="platforms" className="px-6 py-16 border-t border-white/5">
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-10">
                  <h2 className="text-xl font-semibold text-white mb-2">Supported Platforms</h2>
                  <p className="text-sm text-white/40">
                    Download from all major social media platforms
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {SUPPORTED_PLATFORMS.map((platform) => (
                    <div
                      key={platform.name}
                      className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-white/5 bg-white/[0.03] hover:bg-white/5 hover:border-white/10 transition-all duration-200 group cursor-default"
                    >
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200"
                        style={{ backgroundColor: `${platform.color}15` }}
                      >
                        <platform.icon
                          size={22}
                          className="transition-all duration-200"
                          style={{ color: platform.color }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-white">{platform.name}</p>
                        <p className="text-xs text-white/30 mt-0.5">{platform.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* How to use section */}
            <section className="px-6 py-16 border-t border-white/5">
              <div className="max-w-2xl mx-auto text-center">
                <h2 className="text-xl font-semibold text-white mb-2">How to Use</h2>
                <p className="text-sm text-white/40 mb-10">
                  Download your favorite videos in 3 simple steps
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {[
                    {
                      step: "01",
                      title: "Copy URL",
                      desc: "Copy the video URL from TikTok, Threads, Facebook, or Twitter",
                    },
                    {
                      step: "02",
                      title: "Paste & Submit",
                      desc: "Paste the URL — it auto-submits when a valid URL is detected",
                    },
                    {
                      step: "03",
                      title: "Download",
                      desc: "Choose your preferred quality and download the video",
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex flex-col items-center text-center">
                      <span className="text-3xl font-bold text-white/10 mb-3 font-mono">
                        {item.step}
                      </span>
                      <h3 className="text-sm font-semibold text-white mb-2">{item.title}</h3>
                      <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-white/5">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-white flex items-center justify-center">
              <Download size={10} className="text-black" />
            </div>
            <span className="text-xs text-white/30">VideoDown</span>
          </div>
          <p className="text-xs text-white/20 text-center">
            For personal use only. Respect copyright and platform terms of service.
          </p>
          <p className="text-xs text-white/20">
            © {new Date().getFullYear()} VideoDown
          </p>
        </div>
      </footer>
    </div>
  );
}
