import { useState } from 'react';
import { X, Mail, Phone, MapPin, ExternalLink, Edit2, Save, Upload, Trash2, Plus } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { toast } from 'sonner@2.0.3';

interface FounderModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  isAdmin: boolean;
}

// Social platform detection helper - detects platform from URL
const detectSocialPlatform = (url: string): { name: string; color: string; bgClass: string; textClass: string; icon: string } => {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.com') || urlLower.includes('fb.me')) {
    return { name: 'Facebook', color: '#1877F2', bgClass: 'bg-blue-100 dark:bg-blue-900/30', textClass: 'text-blue-600 dark:text-blue-400', icon: 'facebook' };
  }
  if (urlLower.includes('instagram.com') || urlLower.includes('instagr.am')) {
    return { name: 'Instagram', color: '#E4405F', bgClass: 'bg-pink-100 dark:bg-pink-900/30', textClass: 'text-pink-600 dark:text-pink-400', icon: 'instagram' };
  }
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return { name: 'X (Twitter)', color: '#000000', bgClass: 'bg-gray-100 dark:bg-gray-800', textClass: 'text-gray-900 dark:text-white', icon: 'twitter' };
  }
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return { name: 'YouTube', color: '#FF0000', bgClass: 'bg-red-100 dark:bg-red-900/30', textClass: 'text-red-600 dark:text-red-400', icon: 'youtube' };
  }
  if (urlLower.includes('tiktok.com')) {
    return { name: 'TikTok', color: '#000000', bgClass: 'bg-gray-100 dark:bg-gray-800', textClass: 'text-gray-900 dark:text-white', icon: 'tiktok' };
  }
  if (urlLower.includes('linkedin.com')) {
    return { name: 'LinkedIn', color: '#0A66C2', bgClass: 'bg-blue-100 dark:bg-blue-900/30', textClass: 'text-blue-700 dark:text-blue-400', icon: 'linkedin' };
  }
  if (urlLower.includes('discord.gg') || urlLower.includes('discord.com')) {
    return { name: 'Discord', color: '#5865F2', bgClass: 'bg-indigo-100 dark:bg-indigo-900/30', textClass: 'text-indigo-600 dark:text-indigo-400', icon: 'discord' };
  }
  if (urlLower.includes('t.me') || urlLower.includes('telegram.me') || urlLower.includes('telegram.org')) {
    return { name: 'Telegram', color: '#26A5E4', bgClass: 'bg-sky-100 dark:bg-sky-900/30', textClass: 'text-sky-600 dark:text-sky-400', icon: 'telegram' };
  }
  if (urlLower.includes('messenger.com') || urlLower.includes('m.me')) {
    return { name: 'Messenger', color: '#0084FF', bgClass: 'bg-blue-100 dark:bg-blue-900/30', textClass: 'text-blue-500 dark:text-blue-400', icon: 'messenger' };
  }
  if (urlLower.includes('wa.me') || urlLower.includes('whatsapp.com')) {
    return { name: 'WhatsApp', color: '#25D366', bgClass: 'bg-green-100 dark:bg-green-900/30', textClass: 'text-green-600 dark:text-green-400', icon: 'whatsapp' };
  }
  if (urlLower.includes('viber.com')) {
    return { name: 'Viber', color: '#7360F2', bgClass: 'bg-purple-100 dark:bg-purple-900/30', textClass: 'text-purple-600 dark:text-purple-400', icon: 'viber' };
  }
  if (urlLower.includes('github.com')) {
    return { name: 'GitHub', color: '#181717', bgClass: 'bg-gray-100 dark:bg-gray-800', textClass: 'text-gray-900 dark:text-white', icon: 'github' };
  }
  if (urlLower.includes('threads.net')) {
    return { name: 'Threads', color: '#000000', bgClass: 'bg-gray-100 dark:bg-gray-800', textClass: 'text-gray-900 dark:text-white', icon: 'threads' };
  }
  if (urlLower.includes('pinterest.com') || urlLower.includes('pin.it')) {
    return { name: 'Pinterest', color: '#E60023', bgClass: 'bg-red-100 dark:bg-red-900/30', textClass: 'text-red-600 dark:text-red-400', icon: 'pinterest' };
  }
  if (urlLower.includes('snapchat.com')) {
    return { name: 'Snapchat', color: '#FFFC00', bgClass: 'bg-yellow-100 dark:bg-yellow-900/30', textClass: 'text-yellow-600 dark:text-yellow-500', icon: 'snapchat' };
  }
  
  // Default for unknown URLs
  return { name: 'Website', color: '#6B7280', bgClass: 'bg-gray-100 dark:bg-gray-800', textClass: 'text-gray-600 dark:text-gray-400', icon: 'link' };
};

