/**
 * Utility helper functions extracted from App.tsx
 * These are pure functions with no React dependencies.
 */

/**
 * Suggests link button text based on the URL domain
 * @param url The URL to analyze
 * @returns Suggested button text based on the domain
 */
export function suggestLinkTextFromUrl(url: string): string {
  if (!url) return '';
  
  try {
    // Clean up the URL
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    
    const urlObj = new URL(cleanUrl);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Domain to button text mapping
    const domainMappings: { [key: string]: string } = {
      // Social Media
      'facebook.com': 'View on Facebook',
      'www.facebook.com': 'View on Facebook',
      'fb.com': 'View on Facebook',
      'fb.watch': 'Watch on Facebook',
      'instagram.com': 'View on Instagram',
      'www.instagram.com': 'View on Instagram',
      'twitter.com': 'View on Twitter',
      'www.twitter.com': 'View on Twitter',
      'x.com': 'View on X',
      'www.x.com': 'View on X',
      'linkedin.com': 'View on LinkedIn',
      'www.linkedin.com': 'View on LinkedIn',
      'tiktok.com': 'Watch on TikTok',
      'www.tiktok.com': 'Watch on TikTok',
      'threads.net': 'View on Threads',
      'www.threads.net': 'View on Threads',
      
      // Video Platforms
      'youtube.com': 'Watch on YouTube',
      'www.youtube.com': 'Watch on YouTube',
      'youtu.be': 'Watch on YouTube',
      'vimeo.com': 'Watch on Vimeo',
      'www.vimeo.com': 'Watch on Vimeo',
      'twitch.tv': 'Watch on Twitch',
      'www.twitch.tv': 'Watch on Twitch',
      
      // Google
      'docs.google.com': 'Open Google Doc',
      'drive.google.com': 'Open Google Drive',
      'forms.google.com': 'Open Google Form',
      'forms.gle': 'Open Google Form',
      'sheets.google.com': 'Open Google Sheet',
      'slides.google.com': 'Open Google Slides',
      'meet.google.com': 'Join Google Meet',
      'calendar.google.com': 'View on Google Calendar',
      'maps.google.com': 'View on Google Maps',
      'www.google.com': 'Search on Google',
      
      // Communication
      'zoom.us': 'Join Zoom Meeting',
      'discord.com': 'Join Discord',
      'discord.gg': 'Join Discord',
      'slack.com': 'Open Slack',
      'telegram.org': 'Open Telegram',
      't.me': 'Open Telegram',
      'wa.me': 'Chat on WhatsApp',
      'whatsapp.com': 'Chat on WhatsApp',
      
      // News & Articles
      'medium.com': 'Read on Medium',
      'dev.to': 'Read on Dev.to',
      'substack.com': 'Read on Substack',
      
      // Code & Development
      'github.com': 'View on GitHub',
      'www.github.com': 'View on GitHub',
      'gitlab.com': 'View on GitLab',
      'bitbucket.org': 'View on Bitbucket',
      'codepen.io': 'View on CodePen',
      'codesandbox.io': 'Open CodeSandbox',
      'replit.com': 'Open Replit',
      'stackblitz.com': 'Open StackBlitz',
      
      // E-commerce & Donations
      'shopee.ph': 'Shop on Shopee',
      'lazada.com.ph': 'Shop on Lazada',
      'amazon.com': 'Shop on Amazon',
      'gofundme.com': 'Donate on GoFundMe',
      'patreon.com': 'Support on Patreon',
      'ko-fi.com': 'Support on Ko-fi',
      'buymeacoffee.com': 'Buy Me a Coffee',
      
      // Filipino Platforms
      'gcash.com': 'Pay with GCash',
      'maya.ph': 'Pay with Maya',
      'grab.com': 'Open Grab',
      
      // Events
      'eventbrite.com': 'Register on Eventbrite',
      'www.eventbrite.com': 'Register on Eventbrite',
      'ticketmaster.com': 'Get Tickets',
      
      // Design
      'figma.com': 'View on Figma',
      'www.figma.com': 'View on Figma',
      'canva.com': 'View on Canva',
      'www.canva.com': 'View on Canva',
      'dribbble.com': 'View on Dribbble',
      'behance.net': 'View on Behance',
    };
    
    // Check for exact match first
    if (domainMappings[hostname]) {
      return domainMappings[hostname];
    }
    
    // Check for partial matches (subdomains)
    for (const [domain, text] of Object.entries(domainMappings)) {
      if (hostname.endsWith('.' + domain) || hostname === domain) {
        return text;
      }
    }
    
    // Default fallback
    return 'Learn More!';
  } catch {
    return 'Learn More!';
  }
}

export function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = parsed.pathname.replace('/', '');
      return id || null;
    }

    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/embed/')[1] || null;
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/shorts/')[1] || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function normalizeThemeSongUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname;

    if (host === 'drive.google.com' || host === 'docs.google.com') {
      let fileId = '';
      const fileMatch = path.match(/\/file\/d\/([^/]+)/);
      if (fileMatch && fileMatch[1]) {
        fileId = fileMatch[1];
      }

      if (!fileId && parsed.searchParams.has('id')) {
        fileId = parsed.searchParams.get('id') || '';
      }

      if (fileId) {
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
    }

    return withScheme;
  } catch {
    return trimmed;
  }
}
