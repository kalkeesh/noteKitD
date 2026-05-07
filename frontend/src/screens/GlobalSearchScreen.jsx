import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { searchGlobal } from '../features/search/api';

const SEARCH_HISTORY_KEY = 'notekit.search.history';
const SEARCH_SUGGESTIONS = [
  'Meeting notes',
  'Project ideas',
  'Quick todos',
  'Daily plan',
  'Shopping list',
  'Follow up',
  'Deadlines',
  'This week',
];

function formatDateValue(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString();
}

function SearchGlyph() {
  return (
    <View style={styles.searchGlyph}>
      <View style={styles.searchGlyphCircle} />
      <View style={styles.searchGlyphHandle} />
    </View>
  );
}

function HistoryGlyph() {
  return (
    <View style={styles.historyGlyph}>
      <View style={styles.historyGlyphRing}>
        <View style={styles.historyGlyphHandShort} />
        <View style={styles.historyGlyphHandLong} />
      </View>
    </View>
  );
}

function SearchChip({ label, onPress }) {
  return (
    <Pressable style={styles.chip} onPress={() => onPress(label)}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

function HistoryRow({ value, onPress, onRemove }) {
  return (
    <View style={styles.historyRow}>
      <Pressable style={styles.historyRowMain} onPress={() => onPress(value)}>
        <HistoryGlyph />
        <Text style={styles.historyText} numberOfLines={1}>
          {value}
        </Text>
      </Pressable>
      <Pressable style={styles.historyRemoveBtn} onPress={() => onRemove(value)}>
        <Text style={styles.historyRemoveText}>x</Text>
      </Pressable>
    </View>
  );
}

function ResultCard({ title, preview, meta, onPress }) {
  return (
    <Pressable style={styles.resultCard} onPress={onPress}>
      <Text style={styles.resultTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.resultPreview} numberOfLines={3}>
        {preview}
      </Text>
      {meta ? (
        <Text style={styles.resultMeta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function GlobalSearchScreen({ navigation }) {
  const { session } = useAuth();
  const token = session?.token || '';
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ notes: [], todos: [] });
  const [searchedQuery, setSearchedQuery] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerRise = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(headerRise, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();
  }, [headerFade, headerRise]);

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      try {
        const raw = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
        if (!isMounted || !raw) {
          return;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setHistory(parsed.filter((item) => typeof item === 'string' && item.trim()));
        }
      } catch (storageError) {
        console.warn('Unable to load search history:', storageError);
      }
    }

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistHistory = async (nextHistory) => {
    setHistory(nextHistory);
    try {
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(nextHistory));
    } catch (storageError) {
      console.warn('Unable to save search history:', storageError);
    }
  };

  const saveRecentSearch = async (value) => {
    const trimmed = value.trim();
    if (trimmed.length <= 2) {
      return;
    }
    const nextHistory = [trimmed, ...history.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6);
    await persistHistory(nextHistory);
  };

  const removeHistoryItem = async (value) => {
    const nextHistory = history.filter((item) => item !== value);
    await persistHistory(nextHistory);
  };

  const clearHistory = async () => {
    await persistHistory([]);
  };

  const applySearchValue = (value) => {
    setQuery(value);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length <= 2) {
      setLoading(false);
      setResults({ notes: [], todos: [] });
      setSearchedQuery(trimmed);
      setError('');
      return undefined;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        setError('');
        const data = await searchGlobal(trimmed, token);
        setResults({
          notes: Array.isArray(data?.notes) ? data.notes : [],
          todos: Array.isArray(data?.todos) ? data.todos : [],
        });
        setSearchedQuery(trimmed);
        await saveRecentSearch(trimmed);
      } catch (err) {
        setResults({ notes: [], todos: [] });
        setSearchedQuery(trimmed);
        setError(err?.message || 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [query, token]);

  const isEmpty = useMemo(
    () => searchedQuery.length > 2 && !loading && results.notes.length === 0 && results.todos.length === 0,
    [loading, results.notes.length, results.todos.length, searchedQuery.length]
  );

  const showDiscovery = query.trim().length <= 2 && !loading;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.backgroundLayer}>
        <View style={styles.orbTop} />
        <View style={styles.orbBottom} />
        <View style={styles.orbCenter} />
      </View>

      <Animated.View style={[styles.shell, { opacity: headerFade, transform: [{ translateY: headerRise }] }]}>
        <View style={styles.topCapsule} />

        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>{'<'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Search</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.searchPanel}>
            <View style={styles.searchInputWrap}>
              <SearchGlyph />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder="Search notes and todos"
                placeholderTextColor="rgba(148, 163, 184, 0.55)"
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {query ? (
                <Pressable style={styles.searchClearBtn} onPress={() => setQuery('')}>
                  <Text style={styles.searchClearText}>x</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {showDiscovery ? (
            <View style={styles.discoveryBlock}>
              <Text style={styles.discoveryTitle}>Suggestions</Text>
              <View style={styles.chipsWrap}>
                {SEARCH_SUGGESTIONS.map((item) => (
                  <SearchChip key={item} label={item} onPress={applySearchValue} />
                ))}
              </View>
            </View>
          ) : null}

          {showDiscovery && history.length > 0 ? (
            <View style={styles.discoveryBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.discoveryTitle}>History</Text>
                <Pressable onPress={clearHistory}>
                  <Text style={styles.clearAllText}>Clear all</Text>
                </Pressable>
              </View>
              <View style={styles.historyCard}>
                {history.map((item) => (
                  <HistoryRow
                    key={item}
                    value={item}
                    onPress={applySearchValue}
                    onRemove={removeHistoryItem}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color="#93c5fd" />
              <Text style={styles.stateText}>Searching your notes and todos...</Text>
            </View>
          ) : null}

          {!loading && error ? (
            <View style={styles.stateCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!loading && results.notes.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              {results.notes.map((item) => (
                <ResultCard
                  key={`note-${item.id}`}
                  title={item.title}
                  preview={item.preview}
                  meta={formatDateValue(item.date)}
                  onPress={() => navigation.navigate('NoteKit', { initialTab: 'notes' })}
                />
              ))}
            </View>
          ) : null}

          {!loading && results.todos.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Todos</Text>
              {results.todos.map((item) => (
                <ResultCard
                  key={`todo-${item.id}`}
                  title={item.task}
                  preview={item.preview}
                  meta={formatDateValue(item.date)}
                  onPress={() => navigation.navigate('NoteKit', { initialTab: 'todos' })}
                />
              ))}
            </View>
          ) : null}

          {isEmpty ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>No results found</Text>
              <Text style={styles.stateText}>Try a broader keyword or tap one of the suggestions above.</Text>
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#090d16',
  },
  orbTop: {
    position: 'absolute',
    top: -80,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  orbBottom: {
    position: 'absolute',
    right: -80,
    bottom: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(139, 92, 246, 0.13)',
  },
  orbCenter: {
    position: 'absolute',
    top: '32%',
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
  },
  shell: {
    flex: 1,
  },
  topCapsule: {
    alignSelf: 'center',
    width: 84,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#3b82f6',
    marginTop: 10,
    marginBottom: 10,
    shadowColor: '#60a5fa',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSpacer: {
    width: 38,
    height: 38,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  searchPanel: {
    marginBottom: 20,
  },
  searchInputWrap: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
    shadowColor: '#020617',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 14,
    marginLeft: 12,
  },
  searchClearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  searchClearText: {
    color: 'rgba(226, 232, 240, 0.75)',
    fontSize: 16,
    lineHeight: 18,
  },
  searchGlyph: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGlyphCircle: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.6,
    borderColor: '#94a3b8',
  },
  searchGlyphHandle: {
    position: 'absolute',
    width: 7,
    height: 1.8,
    borderRadius: 999,
    backgroundColor: '#94a3b8',
    right: 1,
    bottom: 2,
    transform: [{ rotate: '45deg' }],
  },
  discoveryBlock: {
    marginBottom: 22,
  },
  discoveryTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.18)',
    backgroundColor: 'rgba(191, 219, 254, 0.12)',
  },
  chipText: {
    color: '#bfdbfe',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearAllText: {
    color: 'rgba(191, 219, 254, 0.78)',
    fontSize: 13,
    fontWeight: '500',
  },
  historyCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.08)',
  },
  historyRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  historyText: {
    color: '#e2e8f0',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  historyRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyRemoveText: {
    color: 'rgba(203, 213, 225, 0.65)',
    fontSize: 18,
    lineHeight: 20,
  },
  historyGlyph: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyGlyphRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.4,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyGlyphHandShort: {
    position: 'absolute',
    width: 1.4,
    height: 4.4,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    top: 3,
  },
  historyGlyphHandLong: {
    position: 'absolute',
    width: 4.2,
    height: 1.4,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    right: 3,
    top: 6,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  resultCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#020617',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  resultTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  resultPreview: {
    color: 'rgba(226, 232, 240, 0.78)',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  resultMeta: {
    color: 'rgba(147, 197, 253, 0.85)',
    fontSize: 11,
    marginTop: 9,
    fontWeight: '600',
  },
  stateCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  stateTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  stateText: {
    color: 'rgba(226, 232, 240, 0.72)',
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