// Social icon component that renders platform-specific SVG icons
const SocialIcon = ({ platform, className = "w-5 h-5" }: { platform: string; className?: string }) => {
  const icons: Record<string, JSX.Element> = {
    facebook: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    instagram: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    twitter: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    youtube: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    linkedin: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    discord: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
      </svg>
    ),
    telegram: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    messenger: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M.001 11.639C.001 4.949 5.241 0 12.001 0S24 4.95 24 11.639c0 6.689-5.24 11.638-12 11.638-1.21 0-2.38-.16-3.47-.46a.96.96 0 00-.64.05l-2.39 1.05a.96.96 0 01-1.35-.85l-.07-2.14a.97.97 0 00-.32-.68A11.39 11.389 0 01.002 11.64zm8.32-2.19l-3.52 5.6c-.35.53.32 1.139.82.75l3.79-2.87c.26-.2.6-.2.87 0l2.8 2.1c.84.63 2.04.4 2.6-.48l3.52-5.6c.35-.53-.32-1.13-.82-.75l-3.79 2.87c-.25.2-.6.2-.86 0l-2.8-2.1a1.8 1.8 0 00-2.61.48z"/>
      </svg>
    ),
    whatsapp: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
    viber: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.398.002C9.473.028 5.331.344 3.014 2.467 1.294 4.182.628 6.633.528 9.682.428 12.733.256 18.456 5.373 19.908v2.238s-.036.906.563 1.089c.725.227 1.149-.466 1.84-1.213l1.266-1.439s4.389.365 6.179-.203c2.005-.639 2.932-2.139 2.932-4.956s-.072-4.156-2.003-4.845c-.818-.35-3.984-.755-6.179-.655-1.098.049-2.006.227-2.673.478l-.001.003c.625-.179 1.406-.311 2.343-.361 1.823-.101 4.354.215 5.213.496 1.42.506 1.469 1.853 1.469 3.884s-.582 3.412-2.016 3.869c-1.339.427-4.607.079-5.577.027l-2.378 2.442s-.067.063-.176.017c-.071-.031-.088-.107-.088-.107l.018-2.895s-3.746-.956-3.603-5.381c.093-2.879.566-4.866 2.014-6.304 1.819-1.668 5.381-1.928 7.081-1.95.184-.003.356-.004.515-.003h.018c2.656 0 5.908.725 7.742 2.105 2.018 1.582 2.006 4.085 2.006 4.085s.141 4.465-1.205 6.499c-.865 1.38-2.395 2.181-4.274 2.511-.035.009-.062.015-.062.015l.003.004c-.659.122-1.452.205-2.391.247-.096.005-.19.008-.283.011.035.118.077.229.127.331.161.31.415.56.728.729.584.313 1.245.465 1.876.587 1.059.202 2.093.271 3.089.201 1.104-.079 2.137-.328 3.027-.75 1.946-.936 3.183-2.737 3.651-5.26.443-2.409.219-5.411-.6-7.761-1.038-2.975-3.275-5.026-6.267-5.74-1.527-.367-3.232-.5-4.859-.484z"/>
      </svg>
    ),
    github: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
      </svg>
    ),
    threads: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.332-3.022.88-.73 2.108-1.146 3.457-1.17a10.37 10.37 0 012.24.212c-.062-.607-.2-1.093-.411-1.452-.322-.548-.88-.862-1.654-.934-.727-.066-1.434.083-1.985.417l-1.106-1.68c.858-.564 2.013-.868 3.249-.854 1.36.015 2.478.395 3.325 1.13.796.688 1.298 1.67 1.494 2.918.136.857.116 1.826-.059 2.879l.065.035c.924.505 1.69 1.2 2.216 2.012.793 1.222 1.093 2.705.843 4.178-.344 2.022-1.432 3.645-3.144 4.692C17.063 23.442 14.88 24 12.186 24z"/>
      </svg>
    ),
    pinterest: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/>
      </svg>
    ),
    snapchat: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.166.053C6.851.001 2.52 4.344 2.52 9.663v.108c0 2.405.706 3.93 1.3 5.138.375.762.728 1.481.728 2.12 0 .264-.073.485-.164.614-.193.274-.578.478-1.143.606-1.231.28-1.76.465-1.94.585-.267.178-.475.422-.573.673-.124.316-.14.692.065 1.096.35.693 1.226.96 2.034 1.194.483.14.936.27 1.227.434.375.21.505.423.588.66.117.337.127.744.058 1.247-.037.273-.09.572-.165.9-.155.682.151 1.151.501 1.387.485.328 1.104.377 1.545.377.356 0 .66-.035.885-.069.544-.08 1.027-.228 1.667-.376.43-.099.917-.21 1.528-.292.56-.076 1.106-.027 1.652.035.855.098 1.74.199 2.793-.026.96-.206 1.698-.676 2.324-1.15.423-.32.773-.585 1.095-.696.388-.133.848-.154 1.336-.092.593.075 1.168.236 1.736.398.556.158 1.13.321 1.713.359.468.031.909.002 1.283-.126.61-.21 1.05-.695 1.13-1.332.056-.444-.037-1.003-.359-1.666-.193-.399-.44-.724-.67-1.027-.24-.315-.464-.608-.589-.935a1.382 1.382 0 01-.084-.463c-.002-.204.04-.359.166-.52.2-.257.59-.451 1.197-.582.475-.102 1.13-.238 1.66-.586.482-.317 1.016-.883.818-1.65-.102-.396-.386-.773-.798-1.036-.234-.15-.438-.243-.763-.333a13.84 13.84 0 00-.838-.217c-.34-.084-.74-.185-1.039-.333-.286-.14-.514-.322-.651-.562a1.42 1.42 0 01-.123-.326c-.007-.033-.013-.061-.019-.089l-.003-.011c.186-.46.314-.89.402-1.297.17-.784.206-1.513.206-2.227v-.16c0-5.27-4.239-9.604-9.461-9.66L12.166.053z"/>
      </svg>
    ),
    link: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  };

  return icons[platform] || icons.link;
};

