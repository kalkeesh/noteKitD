import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from '../config/api';
import { loadCachedData, saveCachedData } from '../config/offlineCache';
import { useAuth } from '../context/AuthContext';
import TodoEditorModal from '../features/workspace/components/TodoEditorModal';
import { styles } from '../features/workspace/styles';
import { toDateKey } from '../features/workspace/utils/calendar';
import { formatDisplayDate, formatDisplayTime } from '../utils/dateTime';
import { showAppAlert } from '../utils/appAlerts';

const FILTER_TODAY = 'today';
const FILTER_SCHEDULED = 'scheduled';
const FILTER_FINISHED = 'finished';
const FILTER_TOTAL = 'total';

function normalizeItems(items) {
  return (items || []).map((item, index) => ({
    id: item?.id ?? index + 1,
    text: item?.text || '',
    done: Boolean(item?.done),
    reminderDate: item?.reminderDate || '',
    reminderTime: item?.reminderTime || '',
    reminderEnabled: Boolean(item?.reminderEnabled),
    notificationId: item?.notificationId || '',
  }));
}

function formatTaskMeta(task) {
  const parts = [];
  const date = formatDisplayDate(task.reminderDate);
  const time = formatDisplayTime(task.reminderTime, '12h');
  if (date) {
    parts.push(date);
  }
  if (time) {
    parts.push(time);
  }
  return parts.join(' | ');
}

