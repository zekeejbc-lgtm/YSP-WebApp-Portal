import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Lock, User, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import ForgotPasswordModal from './ForgotPasswordModal';

interface LoginPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (username: string, password: string, rememberMe: boolean) => Promise<void>;
  onContinueSession: () => Promise<void>;
  canContinueSession: boolean;
  continueUserName: string;
  isDark: boolean;
}

export default function LoginPanel({
  isOpen,
  onClose,
  onLogin,
  onContinueSession,
  canContinueSession,
  continueUserName,
  isDark,
}: LoginPanelProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [recentUsernames, setRecentUsernames] = useState<string[]>([]);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Refs for input elements to avoid re-renders during typing
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  
  // Memoized handlers to prevent re-creation on each render
  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    if (errors.username) {
      setErrors(prev => ({ ...prev, username: undefined }));
    }
  }, [errors.username]);
  
  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (errors.password) {
      setErrors(prev => ({ ...prev, password: undefined }));
    }
  }, [errors.password]);
  
  const toggleShowPassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);
  
  const handleRememberMeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRememberMe(e.target.checked);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUsername('');
      setPassword('');
      setShowPassword(false);
      setErrors({});
      setIsLoading(false);
      setShowForgotPassword(false);
      setRememberMe(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const rememberedFlag = localStorage.getItem('ysp_remember_username') === 'true';
      const rememberedUsername = localStorage.getItem('ysp_remembered_username') || '';
      const stored = localStorage.getItem('ysp_recent_usernames');
      const parsed = stored ? JSON.parse(stored) : [];
      const list = Array.isArray(parsed)
        ? parsed.filter((item) => typeof item === 'string' && item.trim().length > 0)
        : [];
      setRecentUsernames(list.slice(0, 5));
      if (rememberedFlag && rememberedUsername.trim()) {
        setUsername(rememberedUsername);
        setRememberMe(true);
      } else if (list.length > 0) {
        setUsername(list[0]);
        setRememberMe(false);
      }
    } catch {
      setRecentUsernames([]);
    }
  }, [isOpen]);

  const handleClearSavedUsernames = () => {
    try {
      localStorage.removeItem('ysp_recent_usernames');
      localStorage.removeItem('ysp_last_username');
    } catch {
      // Ignore storage failures.
    }
    setRecentUsernames([]);
    setUsername('');
  };

  const validateForm = () => {
    const newErrors: { username?: string; password?: string } = {};
    
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      // Call the login handler (now async with real backend)
      await onLogin(username, password, rememberMe);
    } catch {
      // Error handling is done in App.tsx
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setShowForgotPassword(true);
  };

  // Memoize static styles to prevent recalculation - must be before any conditional returns
  const backdropStyle = useMemo(() => ({
    padding: '1rem',
    paddingTop: 'calc(1rem + env(safe-area-inset-top))',
    paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10001,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100dvh',
    minHeight: '100vh',
  }), []);

  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed flex items-center justify-center"
      style={backdropStyle}
      onClick={onClose}
    >
      
      {/* Login Panel Container - Scrollable wrapper */}
      <div 
        className="relative w-full my-auto"
        style={{
          maxWidth: '28rem',
          maxHeight: 'calc(100dvh - 2rem)',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main Card - Clean White Panel */}
        <div 
          className="relative rounded-2xl sm:rounded-3xl border-2 shadow-2xl"
          style={{
            background: '#ffffff',
            borderColor: 'rgba(246, 66, 31, 0.3)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2.5 rounded-xl transition-all duration-300 hover:rotate-90 active:scale-95 group"
            style={{
              background: 'rgba(0, 0, 0, 0.05)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
            }}
            aria-label="Close login panel"
          >
            <X className="w-5 h-5 text-gray-600 group-hover:scale-110 transition-transform" />
          </button>

          {/* Header - Clean White with Logo */}
          <div className="relative px-6 py-6 sm:px-8 sm:py-7 text-center">
            {/* YSP Logo */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <ImageWithFallback
                  src="https://i.imgur.com/J4wddTW.png"
                  alt="YSP Logo"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover"
                  style={{
                    boxShadow: '0 8px 24px rgba(246, 66, 31, 0.3), 0 0 0 3px rgba(246, 66, 31, 0.1)',
                    border: '3px solid white'
                  }}
                />
              </div>
            </div>
            
            {/* Title - Orange Color */}
            <h2 
              className="mb-1.5"
              style={{
                fontFamily: 'var(--font-headings)',
                fontSize: 'clamp(1.5rem, 4vw, 1.875rem)',
                fontWeight: 'var(--font-weight-bold)',
                letterSpacing: '-0.02em',
                color: '#ee8724'
              }}
            >
              Welcome Back!
            </h2>
            <p className="text-gray-600 text-xs sm:text-sm" style={{ fontWeight: '500' }}>
              Youth Service Philippines Tagum Chapter
            </p>
          </div>

          {/* Form - Compact spacing */}
          <div>
            <form onSubmit={handleSubmit} className="px-6 pb-6 sm:px-8 sm:pb-8 space-y-4">
              {canContinueSession && (
                <div
                  className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3"
                  style={{
                    borderColor: 'rgba(246, 66, 31, 0.2)',
                    background: 'rgba(246, 66, 31, 0.06)',
                  }}
                >
                  <div>
                    <div className="text-xs text-gray-500" style={{ fontWeight: '600' }}>
                      Continue as
                    </div>
                    <div className="text-sm text-gray-800" style={{ fontWeight: '600' }}>
                      {continueUserName || 'Saved account'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsLoading(true);
                      try {
                        await onContinueSession();
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    className="px-3 py-2 rounded-lg text-white text-xs sm:text-sm transition-all duration-300 hover:shadow-lg active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                      fontWeight: '600',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      opacity: isLoading ? 0.7 : 1,
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Checking...' : 'Continue'}
                  </button>
                </div>
              )}
              {/* Username Field with Glass Effect */}
              <div className="space-y-2">
                <label 
                  htmlFor="username"
                  className="flex items-center gap-2 text-sm text-gray-700"
                  style={{ fontWeight: '600' }}
                >
                  <User className="w-4 h-4" style={{ color: '#ee8724' }} />
                  Username
                </label>
                {recentUsernames.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {recentUsernames.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setUsername(item)}
                        className="px-2.5 py-1 rounded-lg border text-xs sm:text-sm transition-all duration-200 hover:shadow-sm"
                        style={{
                          borderColor: 'rgba(246, 66, 31, 0.2)',
                          background: 'rgba(246, 66, 31, 0.06)',
                          color: '#ee8724',
                          fontWeight: '600',
                        }}
                      >
                        {item}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleClearSavedUsernames}
                      className="px-2.5 py-1 rounded-lg border text-xs sm:text-sm transition-all duration-200 hover:shadow-sm"
                      style={{
                        borderColor: 'rgba(0, 0, 0, 0.1)',
                        background: 'rgba(0, 0, 0, 0.04)',
                        color: '#6b7280',
                        fontWeight: '600',
                      }}
                    >
                      Clear saved
                    </button>
                  </div>
                )}
                <div className="relative">
                  <input
                    ref={usernameRef}
                    id="username"
                    type="text"
                    value={username}
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    onChange={handleUsernameChange}
                    placeholder="Enter your username"
                    className="w-full h-12 sm:h-13 px-4 rounded-xl border-2 text-sm sm:text-base text-gray-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    style={{
                      background: '#ffffff',
                      borderColor: errors.username ? '#ef4444' : 'rgba(246, 66, 31, 0.3)',
                      WebkitAppearance: 'none',
                      fontSize: '16px', // Prevents iOS zoom on focus
                    }}
                  />
                </div>
                {errors.username && (
                  <p className="flex items-center gap-1.5 mt-1.5 text-xs text-red-500 animate-[slideDown_0.2s_ease]">
                    <AlertCircle className="w-3 h-3" />
                    {errors.username}
                  </p>
                )}
              </div>

              {/* Password Field with Glass Effect */}
              <div className="space-y-2">
                <label 
                  htmlFor="password"
                  className="flex items-center gap-2 text-sm text-gray-700"
                  style={{ fontWeight: '600' }}
                >
                  <Lock className="w-4 h-4" style={{ color: '#ee8724' }} />
                  Password
                </label>
                <div className="relative">
                  <input
                    ref={passwordRef}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    onChange={handlePasswordChange}
                    placeholder="Enter your password"
                    className="w-full h-12 sm:h-13 pl-4 pr-12 rounded-xl border-2 text-sm sm:text-base text-gray-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    style={{
                      background: '#ffffff',
                      borderColor: errors.password ? '#ef4444' : 'rgba(246, 66, 31, 0.3)',
                      WebkitAppearance: 'none',
                      fontSize: '16px', // Prevents iOS zoom on focus
                    }}
                  />
                  <button
                    type="button"
                    onClick={toggleShowPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg active:scale-95 hover:bg-black/5"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" style={{ color: '#6b7280' }} />
                    ) : (
                      <Eye className="w-5 h-5" style={{ color: '#6b7280' }} />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="flex items-center gap-1.5 mt-1.5 text-xs text-red-500 animate-[slideDown_0.2s_ease]">
                    <AlertCircle className="w-3 h-3" />
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Forgot Password */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs sm:text-sm transition-all duration-300 hover:underline active:scale-95 group flex items-center gap-1"
                  style={{ 
                    color: '#ee8724',
                    fontWeight: '600'
                  }}
                >
                  Forgot password?
                  <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                </button>
              </div>

              {/* Remember Me */}
              <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={handleRememberMeChange}
                  className="h-4 w-4 rounded border-gray-300 accent-orange-500"
                />
                Remember username on this device
              </label>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 sm:h-13 rounded-xl text-white active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
                style={{
                  background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                  fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(246, 66, 31, 0.3)',
                }}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>Sign In</span>
                  </>
                )}
              </button>


            </form>
          </div>
        </div>
      </div>
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        isDark={isDark}
      />
    </div>
  );
}
