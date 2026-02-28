import Link from "next/link";
import { Download, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
        <Download size={20} className="text-white/50" />
      </div>
      <h1 className="text-6xl font-bold text-white/10 mb-4 font-mono">404</h1>
      <h2 className="text-xl font-semibold text-white mb-2">Page Not Found</h2>
      <p className="text-sm text-white/40 mb-8 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
      >
        <Home size={14} />
        Back to Home
      </Link>
    </div>
  );
}
