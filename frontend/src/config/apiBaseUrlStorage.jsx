import { storageGetItem, storageSetItem } from './appStorage';

const STORAGE_KEY = 'notekit_api_base_url';
const BUDGETIFY_STORAGE_KEY = 'notekit_budgetify_api_base_url';

export async function loadSavedApiBaseUrl() {
  try {
    return (await storageGetItem(STORAGE_KEY)) || '';
  } catch {
    return '';
  }
}

export async function saveApiBaseUrl(url) {
  const value = url || '';
  await storageSetItem(STORAGE_KEY, value);
}

export async function loadSavedBudgetifyApiBaseUrl() {
  try {
    return (await storageGetItem(BUDGETIFY_STORAGE_KEY)) || '';
  } catch {
    return '';
  }
}

export async function saveBudgetifyApiBaseUrl(url) {
  const value = url || '';
  await storageSetItem(BUDGETIFY_STORAGE_KEY, value);
}
