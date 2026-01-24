/**
 * =============================================================================
 * MUSIC PLAYER COMPONENT
 * =============================================================================
 * A simplified music player that:
 * - Always plays from LOCAL audio file (/assets/music/theme-song.mp3)
 * - Detects the song TITLE from the backend (themeSongTitle prop)
 * - Uses backend URL/title presence to determine if music should be enabled
 * 
 * This approach ensures reliable playback without external URL issues
 * (CORS, Google Drive blocking, YouTube embedding issues, etc.)
 * =============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Music, Pause, Play, X, Loader2 } from "lucide-react";

interface MusicPlayerProps {
  /** 
   * URL from backend - used ONLY to check if music is enabled 
   * (actual playback uses local file)
   */
  themeSongUrl: string;
  /** Song title from backend - displayed in the player UI */
  themeSongTitle: string;
  /** Whether the player should be visible */
  isVisible: boolean;
  /** Dark mode flag */
  isDark?: boolean;
}

// Local audio file path - this is always what gets played
const LOCAL_AUDIO_PATH = '/assets/music/theme-song.mp3';

export default function MusicPlayer({ 
  themeSongUrl, 
  themeSongTitle, 
  isVisible, 
  isDark = false 
}: MusicPlayerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if a theme song is configured in backend
  // Any non-empty URL or title from backend means music feature is enabled
  const hasThemeSongConfigured = Boolean(themeSongUrl?.trim() || themeSongTitle?.trim());

  // Display title: use backend title if available, fallback to default
  const displayTitle = themeSongTitle?.trim() || "Theme Song";

  // --- Play/Pause Handler ---
  const handleTogglePlay = async () => {
    if (isLoading) return;
    
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      setIsLoading(true);
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Audio play failed:", err);
        setIsPlaying(false);
      } finally {
        setIsLoading(false);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  // --- Audio Event Listeners ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onLoadStart = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      console.error("Audio load error - check if theme-song.mp3 exists in /public/assets/music/");
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
    };
  }, []);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  // Don't render if not visible or no theme song configured in backend
  if (!isVisible || !hasThemeSongConfigured) return null;

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        bottom: "24px",
        left: "24px",
        zIndex: 30, // Behind Sidebar (40-50) but above content
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        pointerEvents: "none", // Allow clicks to pass through around it
      }}
    >
      {/* Hidden Audio Element - Always uses local file */}
      <audio ref={audioRef} preload="auto">
        <source src={LOCAL_AUDIO_PATH} type="audio/mpeg" />
      </audio>

      {/* Collapsed State - Music Icon Button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 animate-in zoom-in fade-in slide-in-from-bottom-4"
          style={{
            background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
            color: "white",
            boxShadow: "0 4px 14px rgba(246, 66, 31, 0.4)",
            pointerEvents: "auto",
            cursor: "pointer",
          }}
          aria-label="Open music player"
        >
          <Music size={20} className={isPlaying ? "animate-pulse" : ""} />
        </button>
      )}

      {/* Expanded State - Full Player */}
      {isExpanded && (
        <div
          className="animate-in zoom-in fade-in slide-in-from-bottom-2 duration-200 h-14 flex items-center gap-3 pl-3 pr-5 min-w-[200px]"
          style={{
            background: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
            border: isDark ? "1px solid rgba(148, 163, 184, 0.2)" : "1px solid rgba(148, 163, 184, 0.35)",
            borderRadius: "9999px",
            boxShadow: "0 10px 40px -10px rgba(0,0,0,0.2)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            pointerEvents: "auto",
          }}
        >
          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={handleTogglePlay}
            disabled={isLoading}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-95"
            style={{
              background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
              color: "white",
              boxShadow: "0 4px 10px rgba(246, 66, 31, 0.3)",
              cursor: isLoading ? "wait" : "pointer",
            }}
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isPlaying ? (
              <Pause size={14} fill="currentColor" />
            ) : (
              <Play size={14} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          {/* Track Info - Title from Backend */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div 
              className="text-xs font-bold truncate max-w-[140px]" 
              style={{ color: isDark ? "#f3f4f6" : "#1f2937" }}
              title={displayTitle}
            >
              {displayTitle}
            </div>
            <div 
              className="text-[10px] truncate max-w-[140px]" 
              style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
            >
              {isPlaying ? "Playing..." : "Paused"}
            </div>
          </div>

          {/* Close/Minimize Button */}
          <button 
            onClick={() => setIsExpanded(false)}
            className="p-1.5 rounded-full transition-colors ml-1"
            style={{
              color: isDark ? "#9ca3af" : "#9ca3af", 
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)";
              e.currentTarget.style.color = isDark ? "#f3f4f6" : "#1f2937";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = isDark ? "#9ca3af" : "#9ca3af";
            }}
            aria-label="Minimize"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
