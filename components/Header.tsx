import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="w-full bg-transparent z-50 px-4 py-2 shrink-0 relative">
      <div className="max-w-7xl mx-auto flex items-center justify-center md:justify-start">
        {/* Logo Section */}
        <div className="flex items-center gap-2 p-1 pl-1.5 pr-3 backdrop-blur-md bg-white/30 rounded-full md:rounded-none border border-white/20 md:border-none shadow-sm md:shadow-none">
          <div className="w-6 h-6 sm:w-8 sm:h-8 relative flex-shrink-0 bg-white rounded-full p-0.5 md:bg-transparent">
            <img 
              src="/logo 500x500.png" 
              alt="YSP Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col justify-center leading-tight text-left">
            <span className="text-ysp-orange font-bold text-[10px] sm:text-sm md:text-base tracking-tight">
              Youth Service Philippines
            </span>
            <span className="text-gray-500 font-medium text-[8px] sm:text-xs italic">
              Tagum Chapter
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};