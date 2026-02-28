"use client";

export default function LoadingSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Platform badge skeleton */}
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-24 rounded-full shimmer" />
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {/* Video card skeleton */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden mb-4">
        {/* Thumbnail skeleton */}
        <div className="w-full aspect-video shimmer" />

        {/* Info skeleton */}
        <div className="p-5 space-y-3">
          <div className="h-4 w-3/4 rounded shimmer" />
          <div className="h-4 w-1/2 rounded shimmer" />
          <div className="flex gap-3 mt-2">
            <div className="h-3 w-20 rounded shimmer" />
            <div className="h-3 w-16 rounded shimmer" />
          </div>
        </div>
      </div>

      {/* Download options skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-28 rounded shimmer mb-3" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg shimmer" />
              <div className="space-y-2">
                <div className="h-3 w-32 rounded shimmer" />
                <div className="h-2 w-20 rounded shimmer" />
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
