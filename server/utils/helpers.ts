/**
 * Utility helper functions for OxygenLead API
 */

export const isValidUrl = (urlString: string): boolean => {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
};

export const extractDomainFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return url;
  }
};

export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11) +
    Math.random().toString(36).substring(2, 11);
};

export const retryAsync = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, delay * Math.pow(2, attempt - 1))
        );
      }
    }
  }

  throw lastError;
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, "");
};
