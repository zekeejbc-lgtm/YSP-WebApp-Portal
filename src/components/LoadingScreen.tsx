import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";

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
}

export default function LoadingScreen({
  isDark = false,
  steps,
  onComplete,
  logoUrl = "https://i.imgur.com/J4wddTW.png",
}: LoadingScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [showDevInfo, setShowDevInfo] = useState(false);
  const [devClickCount, setDevClickCount] = useState(0);

  // Calculate overall progress
  const completedSteps = steps.filter(
    (s) => s.status === "success" || s.status === "error"
  ).length;
  // const progress = Math.min(Math.round((completedSteps / steps.length) * 100), 100);

  // Check if there are any errors
  const hasErrors = steps.some((s) => s.status === "error");
  const allComplete = steps.every(
    (s) => s.status === "success" || s.status === "error"
  );

  // Current loading step for display
  const currentStep = steps.find((s) => s.status === "loading") || 
                      steps.find((s) => s.status === "pending") ||
                      steps[steps.length - 1];

  // Get a user-friendly status message
  const getStatusMessage = () => {
    if (allComplete && !hasErrors) return "Ready";
    if (allComplete && hasErrors) return "Partially Loaded";
    
    switch (currentStep?.id) {
      case "init": return "Starting...";
      case "homepage": return "Syncing...";
      case "assets": return "Resources...";
      case "complete": return "Ready...";
      default: return "Loading...";
    }
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
    // Reset click count after 2 seconds
    setTimeout(() => setDevClickCount(0), 2000);
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden font-sans transition-opacity duration-500 ease-in-out ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      } ${
        isDark 
          ? "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black" 
          : "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-50 via-white to-slate-50"
      }`}
    >
      {/* Ambient Pulsing Gradient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[100px] opacity-20 animate-pulse ${
            isDark ? "bg-orange-600/30" : "bg-orange-400/30"
         }`} style={{ animationDuration: '3s' }} />
      </div>

      {/* Main Content Container - Centered & Mobile Optimized */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-sm px-6 pb-12">
        
        {/* Logo Container with Pulsing Shadow */}
        <div 
          className="relative mb-12 cursor-pointer transition-transform duration-700 active:scale-95"
          onClick={handleLogoClick}
        >
          {/* Intense Pulsing Orange Shadow */}
          <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-1000 ${
             !allComplete 
               ? "animate-pulse opacity-40 scale-110 bg-orange-500" 
               : "opacity-0 scale-100"
          }`} />
          
          {/* Logo & Ring Wrapper */}
          <div 
            className="relative w-28 h-28 md:w-32 md:h-32 mx-auto"
            style={{ width: '7rem', height: '7rem' }}
          >
             <img
               src={logoUrl}
               alt="YSP Logo"
               className="w-full h-full object-contain filter drop-shadow-xl z-20 relative p-1"
               style={{ maxWidth: '100%', maxHeight: '100%' }}
               draggable={false}
               onError={(e) => {
                 (e.target as HTMLImageElement).src =
                   "https://ui-avatars.com/api/?name=YSP&size=128&background=f6421f&color=fff";
               }}
             />
             
             {/* Dynamic Progress Ring */}
             {!allComplete && (
                <div className="absolute -inset-2 z-10">
                  <svg className="w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                    {/* Track */}
                    <circle
                      className={`${isDark ? "text-slate-800" : "text-slate-200"}`}
                      strokeWidth="3"
                      stroke="currentColor"
                      fill="transparent"
                      r="46"
                      cx="50"
                      cy="50"
                    />
                    {/* Progress Indicator */}
                    <circle
                      className="text-orange-500 transition-all duration-300 ease-in-out drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                      strokeWidth="3"
                      strokeDasharray={289}
                      strokeDashoffset={289 - (289 * (completedSteps / steps.length))}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="46"
                      cx="50"
                      cy="50"
                    />
                  </svg>
                </div>
             )}

             {/* Success/Error Indicator Badge */}
             {allComplete && (
               <div className={`absolute -bottom-1 -right-1 p-2 rounded-full shadow-lg z-30 animate-in zoom-in duration-300 ${
                  hasErrors ? "bg-amber-500 text-white" : "bg-green-500 text-white"
               }`}>
                 {hasErrors ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
               </div>
             )}
          </div>
        </div>

        {/* Brand Name & Status - Mobile First Typography */}
        <div className="text-center space-y-2 mb-8 w-full">
           <h1 className={`text-2xl md:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${
              isDark 
                ? "from-white via-orange-100 to-orange-200" 
                : "from-slate-900 via-slate-800 to-slate-900"
           }`}>
              Youth Service Philippines
           </h1>
           <div className="flex items-center justify-center gap-2">
             <div className={`h-[1px] w-8 ${isDark ? "bg-orange-500/50" : "bg-orange-500/30"}`} />
             <p className={`text-xs tracking-[0.2em] font-bold uppercase ${
                isDark ? "text-orange-500" : "text-orange-600"
             }`}>
                Tagum Chapter
             </p>
             <div className={`h-[1px] w-8 ${isDark ? "bg-orange-500/50" : "bg-orange-500/30"}`} />
           </div>
        </div>

        {/* Minimal Status Text */}
        <div className="h-6 flex items-center justify-center overflow-hidden">
           <p className={`text-sm font-medium transition-all duration-500 animate-pulse ${
              isDark ? "text-slate-500" : "text-slate-400"
           }`}>
              {getStatusMessage()}
           </p>
        </div>

      </div>

      {/* Footer safe area */}
      <div className={`absolute bottom-8 text-[10px] tracking-widest opacity-30 uppercase ${
        isDark ? "text-white" : "text-black"
      }`}>
         v{import.meta.env.VITE_APP_VERSION || '1.0.0'}
      </div>
    </div>
  );
}