export default function FounderModal({ isOpen, onClose, isDark, isAdmin }: FounderModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  
  // Store original data for cancel functionality
  const initialData = {
    name: 'Juanquine Carlo R. Castro',
    nickname: 'a.k.a Wacky Racho',
    title: 'Founder & Visionary Leader',
    profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80',
    about: `Juanquine Carlo R. Castro, known affectionately as "Wacky Racho," is the visionary founder of Youth Service Philippines - Tagum Chapter. With an unwavering commitment to community service and youth empowerment, he established the organization to mobilize Filipino youth in creating meaningful social change across Tagum City and Davao del Norte.

His leadership philosophy centers on grassroots engagement, collaborative partnerships, and sustainable community development. Under his guidance, YSP Tagum Chapter has grown into a dynamic organization that touches thousands of lives through diverse programs spanning education, health, environment, and disaster response.`,
    background: `A native of Tagum City, Wacky Racho recognized early on the untapped potential of Filipino youth to drive social transformation. His journey in community service began during his college years, where he witnessed firsthand the challenges faced by marginalized communities.

Inspired by the Filipino spirit of "bayanihan" and driven by a deep sense of social responsibility, he founded YSP Tagum Chapter to create a platform where young people could channel their passion, skills, and energy into meaningful community service. His dedication to the organization's mission has inspired countless volunteers to join the movement.`,
    achievements: [
      'Founded YSP Tagum Chapter and established it as a leading youth service organization in Davao del Norte',
      'Led over 50+ community outreach programs serving thousands of beneficiaries',
      'Mobilized 200+ active youth volunteers committed to community service',
      'Established partnerships with local government units, NGOs, and private sector organizations',
      'Pioneered innovative approaches to youth engagement and community development',
      'Recipient of multiple recognitions for outstanding community service and youth leadership'
    ],
    organizationImpact: `Under Wacky Racho's leadership, YSP Tagum Chapter has made significant impacts across multiple sectors:

• Education: Provided tutoring, school supplies, and scholarship opportunities to 500+ students from low-income families
• Environment: Planted 1,000+ trees and conducted numerous coastal cleanup drives
• Health: Organized medical missions serving 2,000+ individuals in underserved communities
• Disaster Response: Delivered emergency assistance to families affected by natural calamities
• Leadership Development: Trained 300+ youth volunteers in civic engagement and community organizing

The organization continues to expand its reach and deepen its impact, guided by Wacky Racho's vision of a community where every young person is an active agent of positive change.`,
    philosophy: `"True leadership is not about personal glory, but about empowering others to discover and unleash their potential for the greater good. Every young person has the power to make a difference—we just need to provide the platform, support, and inspiration."`,
    socialLinks: [
      { url: 'https://www.facebook.com/YSPTagumChapter' }
    ],
    contact: {
      email: 'YSPTagumChapter@gmail.com',
      phone: '+63 917 123 4567',
      office: 'Tagum City, Davao del Norte, Philippines'
    }
  };

  const [founderData, setFounderData] = useState(initialData);
  const [savedData, setSavedData] = useState(initialData);

  if (!isOpen) return null;

  const handleSave = () => {
    setSavedData(founderData);
    setIsEditing(false);
    toast.success('Founder profile updated successfully');
  };

  const handleCancelEdit = () => {
    setFounderData(savedData);
    setIsEditing(false);
    toast.info('Changes discarded');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setFounderData({ ...founderData, profileImage: e.target?.result as string });
        toast.success('Profile image uploaded');
      };
      reader.readAsDataURL(file);
    }
  };

  const addAchievement = () => {
    setFounderData({ 
      ...founderData, 
      achievements: [...founderData.achievements, 'New Achievement'] 
    });
  };

  const updateAchievement = (index: number, value: string) => {
    const newAchievements = [...founderData.achievements];
    newAchievements[index] = value;
    setFounderData({ ...founderData, achievements: newAchievements });
  };

  const removeAchievement = (index: number) => {
    const newAchievements = founderData.achievements.filter((_, i) => i !== index);
    setFounderData({ ...founderData, achievements: newAchievements });
  };

  // Social Links functions
  const addSocialLink = () => {
    setFounderData({ 
      ...founderData, 
      socialLinks: [...founderData.socialLinks, { url: '' }] 
    });
  };

  const updateSocialLink = (index: number, url: string) => {
    const newSocialLinks = [...founderData.socialLinks];
    newSocialLinks[index] = { url };
    setFounderData({ ...founderData, socialLinks: newSocialLinks });
  };

  const removeSocialLink = (index: number) => {
    const newSocialLinks = founderData.socialLinks.filter((_, i) => i !== index);
    setFounderData({ ...founderData, socialLinks: newSocialLinks });
  };

  return (
    <div 
      className="fixed flex items-center justify-center p-4" 
      style={{ 
        zIndex: 9999,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
      }}
    >
      {/* Backdrop */}
      <div 
        className="absolute bg-black/60 backdrop-blur-sm"
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        className={`relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${
          isDark 
            ? 'bg-gray-900 border border-gray-700' 
            : 'bg-white border border-gray-200'
        }`}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: isDark ? '#4B5563 #1F2937' : '#D1D5DB #F3F4F6'
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <h2
            style={{
              fontFamily: 'var(--font-headings)',
              fontSize: '1.5rem',
              fontWeight: 'var(--font-weight-bold)',
              color: '#f6421f',
              letterSpacing: '-0.01em',
            }}
          >
            Founder Profile
          </h2>
          <div className="flex items-center gap-2">
            {isAdmin && isEditing && (
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                className="px-4 py-2 rounded-lg transition-all text-sm font-semibold flex items-center gap-1.5"
                style={{
                  background: isEditing 
                    ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' 
                    : 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                  color: 'white',
                  boxShadow: isEditing 
                    ? '0 4px 12px rgba(22, 163, 74, 0.4)' 
                    : '0 4px 12px rgba(246, 66, 31, 0.3)',
                  border: 'none',
                }}
                aria-label={isEditing ? "Save changes" : "Edit profile"}
              >
                {isEditing ? (
                  <>
                    <Save className="w-4 h-4" />
                    Save
                  </>
                ) : (
                  <>
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Profile Header */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Profile Image */}
            <div className="shrink-0">
              <ImageWithFallback
                src={founderData.profileImage}
                alt={founderData.name}
                className="w-32 h-32 md:w-40 md:h-40 rounded-xl object-cover border-4 border-[#f6421f] shadow-lg"
              />
              {isEditing && (
                <div className="mt-2">
                  <label className="flex items-center justify-center gap-2 px-3 py-2 bg-[#f6421f] hover:bg-[#ee8724] text-white rounded-lg cursor-pointer transition-colors text-sm">
                    <Upload className="w-4 h-4" />
                    Upload Image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">Max 5MB</p>
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="flex-1">
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={founderData.name}
                    onChange={(e) => setFounderData({ ...founderData, name: e.target.value })}
                    className="w-full px-3 py-2 mb-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    style={{ fontSize: '1.5rem', fontWeight: '600' }}
                  />
                  <input
                    type="text"
                    value={founderData.nickname}
                    onChange={(e) => setFounderData({ ...founderData, nickname: e.target.value })}
                    className="w-full px-3 py-2 mb-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  />
                  <input
                    type="text"
                    value={founderData.title}
                    onChange={(e) => setFounderData({ ...founderData, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  />
                </>
              ) : (
                <>
                  <h3
                    className="text-gray-900 dark:text-white mb-1"
                    style={{ fontSize: '1.5rem', fontWeight: '600' }}
                  >
                    {founderData.name}
                  </h3>
                  <p
                    className="text-gray-700 dark:text-gray-300 italic mb-2"
                    style={{ fontSize: '1rem', fontWeight: '500' }}
                  >
                    {founderData.nickname}
                  </p>
                  <p
                    className="text-[#ee8724] mb-4"
                    style={{ fontSize: '1.125rem', fontWeight: '600' }}
                  >
                    {founderData.title}
                  </p>
                </>
              )}

              {/* Social Links */}
              {isEditing ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600 dark:text-gray-400">Social Links</label>
                    <button
                      onClick={addSocialLink}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-[#f6421f] hover:bg-[#ee8724] text-white rounded-lg transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add Link
                    </button>
                  </div>
                  {founderData.socialLinks.map((link, index) => {
                    const platform = detectSocialPlatform(link.url);
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${platform.bgClass} shrink-0`}>
                          <SocialIcon platform={platform.icon} className={`w-4 h-4 ${platform.textClass}`} />
                        </div>
                        <input
                          type="url"
                          value={link.url}
                          onChange={(e) => updateSocialLink(index, e.target.value)}
                          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          placeholder="Enter social media URL (auto-detected)"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[70px]">
                          {platform.name}
                        </span>
                        <button
                          onClick={() => removeSocialLink(index)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 mt-4">
                  {founderData.socialLinks.map((link, index) => {
                    if (!link.url) return null;
                    const platform = detectSocialPlatform(link.url);
                    return (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`p-2 rounded-lg ${platform.bgClass} hover:opacity-80 transition-all`}
                        title={platform.name}
                      >
                        <SocialIcon platform={platform.icon} className={`w-5 h-5 ${platform.textClass}`} />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* About Section */}
          <div className="space-y-4">
            <h4
              style={{
                fontFamily: 'var(--font-headings)',
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#f6421f',
              }}
            >
              About
            </h4>
            {isEditing ? (
              <textarea
                value={founderData.about}
                onChange={(e) => setFounderData({ ...founderData, about: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[150px]"
                style={{ fontSize: '1rem', lineHeight: '1.625' }}
              />
            ) : (
              <p
                className="text-gray-800 dark:text-gray-100 text-justify whitespace-pre-line"
                style={{ fontSize: '1rem', lineHeight: '1.625', fontWeight: '500' }}
              >
                {founderData.about}
              </p>
            )}
          </div>

          {/* Background Section */}
          <div className="space-y-4">
            <h4
              style={{
                fontFamily: 'var(--font-headings)',
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#f6421f',
              }}
            >
              Background & Journey
            </h4>
            {isEditing ? (
              <textarea
                value={founderData.background}
                onChange={(e) => setFounderData({ ...founderData, background: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[150px]"
                style={{ fontSize: '1rem', lineHeight: '1.625' }}
              />
            ) : (
              <p
                className="text-gray-800 dark:text-gray-100 text-justify whitespace-pre-line"
                style={{ fontSize: '1rem', lineHeight: '1.625', fontWeight: '500' }}
              >
                {founderData.background}
              </p>
            )}
          </div>

          {/* Key Achievements Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4
                style={{
                  fontFamily: 'var(--font-headings)',
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: '#f6421f',
                }}
              >
                Key Achievements
              </h4>
              {isEditing && (
                <button
                  onClick={addAchievement}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-[#f6421f] hover:bg-[#ee8724] text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Achievement
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {founderData.achievements.map((achievement, index) => (
                <li key={index} className="flex gap-3">
                  {isEditing ? (
                    <>
                      <span className="text-[#f6421f] font-bold shrink-0">•</span>
                      <input
                        type="text"
                        value={achievement}
                        onChange={(e) => updateAchievement(index, e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        style={{ fontSize: '1rem' }}
                      />
                      <button
                        onClick={() => removeAchievement(index)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-[#f6421f] font-bold shrink-0">•</span>
                      <span
                        className="text-gray-800 dark:text-gray-100"
                        style={{ fontSize: '1rem', lineHeight: '1.625', fontWeight: '500' }}
                      >
                        {achievement}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Organization Impact Section */}
          <div className="space-y-4">
            <h4
              style={{
                fontFamily: 'var(--font-headings)',
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#f6421f',
              }}
            >
              Organizational Impact
            </h4>
            {isEditing ? (
              <textarea
                value={founderData.organizationImpact}
                onChange={(e) => setFounderData({ ...founderData, organizationImpact: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[200px]"
                style={{ fontSize: '1rem', lineHeight: '1.625' }}
              />
            ) : (
              <p
                className="text-gray-800 dark:text-gray-100 text-justify whitespace-pre-line"
                style={{ fontSize: '1rem', lineHeight: '1.625', fontWeight: '500' }}
              >
                {founderData.organizationImpact}
              </p>
            )}
          </div>

          {/* Philosophy Section */}
          <div className="space-y-4 p-4 md:p-6 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl">
            <h4
              style={{
                fontFamily: 'var(--font-headings)',
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#f6421f',
              }}
            >
              Leadership Philosophy
            </h4>
            {isEditing ? (
              <textarea
                value={founderData.philosophy}
                onChange={(e) => setFounderData({ ...founderData, philosophy: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[100px]"
                style={{ fontSize: '1rem', lineHeight: '1.625' }}
              />
            ) : (
              <p
                className="text-gray-900 dark:text-white italic text-center"
                style={{ fontSize: '1.125rem', lineHeight: '1.625', fontWeight: '500' }}
              >
                {founderData.philosophy}
              </p>
            )}
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h4
              style={{
                fontFamily: 'var(--font-headings)',
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#f6421f',
              }}
            >
              Contact Information
            </h4>
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={founderData.contact.email}
                    onChange={(e) => setFounderData({ 
                      ...founderData, 
                      contact: { ...founderData.contact, email: e.target.value }
                    })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={founderData.contact.phone}
                    onChange={(e) => setFounderData({ 
                      ...founderData, 
                      contact: { ...founderData.contact, phone: e.target.value }
                    })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Office Location</label>
                  <input
                    type="text"
                    value={founderData.contact.office}
                    onChange={(e) => setFounderData({ 
                      ...founderData, 
                      contact: { ...founderData.contact, office: e.target.value }
                    })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Email</p>
                    <a 
                      href={`mailto:${founderData.contact.email}`}
                      className="text-sm text-gray-900 dark:text-white hover:text-[#f6421f] dark:hover:text-[#f6421f] transition-colors truncate block"
                    >
                      {founderData.contact.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <Phone className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Phone</p>
                    <a 
                      href={`tel:${founderData.contact.phone}`}
                      className="text-sm text-gray-900 dark:text-white hover:text-[#f6421f] dark:hover:text-[#f6421f] transition-colors"
                    >
                      {founderData.contact.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg md:col-span-2">
                  <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Office Location</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {founderData.contact.office}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
