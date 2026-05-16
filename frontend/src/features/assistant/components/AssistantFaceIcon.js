import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function AssistantFaceIcon({ eyes = ['idle', 'idle'], size = 46 }) {
  const scale = size / 46;
  return (
    <View style={[styles.shell, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.magentaGlow, { borderRadius: size / 2 }]} />
      <View style={[styles.cyanGlow, { borderRadius: size / 2 }]} />
      <View
        style={[
          styles.visor,
          {
            width: 33 * scale,
            height: 20 * scale,
            borderRadius: 11 * scale,
          },
        ]}
      >
        <View style={styles.eyeRow}>
          {eyes.map((status, index) => (
            <View
              key={`${status}-${index}`}
              style={[
                styles.eye,
                {
                  width: 8 * scale,
                  height: 12 * scale,
                  borderRadius: 4 * scale,
                },
                status === 'ready' ? styles.eyeReady : status === 'down' ? styles.eyeDown : styles.eyeIdle,
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#94a3b8',
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    overflow: 'hidden',
  },
  magentaGlow: {
    position: 'absolute',
    left: 7,
    top: 11,
    width: 29,
    height: 23,
    backgroundColor: '#d946ef',
  },
  cyanGlow: {
    position: 'absolute',
    right: 6,
    top: 10,
    width: 29,
    height: 23,
    backgroundColor: '#06b6d4',
  },
  visor: {
    backgroundColor: '#070b1a',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eye: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.88)',
    shadowOpacity: 0.85,
    shadowRadius: 7,
  },
  eyeIdle: {
    backgroundColor: '#ffffff',
    shadowColor: '#ffffff',
  },
  eyeDown: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  eyeReady: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
  },
});
