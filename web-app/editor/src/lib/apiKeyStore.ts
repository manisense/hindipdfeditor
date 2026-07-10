const GEMINI_API_KEY_STORAGE_KEY = 'hindi-pdf-editor-gemini-api-key';

/** Returns the stored Gemini API key, or `null` if the user hasn't provided one yet. */
export async function getGeminiApiKey(): Promise<string | null> {
  try {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Persists the user's Gemini API key (pass a trimmed, non-empty string). */
export async function setGeminiApiKey(key: string): Promise<void> {
  localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, key);
}

/** Removes the stored key so the user is re-prompted after an invalid key error. */
export async function clearGeminiApiKey(): Promise<void> {
  localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
}
