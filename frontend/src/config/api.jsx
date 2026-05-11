import {
  getApiBaseUrl,
  getBudgetifyApiBaseUrl,
  normalizeSavedBudgetifyApiBaseUrl,
  normalizeSavedCoreApiBaseUrl,
  setApiBaseUrl,
  setBudgetifyApiBaseUrl,
} from './appConfig';
import {
  loadSavedApiBaseUrl,
  loadSavedBudgetifyApiBaseUrl,
  saveApiBaseUrl,
  saveBudgetifyApiBaseUrl,
} from './apiBaseUrlStorage';

let apiBaseUrlInitialized = false;
let budgetifyApiBaseUrlInitialized = false;
const REQUEST_TIMEOUT_MS = 20000;

async function ensureApiBaseUrl() {
  if (apiBaseUrlInitialized) {
    return;
  }
  const saved = await loadSavedApiBaseUrl();
  if (saved) {
    const normalizedSaved = normalizeSavedCoreApiBaseUrl(saved);
    setApiBaseUrl(normalizedSaved);
    if (normalizedSaved !== saved) {
      await saveApiBaseUrl(normalizedSaved);
    }
  }
  apiBaseUrlInitialized = true;
}

async function ensureBudgetifyApiBaseUrl() {
  if (budgetifyApiBaseUrlInitialized) {
    return;
  }
  const saved = await loadSavedBudgetifyApiBaseUrl();
  if (saved) {
    const normalizedSaved = normalizeSavedBudgetifyApiBaseUrl(saved);
    setBudgetifyApiBaseUrl(normalizedSaved);
    if (normalizedSaved !== saved) {
      await saveBudgetifyApiBaseUrl(normalizedSaved);
    }
  }
  budgetifyApiBaseUrlInitialized = true;
}

async function requestJson(baseUrl, path, method = 'GET', body, token = '') {
  const requestUrl = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(requestUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const message =
      err?.name === 'AbortError'
        ? `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
        : err?.message || 'Network request failed';
    throw new Error(`${message}. API URL: ${requestUrl}`);
  } finally {
    clearTimeout(timeoutId);
  }

  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }

  if (!response.ok) {
    const message = data?.detail || data?.message || 'Request failed';
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function apiRequest(path, method = 'GET', body, token = '') {
  await ensureApiBaseUrl();
  return requestJson(getApiBaseUrl(), path, method, body, token);
}

export async function budgetifyApiRequest(path, method = 'GET', body, token = '') {
  await ensureBudgetifyApiBaseUrl();
  return requestJson(getBudgetifyApiBaseUrl(), path, method, body, token);
}

export async function apiFormRequest(path, formData, token = '', timeoutMs = 30000) {
  await ensureApiBaseUrl();
  const requestUrl = `${getApiBaseUrl()}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
      body: formData,
    });
  } catch (err) {
    const message =
      err?.name === 'AbortError'
        ? `Request timed out after ${timeoutMs / 1000}s`
        : err?.message || 'Network request failed';
    throw new Error(`${message}. API URL: ${requestUrl}`);
  } finally {
    clearTimeout(timeoutId);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.detail || data?.message || 'Request failed';
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