export default function ProjectTasksScreen({ navigation, route }) {
  const { session } = useAuth();
  const token = session?.token || '';
  const legacyUsername = session?.email ? encodeURIComponent(session.email) : '';
  const userCacheKey = session?.email || session?.name || 'current-user';
  const projectId = route?.params?.projectId || '';

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeFilter, setActiveFilter] = useState(FILTER_TOTAL);
  const [statsOpen, setStatsOpen] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editorItems, setEditorItems] = useState([]);

  const withLegacyUsername = useCallback(
    (path) => {
      if (!legacyUsername) {
        return path;
      }
      const separator = path.includes('?') ? '&' : '?';
      return `${path}${separator}username=${legacyUsername}`;
    },
    [legacyUsername]
  );

  const loadProject = useCallback(async () => {
    if (!projectId || !token) {
      setLoading(false);
      return;
    }
    let cachedProject = null;
    try {
      setLoading(true);
      const cachedTodos = await loadCachedData(userCacheKey, 'workspace_todos', []);
      cachedProject = (Array.isArray(cachedTodos) ? cachedTodos : []).find((item) => item.id === projectId);
      if (cachedProject) {
        setProject({
          ...cachedProject,
          listType: 'project',
          items: normalizeItems(cachedProject.items),
        });
        setLoading(false);
      }

      const data = await apiRequest(withLegacyUsername(`/api/todos/${projectId}`), 'GET', undefined, token);
      const normalizedProject = {
        ...data,
        listType: 'project',
        items: normalizeItems(data?.items),
      };
      setProject(normalizedProject);
      navigation.setOptions({
        title: data?.title || 'Project Tasks',
        headerStyle: { backgroundColor: '#090d16' },
        headerTintColor: '#f8fafc',
        headerTitleStyle: { color: '#f8fafc', fontWeight: '800' },
        headerRight: () => (
          <Pressable style={styles.projectScreenHeaderTick} onPress={() => navigation.goBack()}>
            <Feather name="check" size={22} color="#f8fafc" />
          </Pressable>
        ),
      });
    } catch (err) {
      if (cachedProject) {
        setProject({
          ...cachedProject,
          listType: 'project',
          items: normalizeItems(cachedProject.items),
        });
        showAppAlert('Offline view', 'Showing saved project tasks while the backend wakes up.');
      } else {
        showAppAlert('Unable to load project', err.message);
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
  }, [navigation, projectId, token, userCacheKey, withLegacyUsername]);

  const saveProjectToWorkspaceCache = useCallback(
    async (nextProject) => {
      const cachedTodos = await loadCachedData(userCacheKey, 'workspace_todos', []);
      if (!Array.isArray(cachedTodos)) {
        return;
      }
      const nextTodos = cachedTodos.map((todo) => (todo.id === nextProject.id ? nextProject : todo));
      await saveCachedData(userCacheKey, 'workspace_todos', nextTodos);
    },
    [userCacheKey]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: '#090d16' },
      headerTintColor: '#f8fafc',
      headerTitleStyle: { color: '#f8fafc', fontWeight: '800' },
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      loadProject();
    }, [loadProject])
  );

  const taskRows = useMemo(() => normalizeItems(project?.items), [project]);
  const todayKey = toDateKey(new Date());

  const stats = useMemo(() => {
    const todayTasks = taskRows.filter((task) => task.reminderDate === todayKey).length;
    const scheduledTasks = taskRows.filter((task) => Boolean(task.reminderDate || task.reminderTime) && !task.done).length;
    const finishedTasks = taskRows.filter((task) => task.done).length;
    const totalTasks = taskRows.length;
    return {
      [FILTER_TODAY]: todayTasks,
      [FILTER_SCHEDULED]: scheduledTasks,
      [FILTER_FINISHED]: finishedTasks,
      [FILTER_TOTAL]: totalTasks,
    };
  }, [taskRows, todayKey]);

  const filteredTasks = useMemo(() => {
    if (activeFilter === FILTER_TODAY) {
      return taskRows.filter((task) => task.reminderDate === todayKey);
    }
    if (activeFilter === FILTER_SCHEDULED) {
      return taskRows.filter((task) => Boolean(task.reminderDate || task.reminderTime) && !task.done);
    }
    if (activeFilter === FILTER_FINISHED) {
      return taskRows.filter((task) => task.done);
    }
    return taskRows;
  }, [activeFilter, taskRows, todayKey]);

  const saveProjectItems = async (itemsOverride) => {
    if (!project) {
      return;
    }
    const nextItems = normalizeItems(itemsOverride ?? project.items);
    try {
      setSaving(true);
      const updated = await apiRequest(
        withLegacyUsername(`/api/todos/${project.id}`),
        'PUT',
        {
          title: project.title || 'Untitled Project',
          listType: 'project',
          items: nextItems,
        },
        token
      );
      setProject({
        ...updated,
        listType: 'project',
        items: normalizeItems(updated.items),
      });
      await saveProjectToWorkspaceCache({
        ...updated,
        listType: 'project',
        items: normalizeItems(updated.items),
      });
    } catch (err) {
      showAppAlert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const onToggleTaskDone = async (itemId) => {
    if (!project) {
      return;
    }
    const nextItems = normalizeItems(project.items).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    setProject((prev) => (prev ? { ...prev, items: nextItems } : prev));
    await saveProjectItems(nextItems);
  };

  const onDeleteTask = async (itemId) => {
    if (!project) {
      return;
    }
    const nextItems = normalizeItems(project.items).filter((item) => item.id !== itemId);
    setProject((prev) => (prev ? { ...prev, items: nextItems } : prev));
    await saveProjectItems(nextItems);
  };

  const onDeleteProject = async () => {
    if (!project) {
      return;
    }
    try {
      setSaving(true);
      await apiRequest(withLegacyUsername(`/api/todos/${project.id}`), 'DELETE', undefined, token);
      const cachedTodos = await loadCachedData(userCacheKey, 'workspace_todos', []);
      if (Array.isArray(cachedTodos)) {
        await saveCachedData(
          userCacheKey,
          'workspace_todos',
          cachedTodos.filter((todo) => todo.id !== project.id)
        );
      }
      navigation.goBack();
    } catch (err) {
      showAppAlert('Delete failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const onAddTask = async () => {
    if (!project) {
      return;
    }
    const currentItems = normalizeItems(project.items);
    const maxId = currentItems.reduce((max, item) => (item.id > max ? item.id : max), 0);
    const nextItems = [
      ...currentItems,
      { id: maxId + 1, text: '', done: false, reminderDate: '', reminderTime: '', reminderEnabled: false, notificationId: '' },
    ];
    setProject((prev) => (prev ? { ...prev, items: nextItems } : prev));
    await saveProjectItems(nextItems);
  };

  const openTaskEditor = (task) => {
    setEditingItemId(task.id);
    setEditorItems([task]);
    setEditorVisible(true);
  };

  const closeTaskEditor = () => {
    if (saving) {
      return;
    }
    setEditorVisible(false);
    setEditingItemId(null);
    setEditorItems([]);
  };

  const updateEditorItem = (itemId, key, value) => {
    setEditorItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, [key]: value } : item)));
  };

  const saveEditedTask = async () => {
    if (!project || !editorItems[0]) {
      return;
    }
    const editedTask = editorItems[0];
    const nextItems = normalizeItems(project.items).map((item) =>
      item.id === editingItemId ? { ...item, ...editedTask } : item
    );
    setEditorVisible(false);
    setEditingItemId(null);
    setEditorItems([]);
    setProject((prev) => (prev ? { ...prev, items: nextItems } : prev));
    await saveProjectItems(nextItems);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.backgroundLayer}>
          <View style={styles.orbTop} />
          <View style={styles.orbBottom} />
          <View style={styles.orbCenter} />
        </View>
        <View style={styles.loaderWrap}>
          <ActivityIndicator color="#dcb7ff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backgroundLayer}>
        <View style={styles.orbTop} />
        <View style={styles.orbBottom} />
        <View style={styles.orbCenter} />
      </View>

      <ScrollView contentContainerStyle={[styles.todoModernWrap, styles.todoBoardWrapWithFab]} showsVerticalScrollIndicator={false}>
        <View style={styles.todoModernTitleRow}>
          <Text style={styles.todoModernTitle} numberOfLines={1}>
            {project?.title || 'Untitled Project'}
          </Text>
          <Pressable style={styles.todoModernProjectDelete} onPress={onDeleteProject} disabled={saving}>
            <Feather name="trash-2" size={12} color="rgba(148,163,184,0.65)" />
          </Pressable>
        </View>

        <View style={styles.todoFilterDropdownWrap}>
          <Pressable style={styles.todoFilterDropdownHead} onPress={() => setStatsOpen((prev) => !prev)}>
            <Text style={styles.todoFilterDropdownHeadText}>Task Counts</Text>
            <Text style={styles.todoFilterDropdownChevron}>{statsOpen ? '\u25B2' : '\u25BC'}</Text>
          </Pressable>
        </View>

        {statsOpen ? (
          <View style={styles.todoStatsGrid}>
            <Pressable
              style={[styles.todoStatCard, activeFilter === FILTER_TODAY ? styles.todoStatCardActive : null]}
              onPress={() => setActiveFilter(FILTER_TODAY)}
            >
              <Text style={styles.todoStatValue}>{stats[FILTER_TODAY]}</Text>
              <Text style={styles.todoStatLabel}>Today Tasks</Text>
            </Pressable>
            <Pressable
              style={[styles.todoStatCard, activeFilter === FILTER_SCHEDULED ? styles.todoStatCardActive : null]}
              onPress={() => setActiveFilter(FILTER_SCHEDULED)}
            >
              <Text style={styles.todoStatValue}>{stats[FILTER_SCHEDULED]}</Text>
              <Text style={styles.todoStatLabel}>Scheduled</Text>
            </Pressable>
            <Pressable
              style={[styles.todoStatCard, activeFilter === FILTER_FINISHED ? styles.todoStatCardActive : null]}
              onPress={() => setActiveFilter(FILTER_FINISHED)}
            >
              <Text style={styles.todoStatValue}>{stats[FILTER_FINISHED]}</Text>
              <Text style={styles.todoStatLabel}>Finished</Text>
            </Pressable>
            <Pressable
              style={[styles.todoStatCard, activeFilter === FILTER_TOTAL ? styles.todoStatCardActive : null]}
              onPress={() => setActiveFilter(FILTER_TOTAL)}
            >
              <Text style={styles.todoStatValue}>{stats[FILTER_TOTAL]}</Text>
              <Text style={styles.todoStatLabel}>Total Tasks</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.todoModernSectionHeader}>
          <Text style={styles.todoModernSectionTitle}>Tasks</Text>
          <Text style={styles.todoModernSectionCount}>{filteredTasks.length} shown</Text>
        </View>

        {filteredTasks.length === 0 ? <Text style={styles.todoEmptyText}>No tasks in this filter.</Text> : null}

        {filteredTasks.map((task) => (
          <Pressable key={`${project?.id}-${task.id}`} style={styles.projectTaskCard} onPress={() => openTaskEditor(task)}>
            <View style={styles.projectTaskCardTop}>
              <Pressable
                style={[styles.taskCheckbox, task.done ? styles.taskCheckboxDone : null]}
                onPress={(event) => {
                  event.stopPropagation();
                  onToggleTaskDone(task.id);
                }}
              >
                <Text style={[styles.taskCheckboxText, task.done ? styles.taskCheckboxTextDone : null]}>
                  {task.done ? '\u2713' : ''}
                </Text>
              </Pressable>
              <Pressable
                style={styles.todoModernTaskDelete}
                onPress={(event) => {
                  event.stopPropagation();
                  onDeleteTask(task.id);
                }}
              >
                <Feather name="trash-2" size={12} color="rgba(148,163,184,0.58)" />
              </Pressable>
            </View>
            <Text style={[styles.projectTaskCardTitle, task.done ? styles.doneText : null]} numberOfLines={3}>
              {task.text || 'Untitled task'}
            </Text>
            {formatTaskMeta(task) ? <Text style={styles.projectTaskCardMeta}>{formatTaskMeta(task)}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.todoFabStack}>
        <Pressable style={styles.fab} onPress={onAddTask}>
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      </View>

      <TodoEditorModal
        visible={editorVisible}
        editingTodoId={editingItemId}
        todoType="task"
        todoTitle=""
        todoItems={editorItems}
        submitting={saving}
        onChangeTitle={() => {}}
        onClose={closeTaskEditor}
        onSave={saveEditedTask}
        onToggleDone={(itemId) => updateEditorItem(itemId, 'done', !(editorItems.find((item) => item.id === itemId)?.done))}
        onChangeItemText={(itemId, value) => updateEditorItem(itemId, 'text', value)}
        onChangeItemDate={(itemId, value) => updateEditorItem(itemId, 'reminderDate', value)}
        onChangeItemTime={(itemId, value) => updateEditorItem(itemId, 'reminderTime', value)}
        onChangeItemReminderEnabled={(itemId, value) => updateEditorItem(itemId, 'reminderEnabled', value)}
        onRemoveItem={() => {}}
        onAddItem={() => {}}
      />
    </SafeAreaView>
  );
}
