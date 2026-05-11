import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

const API_PORT = 8000;
const BUDGETIFY_API_PORT = 8001;
const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const ENV_BUDGETIFY_API_BASE_URL = process.env.EXPO_PUBLIC_BUDGETIFY_API_BASE_URL;
const DEFAULT_NETWORK_API_BASE_URL = 'https://notekit-core-backend.vercel.app';
const DEFAULT_BUDGETIFY_NETWORK_API_BASE_URL = 'https://notekit-budgetify-backend.vercel.app';
const LEGACY_NETWORK_API_BASE_URL = 'https://notekit-core-backend.onrender.com';
const LEGACY_BUDGETIFY_NETWORK_API_BASE_URL = 'https://notekit-budgetify-backend.onrender.com';
const USE_LOCAL_API_AUTO_DETECTION = process.env.EXPO_PUBLIC_USE_LOCAL_API === 'true';
// const DEFAULT_NETWORK_API_BASE_URL = '192.168.31.228:8000';

const DEFAULT_EMULATOR_API_BASE_URL = `http://10.0.2.2:${API_PORT}`;
const DEFAULT_LOCALHOST_API_BASE_URL = `http://localhost:${API_PORT}`;
const DEFAULT_BUDGETIFY_EMULATOR_API_BASE_URL = `http://10.0.2.2:${BUDGETIFY_API_PORT}`;
const DEFAULT_BUDGETIFY_LOCALHOST_API_BASE_URL = `http://localhost:${BUDGETIFY_API_PORT}`;

function normalizeApiBaseUrl(url) {
  return (url || '').trim().replace(/\/+$/, '');
}

export function normalizeCoreApiBaseUrl(url) {
  const normalized = normalizeApiBaseUrl(url);
  return normalized === LEGACY_NETWORK_API_BASE_URL ? DEFAULT_NETWORK_API_BASE_URL : normalized;
}

export function normalizeBudgetifyApiBaseUrl(url) {
  const normalized = normalizeApiBaseUrl(url);
  return normalized === LEGACY_BUDGETIFY_NETWORK_API_BASE_URL
    ? DEFAULT_BUDGETIFY_NETWORK_API_BASE_URL
    : normalized;
}

export function normalizeSavedCoreApiBaseUrl(url) {
  const normalized = normalizeCoreApiBaseUrl(url);
  return isLocalNetworkApiBaseUrl(normalized) ? DEFAULT_NETWORK_API_BASE_URL : normalized;
}

export function normalizeSavedBudgetifyApiBaseUrl(url) {
  const normalized = normalizeBudgetifyApiBaseUrl(url);
  return isLocalNetworkApiBaseUrl(normalized) ? DEFAULT_BUDGETIFY_NETWORK_API_BASE_URL : normalized;
}

export function isLocalNetworkApiBaseUrl(url) {
  const value = normalizeApiBaseUrl(url).toLowerCase();
  return (
    !value ||
    value.includes('localhost') ||
    value.includes('127.0.0.1') ||
    value.includes('10.0.2.2') ||
    value.includes('192.168.') ||
    value.includes('172.16.') ||
    value.includes('172.17.') ||
    value.includes('172.18.') ||
    value.includes('172.19.') ||
    value.includes('172.20.') ||
    value.includes('172.21.') ||
    value.includes('172.22.') ||
    value.includes('172.23.') ||
    value.includes('172.24.') ||
    value.includes('172.25.') ||
    value.includes('172.26.') ||
    value.includes('172.27.') ||
    value.includes('172.28.') ||
    value.includes('172.29.') ||
    value.includes('172.30.') ||
    value.includes('172.31.')
  );
}

function readMetroScriptUrl() {
  const sourceCode = NativeModules?.SourceCode;
  return sourceCode?.scriptURL || '';
}

function extractHostname(value) {
  if (!value) {
    return '';
  }

  try {
    if (value.includes('://')) {
      return new URL(value).hostname || '';
    }

    return value.split(':')[0] || '';
  } catch {
    return '';
  }
}

function inferApiBaseUrlFromExpoConfig(port = API_PORT) {
  const expoHost =
    extractHostname(Constants.expoConfig?.hostUri) ||
    extractHostname(Constants.expoGoConfig?.debuggerHost);

  if (!expoHost) {
    return '';
  }

  return `http://${expoHost}:${port}`;
}

function inferApiBaseUrlFromMetro(port = API_PORT) {
  const scriptUrl = readMetroScriptUrl();
  if (!scriptUrl) {
    return '';
  }

  try {
    const parsed = new URL(scriptUrl);
    if (!parsed.hostname) {
      return '';
    }
    const scheme = parsed.protocol === 'exps:' ? 'https:' : 'http:';
    return `${scheme}//${parsed.hostname}:${port}`;
  } catch {
    return '';
  }
}

