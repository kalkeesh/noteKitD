import { storageGetItem, storageSetItem } from './appStorage';

const STORAGE_KEY = 'notekit_ai_provider';
const DEFAULT_AI_PROVIDER = 'gemini';

function normalizeAiProvider(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'groq') {
    return 'groq';
  }
  return DEFAULT_AI_PROVIDER;
}

export function getDefaultAiProvider() {
  return DEFAULT_AI_PROVIDER;
}

export async function loadSavedAiProvider() {
  try {
    return normalizeAiProvider(await storageGetItem(STORAGE_KEY));
  } catch {
    return DEFAULT_AI_PROVIDER;
  }
}

export async function saveAiProvider(provider) {
  const value = normalizeAiProvider(provider);
  await storageSetItem(STORAGE_KEY, value);
}
