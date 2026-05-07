import React, { createContext, useMemo, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const KeyboardScreenContext = createContext({
  scrollToInput: () => {},
});

export default function KeyboardScreen({
  children,
  style,
  contentContainerStyle,
  keyboardOffset = 24,
  scroll = true,
  centerContent = false,
}) {
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const contentStyle = [styles.content, centerContent ? styles.centerContent : null, contentContainerStyle];

  const contextValue = useMemo(
    () => ({
      scrollToInput(inputRef) {
        if (!scroll || !scrollRef.current || !contentRef.current || !inputRef?.current?.measureLayout) {
          return;
        }

        inputRef.current.measureLayout(
          contentRef.current,
          (_x, y) => {
            const nextY = Math.max(0, y - 24);
            scrollRef.current?.scrollTo({ y: nextY, animated: true });
          },
          () => {}
        );
      },
    }),
    [scroll]
  );

  return (
    <KeyboardScreenContext.Provider value={contextValue}>
      <SafeAreaView style={[styles.safeArea, style]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardOffset}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            {scroll ? (
              <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                showsVerticalScrollIndicator={false}
              >
                <View ref={contentRef} style={contentStyle}>
                  {children}
                </View>
              </ScrollView>
            ) : (
              <View ref={contentRef} style={contentStyle}>
                {children}
              </View>
            )}
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </KeyboardScreenContext.Provider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
  },
  centerContent: {
    justifyContent: 'center',
  },
});
