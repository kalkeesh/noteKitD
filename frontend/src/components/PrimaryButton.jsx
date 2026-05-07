import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

export default function PrimaryButton({ title, onPress, disabled = false, theme = 'default', compact = false }) {
  return (
    <Pressable
      style={[
        styles.button,
        theme === 'dark' ? styles.buttonDark : null,
        compact ? styles.buttonCompact : null,
        disabled ? styles.buttonDisabled : null,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDark: {
    backgroundColor: '#2563eb',
    borderWidth: 1,
    borderColor: 'rgba(191,219,254,0.5)',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  buttonCompact: {
    minHeight: 44,
    paddingVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
