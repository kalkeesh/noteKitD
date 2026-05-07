import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StatusBar, StyleSheet, View } from 'react-native';

import { getApiBaseUrl, setApiBaseUrl } from '../config/appConfig';
import { loadSavedApiBaseUrl } from '../config/apiBaseUrlStorage';

const CHECK_TIMEOUT_MS = 12000;
const RETRY_DELAY_MS = 2500;
const SUCCESS_VISIBLE_MS = 3000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveStatusApiBaseUrl() {
  const saved = await loadSavedApiBaseUrl();
  if (saved) {
    setApiBaseUrl(saved);
  }
  return getApiBaseUrl();
}

async function pingBackend(baseUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/`, {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function BackendStatusIndicator() {
  const [status, setStatus] = useState('checking');
  const runIdRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    const checkUntilReady = async () => {
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      setStatus('checking');

      const baseUrl = await resolveStatusApiBaseUrl();
      if (!mounted || runIdRef.current !== runId) {
        return;
      }

      while (mounted && runIdRef.current === runId) {
        const isReady = await pingBackend(baseUrl);
        if (!mounted || runIdRef.current !== runId) {
          return;
        }

        if (isReady) {
          setStatus('ready');
          await wait(SUCCESS_VISIBLE_MS);
          if (mounted && runIdRef.current === runId) {
            setStatus('hidden');
          }
          return;
        }

        setStatus('down');
        await wait(RETRY_DELAY_MS);
      }
    };

    checkUntilReady();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkUntilReady();
      }
    });

    return () => {
      mounted = false;
      runIdRef.current += 1;
      subscription.remove();
    };
  }, []);

  if (status === 'hidden') {
    return null;
  }

  const ready = status === 'ready';

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={[styles.indicator, ready ? styles.ready : styles.down]}>
        <View style={[styles.innerDot, ready ? styles.readyDot : styles.downDot]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: (Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0) + 10,
    left: 12,
    zIndex: 9999,
    elevation: 9999,
  },
  indicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  innerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  down: {
    backgroundColor: 'rgba(127, 29, 29, 0.92)',
    borderColor: 'rgba(248, 113, 113, 0.72)',
  },
  downDot: {
    backgroundColor: '#f87171',
  },
  ready: {
    backgroundColor: 'rgba(20, 83, 45, 0.92)',
    borderColor: 'rgba(74, 222, 128, 0.75)',
  },
  readyDot: {
    backgroundColor: '#4ade80',
  },
});
