import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';

import LinkPreviewCard from '../../../components/LinkPreviewCard';
import NoteEditor from '../../../components/NoteEditor';
import { fetchLinkPreview } from '../../linkPreview/api';
import { styles } from '../styles';

const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

function extractUrls(content) {
  const matches = String(content || '').match(URL_REGEX) || [];
  return [...new Set(matches.map((item) => item.trim()))];
}

export default function NoteEditorModal({
  visible,
  editingNoteId,
  editorSessionKey,
  noteTitle,
  noteContent,
  submitting,
  onChangeTitle,
  onChangeContent,
  onClose,
  onSave,
}) {
  const [previewCache, setPreviewCache] = useState({});
  const [loadingUrls, setLoadingUrls] = useState({});
  const urls = useMemo(() => extractUrls(noteContent), [noteContent]);

  useEffect(() => {
    if (!visible || urls.length === 0) {
      return undefined;
    }

    const missingUrls = urls.filter((url) => !(url in previewCache) && !loadingUrls[url]);
    if (missingUrls.length === 0) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      missingUrls.forEach(async (url) => {
        try {
          setLoadingUrls((prev) => ({ ...prev, [url]: true }));
          const preview = await fetchLinkPreview(url);
          setPreviewCache((prev) => ({ ...prev, [url]: preview }));
        } catch {
          setPreviewCache((prev) => ({ ...prev, [url]: null }));
        } finally {
          setLoadingUrls((prev) => {
            const next = { ...prev };
            delete next[url];
            return next;
          });
        }
      });
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [loadingUrls, previewCache, urls, visible]);

  const activePreviews = urls
    .map((url) => ({ url, preview: previewCache[url], loading: Boolean(loadingUrls[url]) }))
    .filter((item) => item.loading || item.preview);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.fullScreenModalCard}>
        <Text style={styles.modalTitle}>{editingNoteId ? 'Edit Note' : 'Add Note'}</Text>
        <TextInput
          style={styles.titleInput}
          placeholder="Title"
          placeholderTextColor="#9f93b7"
          value={noteTitle}
          onChangeText={onChangeTitle}
        />
        <NoteEditor
          value={noteContent}
          resetKey={editorSessionKey}
          onChange={onChangeContent}
          placeholder="Write your note..."
        >
          {activePreviews.map((item) =>
            item.loading ? (
              <View key={item.url} style={styles.linkPreviewLoader}>
                <ActivityIndicator color="#d9a4ff" />
                <Text style={styles.linkPreviewLoaderText}>Loading preview...</Text>
              </View>
            ) : (
              <LinkPreviewCard key={item.url} preview={item.preview} />
            )
          )}
        </NoteEditor>
        <View style={styles.modalActions}>
          <Pressable style={styles.secondaryBtn} onPress={onClose} disabled={submitting}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={onSave} disabled={submitting}>
            <Text style={styles.primaryBtnText}>{submitting ? 'Saving...' : 'Save'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
