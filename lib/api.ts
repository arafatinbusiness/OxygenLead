/**
 * API configuration for the OxygenLead frontend.
 * Uses NEXT_PUBLIC_API_URL environment variable, with fallback for development.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Helper to build a full API URL
 */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
