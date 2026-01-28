import React, { useState } from 'react';
import { Hammer, Facebook, Mail, Code, X, Quote } from 'lucide-react';

export const MaintenanceHero: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 text-center z-10 w-full pb-8 md:pb-0 pt-4 md:pt-0 h-full">
      <div className="w-full max-w-4xl flex flex-col items-center justify-center gap-3 sm:gap-4 md:gap-6 lg:gap-8 animate-fade-in-up">
        
        {/* Animated Icon */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-orange-200 blur-xl opacity-50 rounded-full animate-pulse"></div>
          <div className="relative bg-white p-3 sm:p-4 md:p-5 rounded-full shadow-lg border border-orange-100">
            <Hammer className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-ysp-orange animate-wiggle" />
          </div>
        </div>

        {/* Main Headings - Fully Responsive Typography */}
        <div className="space-y-1 sm:space-y-2 shrink-0 flex flex-col items-center">
          <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-black text-gray-800 tracking-tight animate-pulse mb-0.5 sm:mb-1">
            Kadali lang...
          </p>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-ysp-red tracking-tight leading-tight">
            We are currently under <br />
            <span className="gradient-text">Maintenance</span>
          </h1>
          
          <h2 className="text-xs sm:text-sm md:text-lg lg:text-xl font-bold text-ysp-orange opacity-90 max-w-xs sm:max-w-md md:max-w-2xl mx-auto">
            Shaping the Future to a Greater Society
          </h2>
        </div>

        {/* Action Buttons Group - Responsive Sizing */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 md:gap-6 py-2 sm:py-4 shrink-0">
          {/* Facebook */}
          <a 
            href="https://www.facebook.com/YSPTagumChapter"
            target="_blank"
            rel="noopener noreferrer"
            title="Visit our Facebook"
            className="p-2 sm:p-3 md:p-4 bg-[#1877F2] text-white rounded-full shadow-md hover:shadow-lg hover:scale-110 transition-all duration-300"
          >
            <Facebook className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </a>
          
          {/* Developer Button (Middle) */}
          <button
            onClick={() => setIsModalOpen(true)}
            title="Developer Info"
            className="p-2 sm:p-3 md:p-4 bg-gray-800 text-white rounded-full shadow-md hover:shadow-lg hover:scale-110 transition-all duration-300"
          >
            <Code className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </button>

          {/* Email - UPDATED: Direct Gmail Link */}
          <a 
            // Changed from 'mailto:' to a direct Gmail compose URL to force open Gmail in browser
            href="https://mail.google.com/mail/?view=cm&fs=1&to=ysptagumchapter%2Bmaintenance@gmail.com&su=Inquiry%20regarding%20the%20maintenance" 
            target="_blank"
            rel="noopener noreferrer"
            title="Send us an email via Gmail"
            className="p-2 sm:p-3 md:p-4 bg-white text-ysp-red border-2 border-gray-100 hover:border-ysp-orange hover:text-ysp-orange rounded-full shadow-md hover:shadow-lg hover:scale-110 transition-all duration-300"
          >
            <Mail className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </a>
        </div>

        {/* Footer */}
        <div className="text-[10px] sm:text-xs md:text-sm text-gray-400 shrink-0 mt-2 sm:mt-4">
          &copy; 2025 Youth Service Philippines - Tagum Chapter. All rights reserved.
        </div>
      </div>

      {/* Developer Modal - Responsive & Minimal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={() => setIsModalOpen(false)}>
          <div 
            className="bg-white rounded-3xl shadow-2xl w-full max-w-[280px] sm:max-w-[320px] p-5 sm:p-6 relative animate-scale-up border border-white/50 max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 hover:bg-gray-100 p-1.5 rounded-full z-20"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center text-center pt-2">
              {/* Profile Image - Fixed Alignment */}
              <div className="relative mb-4 group">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-50 shadow-lg ring-4 ring-white overflow-hidden transform transition-transform group-hover:scale-105">
                    <img 
                        src="https://i.imgur.com/OGZmY9F.jpeg" 
                        alt="Ezequiel John B. Crisostomo" 
                        className="w-full h-full object-cover object-center"
                        loading="eager"
                    />
                </div>
                <div className="absolute bottom-1 right-1 w-4 h-4 sm:w-5 sm:h-5 bg-green-500 border-2 border-white rounded-full shadow-sm" title="Online"></div>
              </div>

              <div className="space-y-0.5 w-full mb-5">
                <p className="text-[9px] sm:text-[10px] font-bold text-ysp-orange uppercase tracking-wider mb-1">Developed By</p>
                <h3 className="text-gray-900 font-bold text-sm sm:text-base leading-tight">
                    Ezequiel John B. Crisostomo
                </h3>
                <p className="text-gray-500 text-[9px] sm:text-[10px] font-medium">
                  Membership and Internal Affairs Officer
                </p>
              </div>

              {/* Message Quote */}
              <div className="relative bg-orange-50/60 rounded-2xl p-4 mb-5 border border-orange-100/50">
                 <Quote size={20} className="text-ysp-orange/20 absolute -top-2 left-3 bg-white px-0.5" fill="currentColor" />
                 <p className="text-gray-600 text-xs italic leading-relaxed text-center">
                   "We're currently updating YSP Portal to give you a better experience. We’ll be back online shortly. Thank you for your patience!"
                 </p>
              </div>

              <a 
                href="https://www.facebook.com/ezequieljohn.bengilcrisostomo"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-xl font-semibold text-xs transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                <Facebook size={16} />
                Contact Dev
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        .animate-wiggle {
          animation: wiggle 2s ease-in-out infinite;
        }
        @keyframes scale-up {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-scale-up {
          animation: scale-up 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .animate-fade-in {
            animation: fade-in 0.2s ease-out forwards;
        }
      `}</style>
    </main>
  );
};