import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wifi, 
  WifiOff, 
  Settings, 
  Trash2, 
  Activity, 
  Database, 
  AlertCircle,
  X,
  RefreshCw,
  Clock,
  Zap,
  Server,
  Bug,
  ChevronRight,
  Minimize2,
  MemoryStick,
  Gauge,
  RotateCcw
} from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

interface DebugLog {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: Date;
}

export function DebugPill() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isExpanded, setIsExpanded] = useState(false); // Start collapsed for smaller size
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 20, y: 80 }); // Move to top-left corner
  const [ping, setPing] = useState<number | null>(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const [errors, setErrors] = useState<DebugLog[]>([]);
  const [cacheSize, setCacheSize] = useState('0 KB');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [fps, setFps] = useState(60);
  const [memoryUsage, setMemoryUsage] = useState('N/A');
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const pillStartPos = useRef({ x: 0, y: 0 });

  // Console log to confirm it's rendering
  useEffect(() => {
    console.log('🔴 DEBUG PILL IS RENDERING!!! 🔴');
    console.log('Position:', position);
    console.log('Z-index: 2147483647');
  }, []);

  // Load saved position from localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem('ysp-debug-pill-position');
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        setPosition(parsed);
      } catch (e) {
        console.error('Failed to parse saved position:', e);
      }
    }
  }, []);

  // Save position to localStorage
  useEffect(() => {
    localStorage.setItem('ysp-debug-pill-position', JSON.stringify(position));
  }, [position]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addLog('success', 'Internet connection restored');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      addLog('error', 'Internet connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Ping test
  useEffect(() => {
    const measurePing = async () => {
      const start = performance.now();
      try {
        await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors' });
        const end = performance.now();
        setPing(Math.round(end - start));
        setBackendConnected(true);
      } catch (error) {
        setPing(null);
        setBackendConnected(false);
      }
    };

    measurePing();
    const interval = setInterval(measurePing, 5000);

    return () => clearInterval(interval);
  }, []);

  // Calculate cache size
  useEffect(() => {
    const calculateCacheSize = () => {
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length + key.length;
        }
      }
      const kb = (totalSize / 1024).toFixed(2);
      setCacheSize(`${kb} KB`);
    };

    calculateCacheSize();
    const interval = setInterval(calculateCacheSize, 10000);

    return () => clearInterval(interval);
  }, []);

  // Monitor errors
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      addLog('error', `${event.message} at ${event.filename}:${event.lineno}`);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      addLog('error', `Unhandled Promise: ${event.reason}`);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Monitor FPS
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationId: number;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        setFps(Math.round((frameCount * 1000) / (currentTime - lastTime)));
        frameCount = 0;
        lastTime = currentTime;
      }
      
      animationId = requestAnimationFrame(measureFPS);
    };

    animationId = requestAnimationFrame(measureFPS);
    return () => cancelAnimationFrame(animationId);
  }, []);

  // Monitor Memory Usage (if available)
  useEffect(() => {
    const updateMemory = () => {
      if ('memory' in performance && (performance as any).memory) {
        const mem = (performance as any).memory;
        const used = (mem.usedJSHeapSize / 1048576).toFixed(2);
        const total = (mem.totalJSHeapSize / 1048576).toFixed(2);
        setMemoryUsage(`${used} / ${total} MB`);
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, 2000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (type: DebugLog['type'], message: string) => {
    const newLog: DebugLog = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: new Date()
    };
    setErrors(prev => [newLog, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) {
      return;
    }
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    pillStartPos.current = { x: position.x, y: position.y };
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragStartPos.current.x;
      const deltaY = e.clientY - dragStartPos.current.y;

      const newX = pillStartPos.current.x + deltaX;
      const newY = pillStartPos.current.y + deltaY;

      // Keep within viewport bounds
      const maxX = window.innerWidth - (isExpanded ? 400 : 200);
      const maxY = window.innerHeight - 60;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, isExpanded]);

  const clearCache = () => {
    const keysToKeep = ['ysp-debug-pill-position', 'ysp-demo-user'];
    const allKeys = Object.keys(localStorage);
    
    allKeys.forEach(key => {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    });
    
    setCacheSize('0 KB');
    addLog('success', 'Cache cleared successfully');
  };

  const clearLogs = () => {
    setErrors([]);
    addLog('info', 'Logs cleared');
  };

  const reloadPage = () => {
    window.location.reload();
  };

  const resetPosition = () => {
    setPosition({ x: 20, y: 20 });
    addLog('info', 'Position reset to default');
  };

  const getPingColor = () => {
    if (!ping) return 'text-red-500';
    if (ping < 100) return 'text-green-500';
    if (ping < 300) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getLogIcon = (type: DebugLog['type']) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'success': return <Zap className="w-4 h-4 text-green-500" />;
      default: return <Bug className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <motion.div
      ref={dragRef}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        x: position.x,
        y: position.y,
        width: isExpanded ? 420 : 'auto'
      }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="fixed z-[2147483647] select-none"
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        top: 0,
        left: 0,
        pointerEvents: 'auto'
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="relative">
        {/* ULTRA VISIBLE INDICATOR */}
        <div className="absolute -inset-1 bg-red-500/20 rounded-full animate-pulse blur-lg" />
        
        {/* Collapsed Pill */}
        <motion.div
          layout
          className={`
            relative backdrop-blur-xl bg-gradient-to-r
            ${isOnline 
              ? 'from-green-500/90 to-emerald-500/90 border-green-400' 
              : 'from-red-500/90 to-orange-500/90 border-red-400'
            }
            border-2 rounded-full shadow-2xl
            ${isExpanded ? 'rounded-b-none' : ''}
          `}
          style={{
            boxShadow: isOnline 
              ? '0 0 20px rgba(34, 197, 94, 0.6), 0 0 40px rgba(34, 197, 94, 0.4)' 
              : '0 0 20px rgba(239, 68, 68, 0.6), 0 0 40px rgba(239, 68, 68, 0.4)'
          }}
        >
          <div className="flex items-center gap-2 px-3 py-1.5">
            {/* Status Indicator */}
            <div className="relative">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-white drop-shadow-lg" />
              ) : (
                <WifiOff className="w-4 h-4 text-white drop-shadow-lg" />
              )}
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                  isOnline ? 'bg-white' : 'bg-yellow-300'
                }`}
              />
            </div>

            {/* Status Text */}
            <div className="flex flex-col" data-no-drag>
              <span className="text-xs font-bold text-white drop-shadow-lg">
                {isOnline ? 'Online' : 'Offline'}
              </span>
              {ping !== null && isOnline && (
                <span className="text-[10px] font-semibold text-white/90 drop-shadow">
                  {ping}ms
                </span>
              )}
            </div>

            {/* Expand Button */}
            <button
              data-no-drag
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <Minimize2 className="w-3.5 h-3.5 text-white drop-shadow-lg" />
              ) : (
                <Settings className="w-3.5 h-3.5 text-white drop-shadow-lg" />
              )}
            </button>
          </div>
        </motion.div>

        {/* Expanded Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full left-0 right-0 backdrop-blur-xl bg-gray-900/95 border-2 border-t-0 border-gray-700/50 rounded-b-2xl shadow-2xl overflow-hidden"
              data-no-drag
            >
              <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
                {/* System Status */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    System Status
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 rounded-lg p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <Server className={backendConnected ? 'w-3.5 h-3.5 text-green-500' : 'w-3.5 h-3.5 text-red-500'} />
                        <span className="text-xs text-gray-400">Backend</span>
                      </div>
                      <span className={`text-xs font-medium ${backendConnected ? 'text-green-400' : 'text-red-400'}`}>
                        {backendConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className={`w-3.5 h-3.5 ${getPingColor()}`} />
                        <span className="text-xs text-gray-400">Latency</span>
                      </div>
                      <span className={`text-xs font-medium ${getPingColor()}`}>
                        {ping !== null ? `${ping}ms` : 'N/A'}
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <Database className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs text-gray-400">Cache</span>
                      </div>
                      <span className="text-xs font-medium text-blue-400">
                        {cacheSize}
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                        <span className="text-xs text-gray-400">Errors</span>
                      </div>
                      <span className="text-xs font-medium text-orange-400">
                        {errors.filter(e => e.type === 'error').length}
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <Gauge className={`w-3.5 h-3.5 ${fps >= 55 ? 'text-green-500' : fps >= 30 ? 'text-yellow-500' : 'text-red-500'}`} />
                        <span className="text-xs text-gray-400">FPS</span>
                      </div>
                      <span className={`text-xs font-medium ${fps >= 55 ? 'text-green-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {fps} fps
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <MemoryStick className="w-3.5 h-3.5 text-purple-500" />
                        <span className="text-xs text-gray-400">Memory</span>
                      </div>
                      <span className="text-xs font-medium text-purple-400">
                        {memoryUsage}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Actions
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={clearCache}
                      className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg transition-colors text-xs text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear Cache
                    </button>
                    <button
                      onClick={reloadPage}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg transition-colors text-xs text-blue-400"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Reload Page
                    </button>
                    <button
                      onClick={clearLogs}
                      className="flex items-center gap-2 px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-lg transition-colors text-xs text-yellow-400"
                    >
                      <X className="w-3.5 h-3.5" />
                      Clear Logs
                    </button>
                    <button
                      onClick={resetPosition}
                      className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg transition-colors text-xs text-green-400"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Position
                    </button>
                  </div>
                </div>

                {/* Recent Logs */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Bug className="w-4 h-4" />
                    Recent Logs ({errors.length})
                  </h3>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {errors.length === 0 ? (
                      <div className="text-xs text-gray-500 text-center py-4">
                        No logs yet
                      </div>
                    ) : (
                      errors.slice(0, 10).map(log => (
                        <div
                          key={log.id}
                          className="bg-white/5 rounded-lg p-2 flex items-start gap-2"
                        >
                          {getLogIcon(log.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-300 line-clamp-2">
                              {log.message}
                            </p>
                            <span className="text-[10px] text-gray-500">
                              {log.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="pt-2 border-t border-white/10">
                  <p className="text-[10px] text-gray-500 text-center">
                    Last updated: {lastUpdate.toLocaleTimeString()}
                  </p>
                  <p className="text-[10px] text-gray-600 text-center mt-1">
                    Drag to move • Double-click to reset position
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}