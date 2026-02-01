/**
 * Utility functions for handling external links like email and phone
 */

/**
 * Opens the default email application with the specified email address
 * @param email - The email address to open
 */
export function openEmailApp(email: string): void {
  if (email) {
    window.location.href = `mailto:${email}`;
  }
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
