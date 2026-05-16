import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AssistantFaceIcon from './AssistantFaceIcon';

export default function AIAssistantBubble({ onPress }) {
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Pressable style={styles.button} onPress={onPress}>
        <AssistantFaceIcon eyes={['idle', 'idle']} />
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: '800',
    color: '#60a5fa',
    letterSpacing: 0.5,
  },
});
