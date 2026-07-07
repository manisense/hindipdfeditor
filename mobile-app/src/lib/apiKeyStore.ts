import * as SecureStore from 'expo-secure-store';

/**
 * Stores the user's Gemini API key in Android's Keystore-backed encrypted storage
 * (expo-secure-store), not a plain file or async-storage - it's a credential, even a
 * free-tier one. This is the only file that should touch SecureStore for this key, so the
 * storage mechanism can be swapped by editing only this file.
 */

const GEMINI_API_KEY_STORAGE_KEY = 'gemini-api-key';

/** Returns the stored Gemini API key, or `null` if the user hasn't provided one yet. */
export async function getGeminiApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(GEMINI_API_KEY_STORAGE_KEY);
}

/** Persists the user's Gemini API key (pass a trimmed, non-empty string). */
export async function setGeminiApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(GEMINI_API_KEY_STORAGE_KEY, key);
}

/** Removes the stored key - used when the API rejects it as invalid, so the user is re-prompted. */
export async function clearGeminiApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(GEMINI_API_KEY_STORAGE_KEY);
}
