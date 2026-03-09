import { useState } from "react";
import { FiClock, FiPlay, FiEye } from "react-icons/fi";

export function VideoCard({ video, featured = false }) {
  const [playing, setPlaying] = useState(false);

  const thumbnail = video.youtube_id
    ? `https://img.youtube.com/vi/${video.youtube_id}/maxresdefault.jpg`
    : "/placeholder.svg";

  return (
    <div
      className={`group overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg rounded-2xl cursor-pointer ${
        featured ? "border-2 border-primary/30" : ""
      }`}
      onClick={() => setPlaying(true)}
    >
      <div className="relative aspect-[19/9] overflow-hidden">
        {playing ? (
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${video.youtube_id}?autoplay=1`}
            title={video.title}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : (
          <>
            <img
              src={thumbnail}
              alt={video.title}
              className="w-full h-full object-cover transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              {/* <div className="w-16 h-16 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-2xl transform scale-90 transition-transform duration-300 group-hover:scale-100">
                <FiPlay className="h-7 w-7 text-black ml-1" />
              </div> */}
            </div>
            {video.duration && (
              <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-semibold px-2 py-0.5 rounded">
                {video.duration}
              </span>
            )}
          </>
        )}
      </div>

      <div className={`p-4 space-y-2 ${featured ? "p-6 space-y-3" : ""}`}>
        <h3
          className={`font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors ${
            featured ? "text-xl" : "text-base"
          }`}
        >
          {video.title}
        </h3>

        {featured && video.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {video.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {video.views !== undefined && (
            <div className="flex items-center gap-1">
              <FiEye className="h-3.5 w-3.5" />
              <span>{video.views.toLocaleString()} views</span>
            </div>
          )}
          {video.uploadedAt && (
            <div className="flex items-center gap-1">
              <FiClock className="h-3.5 w-3.5" />
              <span>{video.uploadedAt}</span>
            </div>
          )}
        </div>

        {!featured && video.channel && (
          <p className="text-sm text-muted-foreground font-medium">
            {video.channel}
          </p>
        )}
      </div>
    </div>
  );
}
