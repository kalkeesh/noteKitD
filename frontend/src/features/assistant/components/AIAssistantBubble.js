import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function AIAssistantBubble({ onPress }) {
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Pressable style={styles.button} onPress={onPress}>
        <Feather name="mic" size={24} color="#ffffff" />
      </Pressable>
      <Text style={styles.label}>AI</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    bottom: 82,
    zIndex: 30,
    alignItems: 'center',
  },
  button: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(9,13,22,0.85)',
    shadowColor: '#312e81',
    shadowOpacity: 0.38,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  label: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: '800',
    color: '#60a5fa',
    letterSpacing: 0.5,
  },
});
