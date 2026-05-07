import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { registerConfirmHandler } from '../utils/confirmService';
import { registerToastHandler } from '../utils/toastService';

const TYPE_META = {
  success: { color: '#22c55e', icon: 'check-circle' },
  error: { color: '#ef4444', icon: 'alert-circle' },
  warning: { color: '#f59e0b', icon: 'alert-triangle' },
  info: { color: '#3b82f6', icon: 'info' },
};

export function ToastHost() {
  const [currentToast, setCurrentToast] = useState(null);
  const queueRef = useRef([]);
  const activeToastRef = useRef(null);
  const dismissTimerRef = useRef(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-24)).current;

  useEffect(() => {
    const cleanup = registerToastHandler((toast) => {
      queueRef.current.push(toast);
      if (!activeToastRef.current) {
        showNextToast();
      }
    });

    return () => {
      cleanup();
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const animateOut = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -24, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      activeToastRef.current = null;
      setCurrentToast(null);
      showNextToast();
    });
  };

  const showNextToast = () => {
    const nextToast = queueRef.current.shift();
    if (!nextToast) {
      return;
    }

    activeToastRef.current = nextToast;
    setCurrentToast(nextToast);
    opacity.setValue(0);
    translateY.setValue(-24);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();

    dismissTimerRef.current = setTimeout(animateOut, nextToast.duration || 2600);
  };

  if (!currentToast) {
    return null;
  }

  const meta = TYPE_META[currentToast.type] || TYPE_META.info;

  return (
    <View pointerEvents="box-none" style={styles.viewport}>
      <Animated.View
        style={[
          styles.toastCard,
          {
            opacity,
            transform: [{ translateY }],
            borderColor: `${meta.color}55`,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${meta.color}20` }]}>
          <Feather name={meta.icon} size={16} color={meta.color} />
        </View>
        <Text style={styles.toastText}>{currentToast.message}</Text>
      </Animated.View>
    </View>
  );
}

export function ConfirmDialogHost() {
  const [request, setRequest] = useState(null);

  useEffect(() => {
    return registerConfirmHandler((nextRequest) => {
      setRequest(nextRequest);
    });
  }, []);

  const close = (result) => {
    if (request?.onResolve) {
      request.onResolve(result);
    }
    setRequest(null);
  };

  return (
    <Modal visible={Boolean(request)} transparent animationType="fade" onRequestClose={() => close(false)}>
      <SafeAreaView style={styles.modalBackdrop}>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>{request?.title || 'Confirm action'}</Text>
          <Text style={styles.confirmMessage}>{request?.message || 'Are you sure you want to continue?'}</Text>
          <View style={styles.confirmActions}>
            <Pressable style={styles.cancelBtn} onPress={() => close(false)}>
              <Text style={styles.cancelText}>{request?.cancelText || 'Cancel'}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.confirmBtn,
                request?.tone === 'danger' ? styles.confirmBtnDanger : styles.confirmBtnDefault,
              ]}
              onPress={() => close(true)}
            >
              <Text style={styles.confirmText}>{request?.confirmText || 'Confirm'}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 22,
    zIndex: 1000,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: 'rgba(15,23,42,0.9)',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  toastText: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.68)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  confirmCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
  },
  confirmTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
  },
  confirmMessage: {
    marginTop: 8,
    color: 'rgba(226,232,240,0.74)',
    lineHeight: 21,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    paddingVertical: 12,
    backgroundColor: 'rgba(30,41,59,0.8)',
  },
  cancelText: {
    color: '#cbd5e1',
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 12,
  },
  confirmBtnDanger: {
    backgroundColor: '#ef4444',
  },
  confirmBtnDefault: {
    backgroundColor: '#3b82f6',
  },
  confirmText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
