import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Music, Pause, Play, X, Loader2 } from "lucide-react";

interface MusicPlayerProps {
  themeSongUrl: string;
  themeSongTitle: string;
  isVisible: boolean;
  isDark?: boolean;
}

export default function MusicPlayer({ themeSongUrl, themeSongTitle, isVisible, isDark = false }: MusicPlayerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubePlayerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Helper Functions ---

  function normalizeThemeSongUrl(rawUrl: string): string {
    const trimmed = rawUrl?.trim();
    if (!trimmed) return '';
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
      const parsed = new URL(withScheme);
      const host = parsed.hostname.replace(/^www\./, '');
      const path = parsed.pathname;

      if (host === 'drive.google.com' || host === 'docs.google.com') {
        let fileId = '';
        const fileMatch = path.match(/\/file\/d\/([^/]+)/);
        if (fileMatch && fileMatch[1]) {
          fileId = fileMatch[1];
        }

        if (!fileId && parsed.searchParams.has('id')) {
          fileId = parsed.searchParams.get('id') || '';
        }

        if (fileId) {
          return `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      }

      return withScheme;
    } catch {
      return trimmed;
    }
  }

  function getYouTubeVideoId(url: string): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, '');

      if (host === 'youtu.be') {
        const id = parsed.pathname.replace('/', '');
        return id || null;
      }

      if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
        if (parsed.pathname === '/watch') {
          return parsed.searchParams.get('v');
        }
        if (parsed.pathname.startsWith('/embed/')) {
          return parsed.pathname.split('/embed/')[1] || null;
        }
        if (parsed.pathname.startsWith('/shorts/')) {
          return parsed.pathname.split('/shorts/')[1] || null;
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  const normalizedUrl = normalizeThemeSongUrl(themeSongUrl);
  const youtubeId = getYouTubeVideoId(normalizedUrl);
  const isYouTube = Boolean(youtubeId);
  const hasAudio = Boolean(normalizedUrl);

  // --- Logic ---

  // Handle Play/Pause Toggle
  const handleTogglePlay = async () => {
    if (isLoading) return;

    if (isYouTube) {
      if (!youtubePlayerRef.current) return;
      
      const playerState = youtubePlayerRef.current.getPlayerState();
      // 1 = Playing, 2 = Paused, 5 = Cued, -1 = Unstarted, 0 = Ended
      if (playerState === 1) {
        youtubePlayerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        youtubePlayerRef.current.playVideo();
        setIsPlaying(true);
      }
    } else {
      const audio = audioRef.current;
      if (!audio) return;

      if (audio.paused) {
        setIsLoading(true);
        try {
          await audio.play();
          setIsPlaying(true);
        } catch (err) {
          console.error("Audio play failed", err);
          setIsPlaying(false);
        } finally {
          setIsLoading(false);
        }
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    }
  };

  // Stop everything when source changes or unmounts
  useEffect(() => {
    setIsPlaying(false);
    
    // Stop HTML Audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Stop YouTube
    if (youtubePlayerRef.current && youtubePlayerRef.current.stopVideo) {
      youtubePlayerRef.current.stopVideo();
    }
  }, [normalizedUrl]);

  // Initialize YouTube Player
  useEffect(() => {
    if (!isYouTube || !youtubeId) return;

    const initPlayer = () => {
      // If player already exists, load new video
      if (youtubePlayerRef.current) {
        if (youtubePlayerRef.current.loadVideoById) {
            youtubePlayerRef.current.loadVideoById(youtubeId);
        }
        return;
      }

      // Initialize YT Player
      const onPlayerStateChange = (event: any) => {
        // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
        if (event.data === 1) {
            setIsPlaying(true);
            setIsLoading(false);
        } else if (event.data === 2 || event.data === 0) {
            setIsPlaying(false);
        } else if (event.data === 3) {
            setIsLoading(true);
        }
      };

      const onPlayerReady = () => {
         setIsLoading(false);
      };

      // Ensure container exists
      if (!document.getElementById('music-player-youtube-container')) return;

      youtubePlayerRef.current = new (window as any).YT.Player('music-player-youtube-container', {
        height: '0',
        width: '0',
        videoId: youtubeId,
        playerVars: { 
          'playsinline': 1, 
          'controls': 0, 
          'disablekb': 1,
          'fs': 0,
        },
        events: { 
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange 
        }
      });
    };

    if (!(window as any).YT) {
      // Load API if not present
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      
      (window as any).onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else {
      initPlayer();
    }
  }, [isYouTube, youtubeId]);

  // Initialize HTML Audio Listeners
  useEffect(() => {
    if (isYouTube) return;
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onLoadStart = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('canplay', onCanPlay);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('canplay', onCanPlay);
    };
  }, [isYouTube, normalizedUrl]);

  if (!isVisible || !hasAudio) return null;

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        bottom: "24px",
        left: "24px",
        zIndex: 2147483647, // Max Z-Index
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start", // Align to left since we are at bottom-left
        pointerEvents: "none", // Allow clicks to pass through around it
      }}
    >
        {/* Hidden Players */}
        {!isYouTube && (
            <audio ref={audioRef} src={normalizedUrl} preload="metadata" />
        )}
        {isYouTube && (
            <div id="music-player-youtube-container" style={{ display: 'none' }} />
        )}

      {/* Collapsed State */}
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

      {/* Expanded State */}
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

          {/* Track Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="text-xs font-bold truncate max-w-[140px]" style={{ color: isDark ? "#f3f4f6" : "#1f2937" }}>
              {themeSongTitle || "Theme Song"}
            </div>
            <div className="text-[10px] truncate max-w-[140px]" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
              {isPlaying ? "Playing..." : "Paused"}
            </div>
          </div>

          {/* Close Button */}
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
