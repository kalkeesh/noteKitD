import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import {
  getApiBaseUrl,
  getBudgetifyApiBaseUrl,
  normalizeSavedBudgetifyApiBaseUrl,
  normalizeSavedCoreApiBaseUrl,
  setApiBaseUrl,
  setBudgetifyApiBaseUrl,
} from '../config/appConfig';
import {
  loadSavedApiBaseUrl,
  loadSavedBudgetifyApiBaseUrl,
  saveApiBaseUrl,
  saveBudgetifyApiBaseUrl,
} from '../config/apiBaseUrlStorage';
import AssistantFaceIcon from '../features/assistant/components/AssistantFaceIcon';

const CHECK_TIMEOUT_MS = 12000;
const RETRY_DELAY_MS = 2500;
const SUCCESS_VISIBLE_MS = 3000;
const CORE_BACKEND = 'core';
const BUDGETIFY_BACKEND = 'budgetify';
const BACKEND_HEALTH_PATHS = {
  [CORE_BACKEND]: '/api/health',
  [BUDGETIFY_BACKEND]: '/budget/health',
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveCoreApiBaseUrl() {
  const saved = await loadSavedApiBaseUrl();
  if (saved) {
    const normalizedSaved = normalizeSavedCoreApiBaseUrl(saved);
    setApiBaseUrl(normalizedSaved);
    if (normalizedSaved !== saved) {
      await saveApiBaseUrl(normalizedSaved);
    }
  }
  return getApiBaseUrl();
}

async function resolveBudgetifyApiBaseUrl() {
  const saved = await loadSavedBudgetifyApiBaseUrl();
  if (saved) {
    const normalizedSaved = normalizeSavedBudgetifyApiBaseUrl(saved);
    setBudgetifyApiBaseUrl(normalizedSaved);
    if (normalizedSaved !== saved) {
      await saveBudgetifyApiBaseUrl(normalizedSaved);
    }
  }
  return getBudgetifyApiBaseUrl();
}

async function pingBackend(baseUrl, path) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) {
      return false;
    }
    const data = await response.json().catch(() => null);
    return !data?.status || data.status === 'ok';
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function BackendStatusIndicator() {
  const [statuses, setStatuses] = useState({
    [CORE_BACKEND]: 'checking',
    [BUDGETIFY_BACKEND]: 'checking',
  });
  const runIdsRef = useRef({
    [CORE_BACKEND]: 0,
    [BUDGETIFY_BACKEND]: 0,
  });

  useEffect(() => {
    let mounted = true;

    const checkUntilReady = async (backendKey, resolveBaseUrl) => {
      const runId = runIdsRef.current[backendKey] + 1;
      runIdsRef.current[backendKey] = runId;
      setStatuses((current) => ({ ...current, [backendKey]: 'checking' }));

      const baseUrl = await resolveBaseUrl();
      if (!mounted || runIdsRef.current[backendKey] !== runId) {
        return;
      }

      while (mounted && runIdsRef.current[backendKey] === runId) {
        const isReady = await pingBackend(baseUrl, BACKEND_HEALTH_PATHS[backendKey]);
        if (!mounted || runIdsRef.current[backendKey] !== runId) {
          return;
        }

        if (isReady) {
          setStatuses((current) => ({ ...current, [backendKey]: 'ready' }));
          await wait(SUCCESS_VISIBLE_MS);
          if (mounted && runIdsRef.current[backendKey] === runId) {
            setStatuses((current) => ({ ...current, [backendKey]: 'hidden' }));
          }
          return;
        }

        setStatuses((current) => ({ ...current, [backendKey]: 'down' }));
        await wait(RETRY_DELAY_MS);
      }
    };

    const checkBothBackends = () => {
      checkUntilReady(CORE_BACKEND, resolveCoreApiBaseUrl);
      checkUntilReady(BUDGETIFY_BACKEND, resolveBudgetifyApiBaseUrl);
    };

    checkBothBackends();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkBothBackends();
      }
    });

    return () => {
      mounted = false;
      runIdsRef.current[CORE_BACKEND] += 1;
      runIdsRef.current[BUDGETIFY_BACKEND] += 1;
      subscription.remove();
    };
  }, []);

  const visibleBackends = [CORE_BACKEND, BUDGETIFY_BACKEND].filter((backendKey) => statuses[backendKey] !== 'hidden');

  if (!visibleBackends.length) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <AssistantFaceIcon
        eyes={[CORE_BACKEND, BUDGETIFY_BACKEND].map((backendKey) =>
          statuses[backendKey] === 'ready' || statuses[backendKey] === 'hidden' ? 'ready' : 'down'
        )}
      />
      <View style={styles.labelPlate} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    bottom: 82,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
  },
  labelPlate: {
    marginTop: 6,
    width: 18,
    height: 8,
  },
});
