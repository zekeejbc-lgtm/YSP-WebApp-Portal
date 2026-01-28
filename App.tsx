import React from 'react';
import { Header } from './components/Header';
import { MaintenanceHero } from './components/MaintenanceHero';

function App() {
  return (
    <div className="h-[100dvh] w-full bg-gray-50 flex flex-col font-sans relative overflow-x-hidden md:overflow-hidden">
      <Header />
      <MaintenanceHero />
      
      {/* Decorative background element */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-orange-300/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-orange-400/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
}

export default App;