function getFallbackApiBaseUrl() {
  const normalizedEnvApiBaseUrl = normalizeCoreApiBaseUrl(ENV_API_BASE_URL);
  if (normalizedEnvApiBaseUrl) {
    return normalizedEnvApiBaseUrl;
  }

  const normalizedNetworkApiBaseUrl = normalizeCoreApiBaseUrl(DEFAULT_NETWORK_API_BASE_URL);
  if (normalizedNetworkApiBaseUrl) {
    return normalizedNetworkApiBaseUrl;
  }

  if (USE_LOCAL_API_AUTO_DETECTION) {
    const expoConfigApiBaseUrl = normalizeApiBaseUrl(inferApiBaseUrlFromExpoConfig());
    if (expoConfigApiBaseUrl) {
      return expoConfigApiBaseUrl;
    }

    const metroApiBaseUrl = normalizeApiBaseUrl(inferApiBaseUrlFromMetro());
    if (metroApiBaseUrl) {
      return metroApiBaseUrl;
    }

    if (Platform.OS === 'android') {
      return DEFAULT_EMULATOR_API_BASE_URL;
    }
  }

  return DEFAULT_LOCALHOST_API_BASE_URL;
}

function getFallbackBudgetifyApiBaseUrl() {
  const normalizedEnvApiBaseUrl = normalizeBudgetifyApiBaseUrl(ENV_BUDGETIFY_API_BASE_URL);
  if (normalizedEnvApiBaseUrl) {
    return normalizedEnvApiBaseUrl;
  }

  const normalizedNetworkApiBaseUrl = normalizeBudgetifyApiBaseUrl(DEFAULT_BUDGETIFY_NETWORK_API_BASE_URL);
  if (normalizedNetworkApiBaseUrl) {
    return normalizedNetworkApiBaseUrl;
  }

  if (USE_LOCAL_API_AUTO_DETECTION) {
    const expoConfigApiBaseUrl = normalizeApiBaseUrl(inferApiBaseUrlFromExpoConfig(BUDGETIFY_API_PORT));
    if (expoConfigApiBaseUrl) {
      return expoConfigApiBaseUrl;
    }

    const metroApiBaseUrl = normalizeApiBaseUrl(inferApiBaseUrlFromMetro(BUDGETIFY_API_PORT));
    if (metroApiBaseUrl) {
      return metroApiBaseUrl;
    }

    if (Platform.OS === 'android') {
      return DEFAULT_BUDGETIFY_EMULATOR_API_BASE_URL;
    }
  }

  return DEFAULT_BUDGETIFY_LOCALHOST_API_BASE_URL;
}

let runtimeApiBaseUrl = getFallbackApiBaseUrl();
let runtimeBudgetifyApiBaseUrl = getFallbackBudgetifyApiBaseUrl();

export function getDefaultApiBaseUrl() {
  return getFallbackApiBaseUrl();
}

export function getDefaultBudgetifyApiBaseUrl() {
  return getFallbackBudgetifyApiBaseUrl();
}

export function getApiBaseUrl() {
  if (!runtimeApiBaseUrl) {
    runtimeApiBaseUrl = getFallbackApiBaseUrl();
  }
  return runtimeApiBaseUrl;
}

export function getBudgetifyApiBaseUrl() {
  if (!runtimeBudgetifyApiBaseUrl) {
    runtimeBudgetifyApiBaseUrl = getFallbackBudgetifyApiBaseUrl();
  }
  return runtimeBudgetifyApiBaseUrl;
}

export function setApiBaseUrl(url) {
  const normalized = normalizeCoreApiBaseUrl(url);
  runtimeApiBaseUrl = normalized || getFallbackApiBaseUrl();
}

export function setBudgetifyApiBaseUrl(url) {
  const normalized = normalizeBudgetifyApiBaseUrl(url);
  runtimeBudgetifyApiBaseUrl = normalized || getFallbackBudgetifyApiBaseUrl();
}

export const EXTERNAL_APPS = [
  {
    id: 'portfolio',
    title: 'My Portfolio',
    subtitle: 'Explore my personal portfolio website.',
    imageName: '1.jpeg',
    url: 'https://kalkeesh.github.io/',
  },
  {
    id: 'geo-spatial-insights',
    title: 'Geo Spatial Insights',
    subtitle: 'View geospatial insights and visual analysis.',
    imageName: '2.jpeg',
    url: 'https://nourway.streamlit.app/',
  },
  {
    id: 'night-owl-chat-room',
    title: 'Night Owl Chat Room',
    subtitle: 'Join the live chat room experience.',
    imageName: '3.jpeg',
    url: 'https://nightowlchat.onrender.com/',
  },
  {
    id: 'student-management-system',
    title: 'Student Management System',
    subtitle: 'Open the student management dashboard.',
    imageName: '4.jpeg',
    url: 'https://sms-7g7p.onrender.com/',
  },
  {
    id: 'teacher-comments-analysis',
    title: 'Teacher Comments Analysis',
    subtitle: 'Analyze teacher comments and feedback patterns.',
    imageName: '5.jpeg',
    url: 'https://teachvibe.streamlit.app/',
  },
  {
    id: 'qr-code-maker',
    title: 'QR Code Maker',
    subtitle: 'Create blended custom QR codes quickly.',
    imageName: '6.jpeg',
    url: 'https://qrblend.streamlit.app/',
  },
];
