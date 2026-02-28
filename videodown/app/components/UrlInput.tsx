"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Link2, ArrowRight, X, Clipboard, CheckCircle2 } from "lucide-react";
import { detectPlatform, isValidUrl } from "../lib/utils";
import PlatformIcon from "./PlatformIcon";
import { Platform } from "../types";

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export default function UrlInput({ onSubmit, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>("unknown");
  const [isFocused, setIsFocused] = useState(false);
  const [pasted, setPasted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (url && isValidUrl(url)) {
      setDetectedPlatform(detectPlatform(url));
    } else {
      setDetectedPlatform("unknown");
    }
  }, [url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed && !isLoading && isValidUrl(trimmed) && detectedPlatform !== "unknown") {
      onSubmit(trimmed);
    }
  };

  const handleClear = () => {
    setUrl("");
    setDetectedPlatform("unknown");
    setPasted(false);
    inputRef.current?.focus();
  };

  const setUrlAndMaybeSubmit = useCallback((text: string, autoSubmit = false) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setUrl(trimmed);
    setPasted(true);
    setTimeout(() => setPasted(false), 2000);

    // Auto-submit if it's a valid supported URL
    if (autoSubmit && isValidUrl(trimmed) && detectPlatform(trimmed) !== "unknown") {
      setTimeout(() => onSubmit(trimmed), 100);
    }
  }, [onSubmit]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlAndMaybeSubmit(text, true);
        inputRef.current?.focus();
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  // Handle paste event on input
  const handleInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (text) {
      e.preventDefault();
      setUrlAndMaybeSubmit(text, true);
    }
  };

  const isValid = url.trim() && isValidUrl(url) && detectedPlatform !== "unknown";
  const isInvalidUrl = url.trim() && isValidUrl(url) && detectedPlatform === "unknown";

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div
        className={`relative flex items-center rounded-2xl border transition-all duration-300 ${
          isFocused
            ? "border-white/30 bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
            : isInvalidUrl
            ? "border-red-500/30 bg-white/5"
            : "border-white/10 bg-white/5"
        }`}
      >
        {/* Left icon */}
        <div className="flex items-center pl-4 pr-3 flex-shrink-0">
          {detectedPlatform !== "unknown" ? (
            <div className="transition-all duration-200">
              <PlatformIcon platform={detectedPlatform} size={18} className="text-white/60" />
            </div>
          ) : (
            <Link2 size={18} className={isInvalidUrl ? "text-red-400/50" : "text-white/30"} />
          )}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onPaste={handleInputPaste}
          placeholder="Paste TikTok, Facebook, Twitter, or Threads URL..."
          className="flex-1 bg-transparent py-4 text-sm text-white placeholder-white/20 outline-none min-w-0"
          disabled={isLoading}
          autoComplete="off"
          spellCheck={false}
          aria-label="Video URL input"
        />

        {/* Right actions */}
        <div className="flex items-center gap-1 pr-2 flex-shrink-0">
          {url ? (
            <button
              type="button"
              onClick={handleClear}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/10 transition-all duration-150"
              tabIndex={-1}
              aria-label="Clear URL"
            >
              <X size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePaste}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/10 transition-all duration-150 text-xs"
              tabIndex={-1}
              aria-label="Paste from clipboard"
            >
              {pasted ? (
                <CheckCircle2 size={12} className="text-green-400" />
              ) : (
                <Clipboard size={12} />
              )}
              <span className="hidden sm:block">{pasted ? "Pasted!" : "Paste"}</span>
            </button>
          )}

          <button
            type="submit"
            disabled={!isValid || isLoading}
            className={`flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-medium transition-all duration-200 ${
              isValid && !isLoading
                ? "bg-white text-black hover:bg-white/90 cursor-pointer active:scale-95"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
            aria-label="Download video"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span className="hidden sm:block">Download</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Platform hint */}
      {isInvalidUrl && (
        <p className="mt-2 text-xs text-red-400/70 text-center animate-pulse">
          Unsupported platform. Use TikTok, Threads, Facebook, or Twitter/X URLs.
        </p>
      )}
    </form>
  );
}
