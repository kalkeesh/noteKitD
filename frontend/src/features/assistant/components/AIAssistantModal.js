import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';

import { useAuth } from '../../../context/AuthContext';
import { submitAssistantCommand, transcribeAssistantAudio } from '../api';
import { emitAssistantEvent } from '../events';
import { syncAssistantReminderIfNeeded } from '../reminderSync';

const INITIAL_GREETING = "I'm ready.";
const STARTER_SUGGESTIONS = [
  'Create a note for gym plan',
  'Add a task for tomorrow 9 AM',
  'Log Rs 200 food expense',
];

function createMessage(role, text, options = {}) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    role,
    text,
    suggestions: options.suggestions || [],
    parsedLabel: options.parsedLabel || '',
  };
}

function buildParsedLabel(response) {
  const intentType = response?.intent_type || '';
  const action = response?.parsed_command?.action || '';
  if (intentType === 'chat') {
    return 'Chat';
  }
  if (!action || action === 'unknown') {
    return '';
  }
  return `Action: ${action.replace(/_/g, ' ')}`;
}

function buildAssistantText(response, warning = '') {
  const base = response?.follow_up_question || response?.message || "I didn't fully understand.";
  return warning ? `${base}\n${warning}` : base;
}

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createLoop = (target, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(target, { toValue: -5, duration: 240, useNativeDriver: true }),
          Animated.timing(target, { toValue: 0, duration: 240, useNativeDriver: true }),
          Animated.delay(180),
        ])
      );

    const animations = [createLoop(dot1, 0), createLoop(dot2, 120), createLoop(dot3, 240)];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingDotsWrap}>
      {[dot1, dot2, dot3].map((dot, index) => (
        <Animated.View
          key={`dot-${index + 1}`}
          style={[styles.typingDot, { transform: [{ translateY: dot }] }]}
        />
      ))}
    </View>
  );
}

function RecordingBars() {
  const bar1 = useRef(new Animated.Value(0.35)).current;
  const bar2 = useRef(new Animated.Value(0.8)).current;
  const bar3 = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const animateBar = (value, min, max, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: max, duration: 280, useNativeDriver: true }),
          Animated.timing(value, { toValue: min, duration: 280, useNativeDriver: true }),
        ])
      );

    const animations = [
      animateBar(bar1, 0.35, 0.95, 0),
      animateBar(bar2, 0.25, 1, 90),
      animateBar(bar3, 0.4, 0.85, 180),
    ];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [bar1, bar2, bar3]);

  return (
    <View style={styles.recordingBars}>
      {[bar1, bar2, bar3].map((bar, index) => (
        <Animated.View
          key={`bar-${index + 1}`}
          style={[styles.recordingBar, { transform: [{ scaleY: bar }] }]}
        />
      ))}
    </View>
  );
}

function inferAudioAsset(uri) {
  const extension = (uri.split('.').pop() || '').toLowerCase();
  if (extension === 'webm') {
    return { name: 'voice-command.webm', type: 'audio/webm' };
  }
  if (extension === 'caf') {
    return { name: 'voice-command.caf', type: 'audio/x-caf' };
  }
  if (extension === 'wav') {
    return { name: 'voice-command.wav', type: 'audio/wav' };
  }
  return {
    name: Platform.OS === 'web' ? 'voice-command.webm' : 'voice-command.m4a',
    type: Platform.OS === 'web' ? 'audio/webm' : 'audio/m4a',
  };
}

