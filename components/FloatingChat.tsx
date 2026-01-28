import React from 'react';
import { MessageSquareText } from 'lucide-react';

export const FloatingChat: React.FC = () => {
  return (
    <button className="fixed bottom-6 right-6 w-14 h-14 bg-ysp-orange text-white rounded-full shadow-lg flex items-center justify-center hover:bg-orange-600 transition-colors z-50 animate-bounce hover:animate-none">
      <MessageSquareText size={28} />
    </button>
  );
};