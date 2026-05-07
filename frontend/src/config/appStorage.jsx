import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const memoryStorage = new Map();

function canUseLocalStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage;
}

function hasNativeAsyncStorage() {
  return typeof AsyncStorage?.getItem === 'function';
}

async function withFallback(action, fallbackValue) {
  try {
    return await action();
  } catch (err) {
    const message = String(err?.message || err || '');
    if (message.toLowerCase().includes('native module is null')) {
      return fallbackValue();
    }
    throw err;
  }
}

export async function storageGetItem(key) {
  if (canUseLocalStorage()) {
    return window.localStorage.getItem(key);
  }
  if (!hasNativeAsyncStorage()) {
    return memoryStorage.get(key) ?? null;
  }
  return withFallback(() => AsyncStorage.getItem(key), () => memoryStorage.get(key) ?? null);
}

export async function storageSetItem(key, value) {
  if (canUseLocalStorage()) {
    window.localStorage.setItem(key, value);
    return;
  }
  if (!hasNativeAsyncStorage()) {
    memoryStorage.set(key, value);
    return;
  }
  return withFallback(
    async () => {
      await AsyncStorage.setItem(key, value);
    },
    () => {
      memoryStorage.set(key, value);
    }
  );
}

export async function storageRemoveItem(key) {
  if (canUseLocalStorage()) {
    window.localStorage.removeItem(key);
    return;
  }
  if (!hasNativeAsyncStorage()) {
    memoryStorage.delete(key);
    return;
  }
  return withFallback(
    async () => {
      await AsyncStorage.removeItem(key);
    },
    () => {
      memoryStorage.delete(key);
    }
  );
}
