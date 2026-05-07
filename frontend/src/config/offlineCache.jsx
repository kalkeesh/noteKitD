import { storageGetItem, storageRemoveItem, storageSetItem } from './appStorage';

const PREFIX = 'notekit_offline_cache';

function normalizeUserKey(userKey) {
  return String(userKey || 'anonymous').trim().toLowerCase() || 'anonymous';
}

function buildKey(userKey, name) {
  return `${PREFIX}:${normalizeUserKey(userKey)}:${name}`;
}

export async function loadCachedData(userKey, name, fallbackValue = null) {
  try {
    const raw = await storageGetItem(buildKey(userKey, name));
    if (!raw) {
      return fallbackValue;
    }
    const parsed = JSON.parse(raw);
    return parsed?.data ?? fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export async function saveCachedData(userKey, name, data) {
  try {
    await storageSetItem(
      buildKey(userKey, name),
      JSON.stringify({
        data,
        savedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Cache writes should never block the live app flow.
  }
}

export async function removeCachedData(userKey, name) {
  try {
    await storageRemoveItem(buildKey(userKey, name));
  } catch {
    // Best effort only.
  }
}
