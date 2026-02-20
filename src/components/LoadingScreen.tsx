import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle } from "lucide-react";

// Loading step status types
type StepStatus = "pending" | "loading" | "success" | "error";

interface LoadingStep {
  id: string;
  label: string;
  status: StepStatus;
  errorCode?: string;
  errorMessage?: string;
}

interface LoadingScreenProps {
  isDark?: boolean;
  steps: LoadingStep[];
  onComplete?: () => void;
  logoUrl?: string;
  appName?: string;
  showDebug?: boolean;
  statusPhrases?: string[];
}

// Extended loading phrases for dynamic text cycling
const LOADING_PHRASES = [
  "Initiating secure connection...",
  "Preparing the portal...",
  "Syncing Tagum Chapter data...",
  "Loading visual resources...",
  "Configuring dashboard...",
  "Organizing projects and events...",
  "Gathering community updates...",
  "Finalizing setup..."
];

export default function LoadingScreen({
  isDark = false,
  steps,
  onComplete,
  logoUrl = "https://i.imgur.com/J4wddTW.png",
  statusPhrases,
}: LoadingScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [showDevInfo, setShowDevInfo] = useState(false);
  const [devClickCount, setDevClickCount] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);

  // Check if there are any errors
  const hasErrors = steps.some((s) => s.status === "error");
  const allComplete = steps.every(
    (s) => s.status === "success" || s.status === "error"
  );
  const activePhrases = statusPhrases?.length ? statusPhrases : LOADING_PHRASES;

  // Rotate loading text every 2.5 seconds
  useEffect(() => {
    if (allComplete) return;
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % activePhrases.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [activePhrases.length, allComplete]);

  // Get a user-friendly status message
  const getStatusMessage = () => {
    if (allComplete && !hasErrors) return "Portal Ready";
    if (allComplete && hasErrors) return "Partially Loaded";
    
    const currentError = steps.find(s => s.status === "error");
    if (currentError) return currentError.errorMessage || "Encountered an issue";
    
    return activePhrases[phraseIndex];
  };

  // Handle fade out when complete
  useEffect(() => {
    if (allComplete) {
      const timer = setTimeout(() => {
        setFadeOut(true);
        if (onComplete) {
          setTimeout(onComplete, 500); // Allow fade animation to finish
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [allComplete, onComplete]);

  // Secret developer mode - click logo 5 times
  const handleLogoClick = () => {
    const newCount = devClickCount + 1;
    setDevClickCount(newCount);
    if (newCount >= 5) {
      setShowDevInfo(!showDevInfo);
      setDevClickCount(0);
    }
    setTimeout(() => setDevClickCount(0), 2000);
  };

  const overlay = (
    <div
      className={`fixed inset-0 z-[2147483647] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ease-in-out ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background: isDark ? "#0f172a" : "#f8fafc",
        zIndex: 2147483647,
      }}
    >
      {/* Exact Portal Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-200/40 dark:bg-orange-500/10 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-yellow-200/40 dark:bg-yellow-500/10 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-red-200/40 dark:bg-red-500/10 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
        <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-pink-200/40 dark:bg-pink-500/10 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob animation-delay-6000" />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full px-4 sm:px-6">
        
        {/* Dynamic Responsive Logo Container */}
        <div 
          className="relative mb-6 sm:mb-8 cursor-pointer transition-transform duration-700 active:scale-95 flex items-center justify-center"
          onClick={handleLogoClick}
        >
          {/* Logo Wrapper with Modest Sizing */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 mx-auto flex items-center justify-center transition-all duration-300">
             <img
               src={logoUrl}
               alt="YSP Logo"
               className={`w-full h-full object-contain filter drop-shadow-xl z-20 relative transition-all duration-700 ${!allComplete ? "animate-pulse" : ""}`}
               draggable={false}
               onError={(e) => {
                 (e.target as HTMLImageElement).src =
                   "https://ui-avatars.com/api/?name=YSP&size=256&background=f6421f&color=fff";
               }}
             />

             {/* Success/Error Indicator Badge */}
             {allComplete && (
               <div className={`absolute -bottom-1 -right-1 p-2 rounded-full shadow-lg z-30 animate-in zoom-in duration-300 ${
                  hasErrors ? "bg-amber-500 text-white" : "bg-green-500 text-white"
               }`}>
                 {hasErrors ? <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" /> : <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />}
               </div>
             )}
          </div>
        </div>

        {/* Brand Name & Dynamic Text */}
        <div className="text-center space-y-2 sm:space-y-3 mb-4 w-full px-4">
           <h1 
             className="text-xl sm:text-2xl md:text-3xl tracking-tight transition-all duration-300"
             style={{
               fontFamily: "var(--font-headings)",
               fontWeight: "var(--font-weight-bold)",
               color: "#f6421f",
               letterSpacing: "-0.02em",
             }}
           >
              Youth Service Philippines
           </h1>
           <div className="flex items-center justify-center gap-2 md:gap-3">
             <div className={`h-px w-8 sm:w-12 md:w-16 bg-linear-to-r from-transparent ${isDark ? "to-[#ee8724]/60" : "to-[#ee8724]/40"}`} />
             <p className="text-[10px] sm:text-xs md:text-sm tracking-[0.2em] font-bold uppercase text-[#ee8724] transition-all duration-300">
                Tagum Chapter
             </p>
             <div className={`h-px w-8 sm:w-12 md:w-16 bg-linear-to-l from-transparent ${isDark ? "to-[#ee8724]/60" : "to-[#ee8724]/40"}`} />
           </div>
        </div>

        {/* Status Text Cycler */}
        <div className="h-8 flex items-center justify-center overflow-hidden mt-2 sm:mt-4">
           <p className={`text-sm sm:text-base font-medium transition-opacity duration-500 animate-pulse text-center px-4 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {getStatusMessage()}
           </p>
        </div>

      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
