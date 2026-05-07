import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';

const TOOLBAR_ACTIONS = [
  actions.setBold,
  actions.setItalic,
  actions.setUnderline,
  actions.insertBulletsList,
  actions.insertOrderedList,
  actions.heading1,
  actions.insertLink,
  'highlight',
  actions.code,
];

const ICON_MAP = {
  [actions.setBold]: ({ tintColor, iconSize }) => <Feather name="bold" size={iconSize} color={tintColor} />,
  [actions.setItalic]: ({ tintColor, iconSize }) => <Feather name="italic" size={iconSize} color={tintColor} />,
  [actions.setUnderline]: ({ tintColor, iconSize }) => <Feather name="underline" size={iconSize} color={tintColor} />,
  [actions.insertBulletsList]: ({ tintColor, iconSize }) => <Feather name="list" size={iconSize} color={tintColor} />,
  [actions.insertOrderedList]: ({ tintColor, iconSize }) => <Feather name="align-left" size={iconSize} color={tintColor} />,
  [actions.heading1]: ({ tintColor, iconSize }) => <Feather name="type" size={iconSize} color={tintColor} />,
  [actions.insertLink]: ({ tintColor, iconSize }) => <Feather name="link" size={iconSize} color={tintColor} />,
  highlight: ({ tintColor, iconSize }) => <Feather name="star" size={iconSize} color={tintColor} />,
  [actions.code]: ({ tintColor, iconSize }) => <Feather name="code" size={iconSize} color={tintColor} />,
};

function isValidHttpUrl(value) {
  try {
    const parsed = new URL((value || '').trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function NoteEditor({
  value,
  resetKey,
  onChange,
  placeholder = 'Write your note...',
  children,
}) {
  const richTextRef = useRef(null);
  const [editorReady, setEditorReady] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const normalizedValue = useMemo(() => value || '', [value]);

  useEffect(() => {
    if (!editorReady || !richTextRef.current) {
      return;
    }

    richTextRef.current.setContentHTML(normalizedValue);
  }, [editorReady, resetKey]);

  const onInsertLink = () => {
    setLinkUrl('');
    setLinkLabel('');
    setShowLinkModal(true);
  };

  const applyLink = () => {
    const trimmedUrl = linkUrl.trim();
    const trimmedLabel = linkLabel.trim();
    if (!isValidHttpUrl(trimmedUrl)) {
      return;
    }
    richTextRef.current?.insertLink(trimmedLabel || trimmedUrl, trimmedUrl);
    setShowLinkModal(false);
  };

  const applyHighlight = () => {
    richTextRef.current?.setHiliteColor('#fff59d');
  };

  return (
    <View style={styles.container}>
      <RichToolbar
        editor={richTextRef}
        actions={TOOLBAR_ACTIONS}
        iconMap={ICON_MAP}
        onInsertLink={onInsertLink}
        highlight={applyHighlight}
        selectedButtonStyle={styles.toolbarButtonSelected}
        unselectedButtonStyle={styles.toolbarButton}
        iconTint="#bfdbfe"
        selectedIconTint="#ffffff"
        style={styles.toolbar}
        flatContainerStyle={styles.toolbarList}
      />

      <KeyboardAvoidingView
        style={styles.editorWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 84 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.editorCard}>
            <RichEditor
              ref={richTextRef}
              initialContentHTML={normalizedValue}
              placeholder={placeholder}
              useContainer
              initialHeight={320}
              defaultParagraphSeparator="p"
              style={styles.richEditor}
              editorInitializedCallback={() => setEditorReady(true)}
              onChange={onChange}
              editorStyle={{
                backgroundColor: '#111c31',
                color: '#f8fafc',
                caretColor: '#60a5fa',
                placeholderColor: 'rgba(148, 163, 184, 0.55)',
                contentCSSText:
                  'font-size: 16px; line-height: 1.65; min-height: 280px; padding: 16px; color: #f8fafc; white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word;',
                cssText:
                  'body { background-color: #111c31; color: #f8fafc; font-family: system-ui; } p { margin: 0 0 10px 0; } a { color: #93c5fd; } code { background: #0b1220; padding: 2px 4px; border-radius: 4px; }',
              }}
            />
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showLinkModal} transparent animationType="fade" onRequestClose={() => setShowLinkModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Insert Link</Text>
            <TextInput
              value={linkUrl}
              onChangeText={setLinkUrl}
              placeholder="https://example.com"
              placeholderTextColor="#9f93b7"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TextInput
              value={linkLabel}
              onChangeText={setLinkLabel}
              placeholder="Link text"
              placeholderTextColor="#9f93b7"
              style={styles.input}
            />
            <View style={styles.actionsRow}>
              <Pressable style={styles.secondaryBtn} onPress={() => setShowLinkModal(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, !isValidHttpUrl(linkUrl) ? styles.primaryBtnDisabled : null]}
                onPress={applyLink}
                disabled={!isValidHttpUrl(linkUrl)}
              >
                <Text style={styles.primaryBtnText}>Insert</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#263246',
    backgroundColor: '#0f172a',
    marginBottom: 12,
  },
  toolbarList: {
    paddingHorizontal: 8,
  },
  toolbarButton: {
    width: 42,
    height: 38,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarButtonSelected: {
    width: 42,
    height: 38,
    borderRadius: 12,
    marginHorizontal: 4,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorWrap: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  editorCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#263246',
    backgroundColor: '#111c31',
    overflow: 'hidden',
  },
  richEditor: {
    minHeight: 320,
    backgroundColor: '#111c31',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.58)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#263246',
    backgroundColor: '#0f172a',
    padding: 18,
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#111c31',
    borderWidth: 1,
    borderColor: '#263246',
    color: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    backgroundColor: 'rgba(15, 23, 42, 0.74)',
    marginRight: 8,
  },
  secondaryBtnText: {
    color: '#e2e8f0',
    fontWeight: '700',
  },
  primaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: '#2563eb',
    borderWidth: 1,
    borderColor: 'rgba(191, 219, 254, 0.6)',
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
