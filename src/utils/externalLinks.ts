/**
 * Utility functions for handling external links like email and phone
 */

/**
 * Detect if the user is on a mobile device
 */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  
  // Check for mobile user agents
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  const isMobileUA = mobileRegex.test(navigator.userAgent);
  
  // Check for touch capability as additional signal
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check screen size (mobile typically < 768px width)
  const isSmallScreen = window.innerWidth < 768;
  
  // Consider it mobile if user agent says so, or if it's a small touch device
  return isMobileUA || (hasTouch && isSmallScreen);
}

/**
 * Encodes an email address for use in mailto: links
 * Handles special characters like '+' which need to be encoded
 * @param email - The email address to encode
 * @returns The properly encoded email address for mailto: links
 */
export function encodeEmailForMailto(email: string): string {
  if (!email) {
    return '';
  }
  // Encode special characters in email addresses
  // The '+' character needs to be encoded as %2B to work properly in mailto: links
  const encoded = email.replace(/\+/g, '%2B');
  return encoded;
}

/**
 * Creates a properly formatted mailto: URL
 * @param email - The email address
 * @returns The complete mailto: URL with encoded email
 */
export function createMailtoUrl(email: string): string {
  if (!email) {
    return '';
  }
  const mailtoUrl = `mailto:${encodeEmailForMailto(email)}`;
  return mailtoUrl;
}

/**
 * Opens the default email application with the specified email address
 * On mobile: Uses mailto: which opens the native email app
 * On desktop: Opens Gmail compose in a new tab (more reliable than mailto:)
 * @param email - The email address to open
 * @param subject - Optional email subject
 * @param body - Optional email body
 */
export function openEmailApp(email: string, subject?: string, body?: string): void {
  if (!email) {
    return;
  }

  if (isMobileDevice()) {
    // On mobile, use mailto: which works reliably
    const mailtoUrl = createMailtoUrl(email);
    window.location.href = mailtoUrl;
  } else {
    // On desktop, open Gmail compose directly in a new tab
    // This is more reliable than mailto: which requires a configured email client
    const gmailUrl = createGmailComposeUrl(email, subject, body);
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Creates a Gmail compose URL
 * @param email - The recipient email address
 * @param subject - Optional email subject
 * @param body - Optional email body
 * @returns The Gmail compose URL
 */
export function createGmailComposeUrl(email: string, subject?: string, body?: string): string {
  const params = new URLSearchParams();
  params.set('view', 'cm');
  params.set('fs', '1'); // Full screen compose
  params.set('to', email); // Don't encode + for Gmail URL, it handles it
  
  if (subject) {
    params.set('su', subject);
  }
  if (body) {
    params.set('body', body);
  }
  
  return `https://mail.google.com/mail/?${params.toString()}`;
}

/**
 * Opens the default phone application with the specified phone number
 * @param phone - The phone number to dial
 */
export function openPhoneApp(phone: string): void {
  if (phone) {
    // Remove any non-numeric characters except + for international format
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    window.location.href = `tel:${cleanPhone}`;
  }
}
