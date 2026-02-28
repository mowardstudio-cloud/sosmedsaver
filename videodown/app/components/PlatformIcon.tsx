"use client";

import { CSSProperties } from "react";
import { Platform } from "../types";

interface IconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

interface PlatformIconProps extends IconProps {
  platform: Platform;
}

export function TikTokIcon({ size = 24, className = "", style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
    >
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
    </svg>
  );
}

export function ThreadsIcon({ size = 24, className = "", style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
    >
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 012.581.188v-.413c0-.951-.304-1.71-.904-2.26-.584-.534-1.454-.808-2.59-.815-1.044.007-1.87.26-2.456.752-.528.44-.82 1.04-.87 1.784l-2.04-.569c.13-1.25.7-2.32 1.694-3.18.99-.856 2.32-1.3 3.96-1.32 1.87.02 3.35.54 4.4 1.55 1.04 1.01 1.57 2.44 1.57 4.26v.413c.44.14.85.31 1.22.52 1.19.67 2.04 1.65 2.47 2.83.73 2.01.56 4.7-1.74 6.94-1.87 1.83-4.17 2.72-7.27 2.74zm.024-8.048c-.88.05-1.607.29-2.1.69-.44.36-.66.84-.63 1.37.03.56.32 1.03.84 1.37.57.37 1.33.55 2.16.51 1.1-.06 1.95-.47 2.52-1.2.56-.72.85-1.74.87-3.04a11.6 11.6 0 00-1.93-.17c-.58 0-1.14.03-1.73.47z" />
    </svg>
  );
}

export function FacebookIcon({ size = 24, className = "", style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function TwitterIcon({ size = 24, className = "", style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function PlatformIcon({ platform, size = 24, className = "", style }: PlatformIconProps) {
  switch (platform) {
    case "tiktok":
      return <TikTokIcon size={size} className={className} style={style} />;
    case "threads":
      return <ThreadsIcon size={size} className={className} style={style} />;
    case "facebook":
      return <FacebookIcon size={size} className={className} style={style} />;
    case "twitter":
      return <TwitterIcon size={size} className={className} style={style} />;
    default:
      return null;
  }
}