export default function AIAssistantModal({ visible, onClose, onActionComplete }) {
  const { session } = useAuth();
  const token = session?.token || '';
  const scrollRef = useRef(null);
  const lastSubmitAtRef = useRef(0);
  const recordingRef = useRef(null);

  const [messages, setMessages] = useState(() => [createMessage('assistant', INITIAL_GREETING)]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [pendingCommand, setPendingCommand] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);

  const busy = loading || transcribing;
  const canSubmit = useMemo(() => input.trim().length > 0 && !busy, [input, busy]);
  const hasUserMessage = useMemo(() => messages.some((message) => message.role === 'user'), [messages]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 40);
    return () => clearTimeout(timer);
  }, [messages, visible, loading, transcribing]);

  const appendAssistantMessage = (response, warning = '') => {
    setMessages((prev) => [
      ...prev,
      createMessage('assistant', buildAssistantText(response, warning), {
        parsedLabel: buildParsedLabel(response),
        suggestions: response?.suggestions || [],
      }),
    ]);
  };

  const handleAssistantResponse = async (response) => {
    let finalResponse = response;
    let warning = '';

    if (response?.intent_type === 'action') {
      try {
        const synced = await syncAssistantReminderIfNeeded(response, token);
        finalResponse = { ...response, resource: synced.resource || response.resource };
        warning = synced.warning || '';
      } catch (err) {
        warning = err?.message || 'The action was saved, but reminder sync could not finish.';
      }
    }

    appendAssistantMessage(finalResponse, warning);

    if (finalResponse?.needs_follow_up) {
      setPendingCommand(finalResponse.parsed_command || null);
      return;
    }

    setPendingCommand(null);
    if (finalResponse?.ok && finalResponse?.intent_type === 'action') {
      emitAssistantEvent({
        type: 'assistant-action-complete',
        resourceType: finalResponse.resource_type,
        resource: finalResponse.resource,
      });
      onActionComplete?.(finalResponse);
    }
  };

  const submitText = async (text) => {
    const now = Date.now();
    if (busy || now - lastSubmitAtRef.current < 900) {
      return;
    }
    lastSubmitAtRef.current = now;
    setLoading(true);
    setError('');

    const context = pendingCommand ? { pending_command: pendingCommand } : null;

    try {
      const response = await submitAssistantCommand({ text, context, token });
      await handleAssistantResponse(response);
    } catch (err) {
      const fallbackMessage = err?.message || 'Assistant request failed.';
      setError(fallbackMessage);
      appendAssistantMessage({
        message:
          "I didn't fully understand. You can try:\n- create a note called gym plan with points warmup, pushups, situps\n- create a task buy milk at 9:45 am tomorrow",
        suggestions: [
          'create a note called gym plan with points warmup, pushups, situps',
          'create a task buy milk at 9:45 am tomorrow',
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const onSend = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text) {
      return;
    }
    if (!token) {
      setMessages((prev) => [
        ...prev,
        createMessage('user', text),
        createMessage('assistant', 'Please log in first to use the assistant.'),
      ]);
      setInput('');
      return;
    }

    setMessages((prev) => [...prev, createMessage('user', text)]);
    setInput('');
    await submitText(text);
  };

  const startRecording = async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      appendAssistantMessage({ message: 'Microphone permission is required for voice input.' });
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    recordingRef.current = recording;
    setIsRecording(true);
  };

  const stopRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) {
      return;
    }

    setIsRecording(false);
    setTranscribing(true);
    setError('');

    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const uri = recording.getURI() || '';
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const duration = Number(status?.durationMillis || 0);

      if (!uri || duration < 500) {
        appendAssistantMessage({
          message: 'That recording was too short. Please try again and speak for a bit longer.',
        });
        return;
      }

      const audioAsset = inferAudioAsset(uri);
      const transcription = await transcribeAssistantAudio({
        audio: {
          uri,
          name: audioAsset.name,
          type: audioAsset.type,
        },
        token,
      });
      const transcriptText = (transcription?.text || '').trim();
      if (!transcriptText) {
        appendAssistantMessage({
          message: transcription?.message || 'I could not transcribe that audio clearly. Please try again.',
        });
        return;
      }

      setMessages((prev) => [...prev, createMessage('user', transcriptText)]);
      setTranscribing(false);
      await submitText(transcriptText);
    } catch (err) {
      setError(err?.message || 'Voice capture failed.');
      appendAssistantMessage({
        message: 'Voice capture failed. Try again or type your request instead.',
      });
    } finally {
      recordingRef.current = null;
      setTranscribing(false);
    }
  };

  const toggleRecording = async () => {
    if (busy) {
      return;
    }
    if (!token) {
      appendAssistantMessage({ message: 'Please log in first to use the assistant.' });
      return;
    }
    if (isRecording) {
      await stopRecording();
      return;
    }
    try {
      await startRecording();
    } catch (err) {
      setIsRecording(false);
      appendAssistantMessage({
        message: 'Voice capture failed. Try again or type your request instead.',
      });
    }
  };

  const handleSuggestionPress = async (suggestion) => {
    if (busy) {
      return;
    }
    await onSend(suggestion);
  };

  const handleClose = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch {
        // Ignore close-time recorder failures.
      } finally {
        recordingRef.current = null;
        setIsRecording(false);
      }
    }
    onClose?.();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>AI Assistant</Text>
                  <Pressable style={styles.infoBtn} onPress={() => setInfoVisible(true)}>
                    <Feather name="info" size={14} color="#33506d" />
                  </Pressable>
                </View>
                {pendingCommand?.missing_fields?.length ? (
                  <Text style={styles.pendingText}>
                    Waiting for: {pendingCommand.missing_fields.join(', ')}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={handleClose} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#33506d" />
              </Pressable>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.chatArea}
              contentContainerStyle={styles.chatContent}
              keyboardShouldPersistTaps="handled"
            >
              {!hasUserMessage ? (
                <View style={styles.starterWrap}>
                  {STARTER_SUGGESTIONS.map((suggestion) => (
                    <Pressable
                      key={suggestion}
                      style={styles.starterChip}
                      onPress={() => handleSuggestionPress(suggestion)}
                      disabled={busy}
                    >
                      <Text style={styles.starterChipText}>{suggestion}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageBubble,
                    message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                  ]}
                >
                  {message.parsedLabel ? <Text style={styles.parsedLabel}>{message.parsedLabel}</Text> : null}
                  <Text style={message.role === 'user' ? styles.userText : styles.assistantText}>{message.text}</Text>
                  {!hasUserMessage
                    ? message.suggestions?.map((suggestion) => (
                        <Pressable
                          key={`${message.id}-${suggestion}`}
                          style={styles.suggestionChip}
                          onPress={() => handleSuggestionPress(suggestion)}
                          disabled={busy}
                        >
                          <Text style={styles.suggestionText}>{suggestion}</Text>
                        </Pressable>
                      ))
                    : null}
                </View>
              ))}

              {loading || transcribing ? (
                <View style={[styles.messageBubble, styles.assistantBubble, styles.loadingBubble]}>
                  {transcribing ? <RecordingBars /> : <TypingDots />}
                  <Text style={styles.loadingText}>{transcribing ? 'Listening...' : 'Typing...'}</Text>
                </View>
              ) : null}
            </ScrollView>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Type a message or answer a follow-up question..."
                placeholderTextColor="#7a8ca4"
                multiline
                editable={!busy}
              />
              <Pressable
                style={[styles.iconBtn, isRecording ? styles.iconBtnRecording : null, busy ? styles.iconBtnDisabled : null]}
                onPress={toggleRecording}
                disabled={busy}
              >
                {isRecording ? <RecordingBars /> : <Feather name="mic" size={18} color="#ffffff" />}
              </Pressable>
              <Pressable
                style={[styles.sendBtn, !canSubmit ? styles.sendBtnDisabled : null]}
                onPress={() => onSend()}
                disabled={!canSubmit}
              >
                <Feather name="send" size={18} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>

      <Modal visible={infoVisible} transparent animationType="fade" onRequestClose={() => setInfoVisible(false)}>
        <View style={styles.infoOverlay}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoTitle}>How to use AI</Text>
              <Pressable style={styles.infoCloseBtn} onPress={() => setInfoVisible(false)}>
                <Feather name="x" size={16} color="#33506d" />
              </Pressable>
            </View>
            <Text style={styles.infoLine}>Type or speak naturally.</Text>
            <Text style={styles.infoLine}>You can create notes, tasks, and budget entries.</Text>
            <Text style={styles.infoLine}>If details are missing, the assistant asks a short follow-up.</Text>
            <Text style={styles.infoLine}>Tap a suggestion before your first message for a quick start.</Text>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'flex-end',
  },
  keyboardWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    minHeight: '58%',
    maxHeight: '86%',
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
  },
  pendingText: {
    marginTop: 6,
    color: '#93c5fd',
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(30,41,59,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
  },
  infoBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(30,41,59,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
  },
  chatArea: {
    marginTop: 16,
  },
  chatContent: {
    paddingBottom: 16,
    gap: 10,
  },
  messageBubble: {
    maxWidth: '92%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#1d4ed8',
  },
  assistantText: {
    color: '#e2e8f0',
    lineHeight: 20,
  },
  userText: {
    color: '#ffffff',
    lineHeight: 20,
  },
  parsedLabel: {
    marginBottom: 6,
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(30,41,59,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestionText: {
    color: '#dbeafe',
    fontSize: 12,
    fontWeight: '600',
  },
  starterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  starterChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(30,41,59,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  starterChipText: {
    color: '#dbeafe',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#cbd5e1',
    fontWeight: '700',
  },
  typingDotsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#60a5fa',
  },
  recordingBars: {
    width: 18,
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  recordingBar: {
    width: 3,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#e2e8f0',
    textAlignVertical: 'top',
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1d4ed8',
  },
  iconBtnRecording: {
    backgroundColor: '#dc2626',
  },
  iconBtnDisabled: {
    backgroundColor: '#475569',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
  },
  sendBtnDisabled: {
    backgroundColor: '#475569',
  },
  errorText: {
    marginBottom: 8,
    color: '#f87171',
    fontWeight: '600',
  },
  infoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  infoCard: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: '#0f172a',
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  infoTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  infoCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(30,41,59,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLine: {
    color: '#cbd5e1',
    lineHeight: 20,
    marginTop: 6,
  },
});
