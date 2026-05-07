import React, { useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { styles } from '../styles';

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const ACCENT_COLORS = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#f43f5e', '#22c55e'];

function formatNoteDate(note) {
  const raw = note?.updated_at || note?.created_at;
  if (!raw) {
    return '';
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const now = new Date();
  const noteDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today - noteDay) / 86400000);

  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function NoteCard({ note, onDelete, onEdit }) {
  const accentColor = ACCENT_COLORS[Math.abs(String(note?.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % ACCENT_COLORS.length];

  return (
    <Pressable style={styles.noteCard} onPress={() => onEdit(note)}>
      <View style={[styles.noteAccentStrip, { backgroundColor: accentColor }]} />
      <Pressable
        style={styles.deleteIconWrap}
        onPress={(event) => {
          event.stopPropagation();
          onDelete(note);
        }}
      >
        <Feather name="x" size={10} color="rgba(148,163,184,0.5)" />
      </Pressable>
      <Text style={styles.noteTitle} numberOfLines={2}>
        {note.title}
      </Text>
      <Text style={styles.noteContent} numberOfLines={4}>
        {stripHtml(note.content)}
      </Text>
      <Text style={styles.noteDate}>{formatNoteDate(note)}</Text>
    </Pressable>
  );
}

export default function NotesGrid({ notes, onDeleteNote, onEditNote }) {
  const data = useMemo(() => notes || [], [notes]);

  return (
    <FlatList
      data={data}
      numColumns={2}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.notesGrid}
      columnWrapperStyle={styles.notesGridRow}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <View style={styles.noteCardColumn}>
          <NoteCard note={item} onDelete={onDeleteNote} onEdit={onEditNote} />
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.notesEmptyState}>
          <Text style={styles.todoEmptyText}>No notes yet. Tap New to create your first note.</Text>
        </View>
      }
    />
  );
}
