import { storageGetItem, storageSetItem } from './appStorage';

export const NOTIFICATION_THEMES = [
  {
    key: 'midnight',
    title: 'Midnight',
    description: 'Clean dark alerts with crisp blue accents.',
  },
  {
    key: 'aurora',
    title: 'Aurora',
    description: 'Soft green alerts with a brighter glow.',
  },
  {
    key: 'ember',
    title: 'Ember',
    description: 'Warm high-contrast alerts with amber energy.',
  },
];

const STORAGE_KEY = 'notekit_notification_theme';
const DEFAULT_NOTIFICATION_THEME = 'midnight';

export function normalizeNotificationTheme(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return NOTIFICATION_THEMES.some((theme) => theme.key === normalized)
    ? normalized
    : DEFAULT_NOTIFICATION_THEME;
}

export function getDefaultNotificationTheme() {
  return DEFAULT_NOTIFICATION_THEME;
}

export async function loadSavedNotificationTheme() {
  try {
    return normalizeNotificationTheme(await storageGetItem(STORAGE_KEY));
  } catch {
    return DEFAULT_NOTIFICATION_THEME;
  }
}

export async function saveNotificationTheme(theme) {
  const value = normalizeNotificationTheme(theme);
  await storageSetItem(STORAGE_KEY, value);
  return value;
}
