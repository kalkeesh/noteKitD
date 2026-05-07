import React, { useContext, useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { KeyboardScreenContext } from './KeyboardScreen';

export default function FormInput({
  value,
  onChangeText,
  placeholder,
  label,
  secureTextEntry = false,
  keyboardType = 'default',
  multiline = false,
  autoCapitalize = 'none',
  returnKeyType = 'done',
  onSubmitEditing,
  blurOnSubmit,
  textContentType,
  autoComplete,
  onFocus,
  theme = 'light',
  compact = false,
}) {
  const inputRef = useRef(null);
  const { scrollToInput } = useContext(KeyboardScreenContext);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={[styles.label, theme === 'dark' ? styles.labelDark : null]}>{label}</Text> : null}
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          theme === 'dark' ? styles.inputDark : null,
          compact ? styles.inputCompact : null,
          multiline ? styles.multilineInput : null,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme === 'dark' ? 'rgba(148,163,184,0.52)' : '#8ea0bf'}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={blurOnSubmit}
        textContentType={textContentType}
        autoComplete={autoComplete}
        onFocus={(event) => {
          scrollToInput(inputRef);
          onFocus?.(event);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 12,
  },
  label: {
    marginBottom: 6,
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  labelDark: {
    color: 'rgba(148,163,184,0.72)',
  },
  input: {
    borderWidth: 1,
    borderColor: '#c8d7ee',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    color: '#183153',
    fontSize: 15,
  },
  inputDark: {
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(15,23,42,0.9)',
    color: '#f8fafc',
  },
  inputCompact: {
    paddingVertical: 12,
  },
  multilineInput: {
    minHeight: 96,
  },
});
