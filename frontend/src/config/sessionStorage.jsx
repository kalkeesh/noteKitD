import { storageGetItem, storageRemoveItem, storageSetItem } from './appStorage';

const SESSION_KEY = 'notekit_auth_session';

export async function loadSession() {
  try {
    const raw = await storageGetItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveSession(session) {
  const value = JSON.stringify(session);
  await storageSetItem(SESSION_KEY, value);
}

export async function clearSession() {
  await storageRemoveItem(SESSION_KEY);
}
