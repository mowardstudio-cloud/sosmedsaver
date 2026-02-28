import { Platform } from "../types";

export function detectPlatform(url: string): Platform {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes("tiktok.com") || hostname.includes("vm.tiktok.com")) {
      return "tiktok";
    }
    if (hostname.includes("threads.net")) {
      return "threads";
    }
    if (
      hostname.includes("facebook.com") ||
      hostname.includes("fb.com") ||
      hostname.includes("fb.watch")
    ) {
      return "facebook";
    }
    if (
      hostname.includes("twitter.com") ||
      hostname.includes("x.com") ||
      hostname.includes("t.co")
    ) {
      return "twitter";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function getPlatformColor(platform: Platform): string {
  switch (platform) {
    case "tiktok":
      return "#ff0050";
    case "threads":
      return "#ffffff";
    case "facebook":
      return "#1877f2";
    case "twitter":
      return "#1da1f2";
    default:
      return "#ffffff";
  }
}

export function getPlatformName(platform: Platform): string {
  switch (platform) {
    case "tiktok":
      return "TikTok";
    case "threads":
      return "Threads";
    case "facebook":
      return "Facebook";
    case "twitter":
      return "Twitter / X";
    default:
      return "Unknown";
  }
}
