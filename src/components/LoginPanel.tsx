import React, { useState, useEffect } from 'react';
import { X, Lock, User, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import ForgotPasswordModal from './ForgotPasswordModal';

interface LoginPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (username: string, password: string) => Promise<void>;
  isDark: boolean;
}

export default function LoginPanel({ isOpen, onClose, onLogin, isDark }: LoginPanelProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);

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
    }
  }, [isOpen]);

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
      await onLogin(username, password);
    } catch {
      // Error handling is done in App.tsx
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setShowForgotPassword(true);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed flex items-center justify-center animate-[fadeIn_0.3s_ease]"
      style={{
        padding: '1rem',
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
        background: 'rgba(0, 0, 0, 0.15)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 10001,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        minHeight: '100vh',
      }}
      onClick={onClose}
    >
      {/* Enhanced Backdrop with Multiple Blur Layers */}
      <div 
        className="fixed"
        style={{ 
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100dvh',
          minHeight: '100vh',
          background: isDark 
            ? 'radial-gradient(circle at 50% 50%, rgba(246, 66, 31, 0.05), rgba(0, 0, 0, 0.2))' 
            : 'radial-gradient(circle at 50% 50%, rgba(246, 66, 31, 0.03), rgba(0, 0, 0, 0.12))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: -1 
        }}
      />
      
      {/* Animated Background Orbs */}
      <div className="fixed overflow-hidden pointer-events-none" style={{ 
        zIndex: -1,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        minHeight: '100vh',
      }}>
        <div 
          className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full opacity-20 blur-3xl animate-blob"
          style={{ 
            background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
            animationDelay: '0s',
            animationDuration: '7s'
          }}
        />
        <div 
          className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full opacity-20 blur-3xl animate-blob"
          style={{ 
            background: 'linear-gradient(135deg, #ee8724 0%, #fbcb29 100%)',
            animationDelay: '2s',
            animationDuration: '7s'
          }}
        />
        <div 
          className="absolute bottom-1/4 left-1/3 w-72 h-72 rounded-full opacity-20 blur-3xl animate-blob"
          style={{ 
            background: 'linear-gradient(135deg, #fbcb29 0%, #f6421f 100%)',
            animationDelay: '4s',
            animationDuration: '7s'
          }}
        />
      </div>
      
      {/* Login Panel Container */}
      <div 
        className="relative w-full my-auto animate-[scaleIn_0.3s_ease]"
        style={{
          maxWidth: '28rem',
          minHeight: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Gradient Glow */}
        <div 
          className="absolute -inset-1 rounded-3xl opacity-75 blur-xl pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 50%, #fbcb29 100%)',
          }}
        />
        
        {/* Main Card - Clean White Panel */}
        <div 
          className="relative rounded-2xl sm:rounded-3xl border-2 shadow-2xl overflow-hidden"
          style={{
            background: '#ffffff',
            borderColor: 'rgba(246, 66, 31, 0.2)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 40px rgba(246, 66, 31, 0.15)',
            maxHeight: '95vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Decorative Top Border Gradient */}
          <div 
            className="absolute top-0 left-0 right-0 h-1"
            style={{
              background: 'linear-gradient(90deg, #f6421f 0%, #ee8724 50%, #fbcb29 100%)',
              boxShadow: '0 4px 12px rgba(246, 66, 31, 0.4)'
            }}
          />

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
                <div className="relative group">
                  <input
                    id="username"
                    type="text"
                    value={username}
                    autoComplete="username"
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (errors.username) setErrors({ ...errors, username: undefined });
                    }}
                    placeholder="Enter your username"
                    className="w-full h-12 sm:h-13 px-4 rounded-xl border-2 transition-all duration-300 focus:outline-none text-sm sm:text-base text-gray-900"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.6) 100%)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      borderColor: errors.username ? '#ef4444' : 'rgba(246, 66, 31, 0.2)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.8)',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#ee8724';
                      e.target.style.boxShadow = '0 0 0 4px rgba(238, 135, 36, 0.15), 0 4px 12px rgba(238, 135, 36, 0.2)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onBlur={(e) => {
                      if (!errors.username) {
                        e.target.style.borderColor = 'rgba(246, 66, 31, 0.2)';
                        e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.8)';
                      }
                      e.target.style.transform = 'translateY(0)';
                    }}
                  />
                  {/* Decorative Gradient Border on Focus */}
                  <div 
                    className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
                    style={{
                      background: 'linear-gradient(135deg, #f6421f, #ee8724, #fbcb29)',
                      padding: '2px',
                      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      WebkitMaskComposite: 'xor',
                      maskComposite: 'exclude',
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
                <div className="relative group">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    autoComplete="current-password"
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors({ ...errors, password: undefined });
                    }}
                    placeholder="Enter your password"
                    className="w-full h-12 sm:h-13 pl-4 pr-12 rounded-xl border-2 transition-all duration-300 focus:outline-none text-sm sm:text-base text-gray-900"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.6) 100%)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      borderColor: errors.password ? '#ef4444' : 'rgba(246, 66, 31, 0.2)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.8)',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#ee8724';
                      e.target.style.boxShadow = '0 0 0 4px rgba(238, 135, 36, 0.15), 0 4px 12px rgba(238, 135, 36, 0.2)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onBlur={(e) => {
                      if (!errors.password) {
                        e.target.style.borderColor = 'rgba(246, 66, 31, 0.2)';
                        e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.8)';
                      }
                      e.target.style.transform = 'translateY(0)';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all duration-300 active:scale-95 hover:bg-black/5"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                    style={{
                      backdropFilter: 'blur(5px)'
                    }}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 transition-transform hover:scale-110" style={{ color: '#6b7280' }} />
                    ) : (
                      <Eye className="w-5 h-5 transition-transform hover:scale-110" style={{ color: '#6b7280' }} />
                    )}
                  </button>
                  {/* Decorative Gradient Border on Focus */}
                  <div 
                    className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
                    style={{
                      background: 'linear-gradient(135deg, #f6421f, #ee8724, #fbcb29)',
                      padding: '2px',
                      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      WebkitMaskComposite: 'xor',
                      maskComposite: 'exclude',
                    }}
                  />
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

              {/* Login Button with Enhanced Gradient */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 sm:h-13 rounded-xl text-white transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base relative overflow-hidden group"
                style={{
                  background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                  fontWeight: '600',
                  boxShadow: '0 8px 20px rgba(246, 66, 31, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              >
                {/* Shine Effect */}
                <div 
                  className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                  }}
                />
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
