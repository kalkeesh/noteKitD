import { storageGetItem, storageSetItem } from './appStorage';

export const PRIMARY_APP_NOTEKIT = 'notekit';
export const PRIMARY_APP_TODOS = 'todos';
export const PRIMARY_APP_BUDGETIFY = 'budgetify';

const STORAGE_KEY = 'notekit_primary_app';

export function normalizePrimaryApp(value) {
  if (value === PRIMARY_APP_TODOS || value === PRIMARY_APP_BUDGETIFY) {
    return value;
  }
  return PRIMARY_APP_NOTEKIT;
}

export async function loadPrimaryApp() {
  try {
    return normalizePrimaryApp((await storageGetItem(STORAGE_KEY)) || '');
  } catch {
    return PRIMARY_APP_NOTEKIT;
  }
}

export async function savePrimaryApp(value) {
  const normalized = normalizePrimaryApp(value);
  await storageSetItem(STORAGE_KEY, normalized);
}

export function getPostLoginRoute(primaryApp) {
  const normalized = normalizePrimaryApp(primaryApp);
  return {
    name: 'NoteKit',
    params: {
      initialTab:
        normalized === PRIMARY_APP_TODOS
          ? PRIMARY_APP_TODOS
          : normalized === PRIMARY_APP_BUDGETIFY
            ? PRIMARY_APP_BUDGETIFY
            : PRIMARY_APP_NOTEKIT,
    },
  };
}
