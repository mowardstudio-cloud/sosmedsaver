export type Platform = "tiktok" | "threads" | "facebook" | "twitter" | "unknown";

export interface VideoQuality {
  label: string;
  url: string;
  quality: string;
  format?: string;
  size?: string;
}

export interface VideoInfo {
  title: string;
  thumbnail: string;
  duration?: string;
  author?: string;
  platform: Platform;
  downloads: VideoQuality[];
}

export interface ApiResponse {
  success: boolean;
  data?: VideoInfo;
  error?: string;
}
