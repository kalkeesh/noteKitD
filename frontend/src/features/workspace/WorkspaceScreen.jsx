import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { apiRequest } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { loadCachedData, saveCachedData } from '../../config/offlineCache';
import { saveSession } from '../../config/sessionStorage';
import BudgetCalendarScreen from '../../screens/BudgetCalendarScreen';
import CalendarView from './components/CalendarView';
import BudgetDashboard from '../../screens/BudgetDashboard';
import NoteEditorModal from './components/NoteEditorModal';
import NotesGrid from './components/NotesGrid';
import ProfileDetailsModal from './components/ProfileDetailsModal';
import ProfileImageModal from './components/ProfileImageModal';
import SidebarDrawer from './components/SidebarDrawer';
import TodoEditorModal from './components/TodoEditorModal';
import TodosGrid from './components/TodosGrid';
import WorkspaceHeader from './components/WorkspaceHeader';
import { TAB_BUDGETIFY, TAB_CALENDAR, TAB_NOTES, TAB_TODOS } from './constants';
import { cancelNotifications, getTodoReminderTrigger, scheduleNotification } from '../notifications/service';
import { subscribeAssistantEvents } from '../assistant/events';
import { showAppAlert } from '../../utils/appAlerts';
import { styles } from './styles';

function normalizeTodoItems(items) {
  return (items || []).map((item) => ({
    id: item?.id ?? null,
    text: item?.text || '',
    done: Boolean(item?.done),
    reminderDate: item?.reminderDate || '',
    reminderTime: item?.reminderTime || '',
    reminderEnabled: Boolean(item?.reminderEnabled),
    notificationId: item?.notificationId || '',
  }));
}

function getTodoNotificationIds(items) {
  return (items || []).map((item) => item?.notificationId || '').filter(Boolean);
}

function buildTodoReminderTitle(todoType, todoTitle, item) {
  if (todoType === 'task') {
    return `Task Due: ${item?.text?.trim() || todoTitle || 'Untitled task'}`;
  }
  return `Project Task Due: ${item?.text?.trim() || todoTitle?.trim() || 'Task'}`;
}

async function scheduleTodoItems(items, todoType, todoTitle) {
  const scheduledIds = [];

  try {
    const nextItems = [];
    for (const item of items || []) {
      const normalized = {
        ...item,
        reminderEnabled: Boolean(item?.reminderEnabled),
        notificationId: '',
      };

      if (normalized.reminderEnabled && !normalized.done) {
        const trigger = getTodoReminderTrigger(normalized);
        const notificationId = await scheduleNotification(
          buildTodoReminderTitle(todoType, todoTitle, normalized),
          'Scheduled in 1 hour.',
          trigger
        );
        normalized.notificationId = notificationId;
        scheduledIds.push(notificationId);
      }

      nextItems.push(normalized);
    }

    return { items: nextItems, scheduledIds };
  } catch (err) {
    await cancelNotifications(scheduledIds);
    throw err;
  }
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function NotesSearchIcon() {
  return (
    <View style={styles.notesSearchIcon}>
      <View style={styles.notesSearchIconCircle} />
      <View style={styles.notesSearchIconHandle} />
    </View>
  );
}

export default function WorkspaceScreen({ navigation, route }) {
  const { session, setSession, logout } = useAuth();
  const token = session?.token || '';
  const name = session?.name || 'User';
  const userCacheKey = session?.email || session?.name || 'current-user';
  const profileImageKeyFromSession = session?.profileImageKey || '';
  const legacyUsername = session?.email ? encodeURIComponent(session.email) : '';

  const requestedInitialTab = route?.params?.initialTab;
  const initialTab =
    requestedInitialTab === TAB_TODOS
      ? TAB_TODOS
      : requestedInitialTab === TAB_CALENDAR
        ? TAB_CALENDAR
        : requestedInitialTab === TAB_BUDGETIFY
          ? TAB_BUDGETIFY
        : TAB_NOTES;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfileImage, setSavingProfileImage] = useState(false);
  const [profileDetailsVisible, setProfileDetailsVisible] = useState(false);
  const drawerAnim = useRef(new Animated.Value(0)).current;

  const [notes, setNotes] = useState([]);
  const [todos, setTodos] = useState([]);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedProfileImageKey, setSelectedProfileImageKey] = useState(profileImageKeyFromSession);
  const [profileImageOptions, setProfileImageOptions] = useState([]);

  const [noteEditorVisible, setNoteEditorVisible] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteEditorSessionKey, setNoteEditorSessionKey] = useState(0);

  const [todoEditorVisible, setTodoEditorVisible] = useState(false);
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [todoEditorType, setTodoEditorType] = useState('project');
  const [todoTitle, setTodoTitle] = useState('');
  const [todoItems, setTodoItems] = useState([]);
  const [todoCreateMenuOpen, setTodoCreateMenuOpen] = useState(false);
  const [showAddSpend, setShowAddSpend] = useState(false);
  const [calendarMode, setCalendarMode] = useState('tasks');

  const handleAuthFailure = useCallback(async () => {
    await logout();
  }, [logout]);

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

  const setNotesAndCache = useCallback(
    (nextNotes) => {
      setNotes((prev) => {
        const resolvedValue = typeof nextNotes === 'function' ? nextNotes(prev) : nextNotes;
        const resolved = Array.isArray(resolvedValue) ? resolvedValue : [];
        saveCachedData(userCacheKey, 'workspace_notes', resolved);
        return resolved;
      });
    },
    [userCacheKey]
  );

  const setTodosAndCache = useCallback(
    (nextTodos) => {
      setTodos((prev) => {
        const resolvedValue = typeof nextTodos === 'function' ? nextTodos(prev) : nextTodos;
        const resolved = Array.isArray(resolvedValue) ? resolvedValue : [];
        saveCachedData(userCacheKey, 'workspace_todos', resolved);
        return resolved;
      });
    },
    [userCacheKey]
  );

  const loadWorkspace = useCallback(async () => {
    if (!token) {
      setLoading(false);
      showAppAlert('Login required', 'Your session expired. Please login again.');
      await handleAuthFailure();
      return;
    }

    try {
      setLoading(true);
      const [cachedNotes, cachedTodos] = await Promise.all([
        loadCachedData(userCacheKey, 'workspace_notes', []),
        loadCachedData(userCacheKey, 'workspace_todos', []),
      ]);
      if (Array.isArray(cachedNotes) && cachedNotes.length > 0) {
        setNotes(cachedNotes);
      }
      if (Array.isArray(cachedTodos) && cachedTodos.length > 0) {
        setTodos(cachedTodos);
      }
      if (
        (Array.isArray(cachedNotes) && cachedNotes.length > 0) ||
        (Array.isArray(cachedTodos) && cachedTodos.length > 0)
      ) {
        setLoading(false);
      }

      const [notesData, todosData] = await Promise.all([
        apiRequest(withLegacyUsername('/api/notes'), 'GET', undefined, token),
        apiRequest(withLegacyUsername('/api/todos'), 'GET', undefined, token),
      ]);
      setNotesAndCache(Array.isArray(notesData) ? notesData : []);
      setTodosAndCache(Array.isArray(todosData) ? todosData : []);

      try {
        const profileData = await apiRequest('/api/profile', 'GET', undefined, token);
        const options = Array.isArray(profileData?.allowedProfileImageKeys)
          ? profileData.allowedProfileImageKeys
          : [];
        setProfileImageOptions(options);
        const fallbackKey = options[0] || '';
        const profileKey = profileData?.profileImageKey || fallbackKey;
        setSelectedProfileImageKey(profileKey);
        setSession((prev) => {
          const base = prev || {};
          if (base.profileImageKey === profileKey) {
            return prev;
          }
          const next = { ...base, profileImageKey: profileKey };
          saveSession(next).catch((storageError) => {
            console.warn('Session persistence failed during profile sync:', storageError);
          });
          return next;
        });
      } catch {
        setProfileImageOptions([]);
        setSelectedProfileImageKey(profileImageKeyFromSession);
      }
    } catch (err) {
      if ((err.message || '').toLowerCase().includes('token')) {
        showAppAlert('Session expired', 'Please login again.');
        await handleAuthFailure();
        return;
      }
      const [cachedNotes, cachedTodos] = await Promise.all([
        loadCachedData(userCacheKey, 'workspace_notes', []),
        loadCachedData(userCacheKey, 'workspace_todos', []),
      ]);
      const hasCache =
        (Array.isArray(cachedNotes) && cachedNotes.length > 0) ||
        (Array.isArray(cachedTodos) && cachedTodos.length > 0);
      if (hasCache) {
        setNotes(Array.isArray(cachedNotes) ? cachedNotes : []);
        setTodos(Array.isArray(cachedTodos) ? cachedTodos : []);
        showAppAlert('Offline view', 'Showing your last saved workspace while the backend wakes up.');
      } else {
        showAppAlert('Unable to load data', err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [
    handleAuthFailure,
    profileImageKeyFromSession,
    setSession,
    setNotesAndCache,
    setTodosAndCache,
    token,
    userCacheKey,
    withLegacyUsername,
  ]);

  useFocusEffect(
    useCallback(() => {
      loadWorkspace();
    }, [loadWorkspace])
  );

  useEffect(() => {
    return subscribeAssistantEvents((event) => {
      if (event?.type === 'assistant-action-complete') {
        loadWorkspace();
      }
    });
  }, [loadWorkspace]);

  const onLogout = async () => {
    closeSidebar();
    await logout();
  };

  const closeSidebar = useCallback(() => {
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setSidebarOpen(false));
  }, [drawerAnim]);

  const openSidebar = useCallback(() => {
    setSidebarOpen(true);
    Animated.timing(drawerAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [drawerAnim]);

  const toggleSidebar = useCallback(() => {
    if (sidebarOpen) {
      closeSidebar();
      return;
    }
    openSidebar();
  }, [closeSidebar, openSidebar, sidebarOpen]);

  const onSelectTab = useCallback(
    (tab) => {
      setTodoCreateMenuOpen(false);
    if (tab === TAB_BUDGETIFY) {
      setActiveTab(TAB_BUDGETIFY);
      closeSidebar();
      return;
    }
    if (tab === TAB_CALENDAR) {
      setCalendarMode('tasks');
    }
    setActiveTab(tab);
    closeSidebar();
  },
    [closeSidebar, navigation]
  );

  const onRefreshPress = async () => {
    try {
      closeSidebar();
      setRefreshing(true);
      await apiRequest('/api/health', 'GET');
      await loadWorkspace();
      navigation.replace('NoteKit');
      showAppAlert('Refreshed', 'Backend is reachable and workspace data was refreshed.');
    } catch (err) {
      showAppAlert('Refresh failed', err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const openSettingsPage = () => {
    closeSidebar();
    navigation.navigate('Settings');
  };

  const openSupportDevPage = () => {
    closeSidebar();
    navigation.navigate('SupportDev');
  };

  const openBudgetifyPage = () => {
    closeSidebar();
    setActiveTab(TAB_BUDGETIFY);
  };

  const openProfileModal = () => {
    closeSidebar();
    setProfileModalVisible(true);
  };

  const closeProfileModal = () => {
    if (savingProfileImage) {
      return;
    }
    setProfileModalVisible(false);
  };

  const onSaveProfileImage = async () => {
    if (!selectedProfileImageKey) {
      showAppAlert('No images', 'No profile images are available on the server.');
      return;
    }
    try {
      setSavingProfileImage(true);
      await apiRequest(
        '/api/profile-image',
        'PUT',
        { profileImageKey: selectedProfileImageKey },
        token
      );
      const nextSession = { ...(session || {}), profileImageKey: selectedProfileImageKey };
      setSession(nextSession);
      await saveSession(nextSession);
      setProfileModalVisible(false);
      showAppAlert('Saved', 'Profile image updated.');
    } catch (err) {
      showAppAlert('Profile update failed', err.message);
    } finally {
      setSavingProfileImage(false);
    }
  };

  const openCreateNoteModal = () => {
    setTodoCreateMenuOpen(false);
    setEditingNoteId(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteEditorSessionKey((prev) => prev + 1);
    setNoteEditorVisible(true);
  };

  const openEditNoteModal = (note) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title || '');
    setNoteContent(note.content || '');
    setNoteEditorSessionKey((prev) => prev + 1);
    setNoteEditorVisible(true);
  };

  const closeNoteEditor = () => {
    if (submitting) {
      return;
    }
    setNoteEditorVisible(false);
  };

  const onSaveNote = async () => {
    if (!noteTitle.trim() || !stripHtml(noteContent).trim()) {
      showAppAlert('Required', 'Enter both title and content.');
      return;
    }
    const payload = { title: noteTitle.trim(), content: noteContent.trim() };

    try {
      setSubmitting(true);
      if (editingNoteId) {
        const updated = await apiRequest(
          withLegacyUsername(`/api/notes/${editingNoteId}`),
          'PUT',
          payload,
          token
        );
        setNotesAndCache((prev) => prev.map((note) => (note.id === editingNoteId ? updated : note)));
      } else {
        const created = await apiRequest(withLegacyUsername('/api/notes'), 'POST', payload, token);
        setNotesAndCache((prev) => [created, ...prev]);
      }
      setNoteEditorVisible(false);
    } catch (err) {
      showAppAlert('Save failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDeleteNote = async (note) => {
    try {
      await apiRequest(withLegacyUsername(`/api/notes/${note.id}`), 'DELETE', undefined, token);
      setNotesAndCache((prev) => prev.filter((item) => item.id !== note.id));
    } catch (err) {
      showAppAlert('Delete failed', err.message);
    }
  };

  const openCreateTodoModal = (type = 'project') => {
    setTodoCreateMenuOpen(false);
    const nextType = type === 'task' ? 'task' : 'project';
    setEditingTodoId(null);
    setTodoEditorType(nextType);
    setTodoTitle(nextType === 'task' ? 'Standalone Task' : '');
    setTodoItems([
      {
        id: 1,
        text: '',
        done: false,
        reminderDate: '',
        reminderTime: '',
        reminderEnabled: false,
        notificationId: '',
      },
    ]);
    setTodoEditorVisible(true);
  };

  const openEditTodoModal = (todo) => {
    const nextType = todo?.listType === 'task' ? 'task' : 'project';
    setEditingTodoId(todo.id);
    setTodoEditorType(nextType);
    setTodoTitle(todo.title || '');
    const normalized = normalizeTodoItems(todo.items);
    setTodoItems(
      normalized.length > 0
        ? nextType === 'task'
          ? [normalized[0]]
          : normalized
        : [
            {
              id: 1,
              text: '',
              done: false,
              reminderDate: '',
              reminderTime: '',
              reminderEnabled: false,
              notificationId: '',
            },
          ]
    );
    setTodoEditorVisible(true);
  };

  const closeTodoEditor = () => {
    if (submitting) {
      return;
    }
    setTodoEditorVisible(false);
  };

  const updateTodoItem = (itemId, key, value) => {
    setTodoItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, [key]: value } : item)));
  };

  const toggleTodoItemDone = (itemId) => {
    setTodoItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item))
    );
  };

  const addTodoItem = () => {
    if (todoEditorType === 'task') {
      return;
    }
    setTodoItems((prev) => {
      const maxId = prev.reduce((max, item) => (item.id > max ? item.id : max), 0);
      return [
        ...prev,
        {
          id: maxId + 1,
          text: '',
          done: false,
          reminderDate: '',
          reminderTime: '',
          reminderEnabled: false,
          notificationId: '',
        },
      ];
    });
  };

  const removeTodoItem = (itemId) => {
    if (todoEditorType === 'task') {
      return;
    }
    setTodoItems((prev) => {
      if (prev.length === 1) {
        return [
          {
            id: 1,
            text: '',
            done: false,
            reminderDate: '',
            reminderTime: '',
            reminderEnabled: false,
            notificationId: '',
          },
        ];
      }
      return prev.filter((item) => item.id !== itemId);
    });
  };

  const onSaveTodo = async () => {
    const normalizedType = todoEditorType === 'task' ? 'task' : 'project';
    const sourceItems = normalizedType === 'task' ? [todoItems[0] || {}] : todoItems;
    const payload = {
      title:
        normalizedType === 'task'
          ? todoTitle.trim() || 'Standalone Task'
          : todoTitle.trim() || 'Untitled Project',
      listType: normalizedType,
      items: [],
    };

    try {
      const existingTodo = editingTodoId ? todos.find((todo) => todo.id === editingTodoId) : null;
      const existingNotificationIds = getTodoNotificationIds(existingTodo?.items);
      const normalizedItems = sourceItems.map((item, index) => ({
        id: item.id ?? index + 1,
        text: item.text || '',
        done: Boolean(item.done),
        reminderDate: item.reminderDate || '',
        reminderTime: item.reminderTime || '',
        reminderEnabled: Boolean(item.reminderEnabled),
        notificationId: '',
      }));
      const { items: scheduledItems } = await scheduleTodoItems(
        normalizedItems,
        normalizedType,
        payload.title
      );
      payload.items = scheduledItems;

      setSubmitting(true);
      if (editingTodoId) {
        const updated = await apiRequest(
          withLegacyUsername(`/api/todos/${editingTodoId}`),
          'PUT',
          payload,
          token
        );
        setTodosAndCache((prev) => prev.map((todo) => (todo.id === editingTodoId ? updated : todo)));
      } else {
        const created = await apiRequest(withLegacyUsername('/api/todos'), 'POST', payload, token);
        setTodosAndCache((prev) => [created, ...prev]);
      }
      await cancelNotifications(existingNotificationIds);
      setTodoEditorVisible(false);
    } catch (err) {
      await cancelNotifications(getTodoNotificationIds(payload.items));
      showAppAlert('Save failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDeleteTodo = async (todo) => {
    try {
      await apiRequest(withLegacyUsername(`/api/todos/${todo.id}`), 'DELETE', undefined, token);
      setTodosAndCache((prev) => prev.filter((item) => item.id !== todo.id));
      await cancelNotifications(getTodoNotificationIds(todo.items));
    } catch (err) {
      showAppAlert('Delete failed', err.message);
    }
  };

  const onOpenProject = (project) => {
    if (!project?.id) {
      return;
    }
    navigation.navigate('ProjectTasks', {
      projectId: project.id,
      projectTitle: project.title || 'Untitled Project',
    });
  };

  const onDeleteTaskEntry = async ({ ownerId, itemId }) => {
    const target = todos.find((todo) => todo.id === ownerId);
    if (!target) {
      return;
    }

    const targetType = target.listType === 'task' ? 'task' : 'project';
    try {
      if (targetType === 'task') {
        await apiRequest(withLegacyUsername(`/api/todos/${ownerId}`), 'DELETE', undefined, token);
        setTodosAndCache((prev) => prev.filter((todo) => todo.id !== ownerId));
        await cancelNotifications(getTodoNotificationIds(target.items));
        return;
      }

      const removedItem = (target.items || []).find((item) => item.id === itemId);
      const nextItems = (target.items || []).filter((item) => item.id !== itemId);
      const updated = await apiRequest(
        withLegacyUsername(`/api/todos/${ownerId}`),
        'PUT',
        {
          title: target.title || 'Untitled Project',
          listType: 'project',
          items: nextItems.map((item) => ({
            id: item.id,
            text: item.text || '',
            done: Boolean(item.done),
            reminderDate: item.reminderDate || '',
            reminderTime: item.reminderTime || '',
            reminderEnabled: Boolean(item.reminderEnabled),
            notificationId: item.notificationId || '',
          })),
        },
        token
      );
      setTodosAndCache((prev) => prev.map((todo) => (todo.id === ownerId ? updated : todo)));
      await cancelNotifications([removedItem?.notificationId || '']);
    } catch (err) {
      showAppAlert('Delete failed', err.message);
    }
  };

  const onUpdateTaskDateTime = async ({ ownerId, itemId, reminderDate, reminderTime }) => {
    const target = todos.find((todo) => todo.id === ownerId);
    if (!target) {
      return;
    }

    const targetType = target.listType === 'task' ? 'task' : 'project';
    let scheduledNotificationId = '';

    try {
      const previousNotificationId = (target.items || []).find((item) => item.id === itemId)?.notificationId || '';
      const nextItems = [];

      for (const item of target.items || []) {
        if (item.id !== itemId) {
          nextItems.push(item);
          continue;
        }

        const nextItem = {
          ...item,
          reminderDate: reminderDate || '',
          reminderTime: reminderTime || '',
          notificationId: '',
        };

        if (nextItem.reminderEnabled && !nextItem.done) {
          const trigger = getTodoReminderTrigger(nextItem);
          scheduledNotificationId = await scheduleNotification(
            buildTodoReminderTitle(targetType, target.title, nextItem),
            'Scheduled in 1 hour.',
            trigger
          );
          nextItem.notificationId = scheduledNotificationId;
        }

        nextItems.push(nextItem);
      }

      const updated = await apiRequest(
        withLegacyUsername(`/api/todos/${ownerId}`),
        'PUT',
        {
          title: target.title || (targetType === 'task' ? 'Standalone Task' : 'Untitled Project'),
          listType: targetType,
          items: nextItems.map((item) => ({
            id: item.id,
            text: item.text || '',
            done: Boolean(item.done),
            reminderDate: item.reminderDate || '',
            reminderTime: item.reminderTime || '',
            reminderEnabled: Boolean(item.reminderEnabled),
            notificationId: item.notificationId || '',
          })),
        },
        token
      );
      setTodosAndCache((prev) => prev.map((todo) => (todo.id === ownerId ? updated : todo)));
      if (previousNotificationId && previousNotificationId !== scheduledNotificationId) {
        await cancelNotifications([previousNotificationId]);
      }
    } catch (err) {
      await cancelNotifications([scheduledNotificationId]);
      showAppAlert('Update failed', err.message);
    }
  };

  const onToggleTaskDoneFromList = async ({ ownerId, itemId }) => {
    const target = todos.find((todo) => todo.id === ownerId);
    if (!target) {
      return;
    }

    const targetType = target.listType === 'task' ? 'task' : 'project';
    const previousNotificationId = (target.items || []).find((item) => item.id === itemId)?.notificationId || '';
    let scheduledNotificationId = '';
    const nextItems = [];
    for (const item of target.items || []) {
      if (item.id !== itemId) {
        nextItems.push(item);
        continue;
      }

      const toggledItem = {
        ...item,
        done: !item.done,
        notificationId: '',
      };
      if (!toggledItem.done && toggledItem.reminderEnabled) {
        try {
          const trigger = getTodoReminderTrigger(toggledItem);
          scheduledNotificationId = await scheduleNotification(
            buildTodoReminderTitle(targetType, target.title, toggledItem),
            'Scheduled in 1 hour.',
            trigger
          );
          toggledItem.notificationId = scheduledNotificationId;
        } catch (err) {
          showAppAlert('Reminder update failed', err.message);
          return;
        }
      }
      nextItems.push(toggledItem);
    }

    const optimisticTodo = { ...target, items: nextItems };
    setTodosAndCache((prev) => prev.map((todo) => (todo.id === ownerId ? optimisticTodo : todo)));

    try {
      const updated = await apiRequest(
        withLegacyUsername(`/api/todos/${ownerId}`),
        'PUT',
        {
          title: target.title || (targetType === 'task' ? 'Standalone Task' : 'Untitled Project'),
          listType: targetType,
          items: nextItems.map((item) => ({
            id: item.id,
            text: item.text || '',
            done: Boolean(item.done),
            reminderDate: item.reminderDate || '',
            reminderTime: item.reminderTime || '',
            reminderEnabled: Boolean(item.reminderEnabled),
            notificationId: item.notificationId || '',
          })),
        },
        token
      );
      setTodosAndCache((prev) => prev.map((todo) => (todo.id === ownerId ? updated : todo)));
      if (previousNotificationId && previousNotificationId !== scheduledNotificationId) {
        await cancelNotifications([previousNotificationId]);
      }
    } catch (err) {
      await cancelNotifications([scheduledNotificationId]);
      setTodosAndCache((prev) => prev.map((todo) => (todo.id === ownerId ? target : todo)));
      showAppAlert('Update failed', err.message);
    }
  };

  const notesCountLabel = `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`;

  const openPrimaryComposer = () => {
    if (activeTab === TAB_NOTES) {
      openCreateNoteModal();
      return;
    }
    if (activeTab === TAB_TODOS) {
      setTodoCreateMenuOpen((prev) => !prev);
      return;
    }
    if (activeTab === TAB_CALENDAR) {
      setTodoCreateMenuOpen(false);
      setActiveTab(TAB_TODOS);
      return;
    }
    if (activeTab === TAB_BUDGETIFY) {
      setShowAddSpend(true);
      return;
    }
    setTodoCreateMenuOpen(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backgroundLayer}>
        <View style={styles.orbTop} />
        <View style={styles.orbBottom} />
        <View style={styles.orbCenter} />
      </View>

      <WorkspaceHeader
        name={name}
        profileImageKey={selectedProfileImageKey}
        onProfilePress={() => setProfileDetailsVisible(true)}
        onMenuPress={toggleSidebar}
      />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color="#dcb7ff" />
        </View>
      ) : null}

      {!loading && activeTab === TAB_NOTES ? (
        <>
          <View style={styles.notesSearchOuter}>
            <Pressable style={styles.notesSearchBar} onPress={() => navigation.navigate('GlobalSearch')}>
              <View style={styles.notesSearchIconBtn}>
                <NotesSearchIcon />
              </View>
              <Text style={styles.notesSearchPlaceholder}>Search notes...</Text>
            </Pressable>
          </View>

          <View style={styles.notesSectionLabel}>
            <Text style={styles.notesSectionTitle}>MY NOTES</Text>
            <Text style={styles.notesSectionCount}>{notesCountLabel}</Text>
          </View>

          <NotesGrid notes={notes} onDeleteNote={onDeleteNote} onEditNote={openEditNoteModal} />
        </>
      ) : null}

      {!loading && activeTab === TAB_TODOS ? (
        <TodosGrid
          todos={todos}
          onEditTodo={openEditTodoModal}
          onOpenProject={onOpenProject}
          onDeleteTodo={onDeleteTodo}
          onDeleteTaskEntry={onDeleteTaskEntry}
          onToggleTaskDone={onToggleTaskDoneFromList}
          onUpdateTaskDateTime={onUpdateTaskDateTime}
        />
      ) : null}

      {!loading && activeTab === TAB_CALENDAR ? (
        <>
          <View style={styles.calendarToggleWrap}>
            <Pressable
              style={[styles.calendarToggleBtn, calendarMode === 'tasks' ? styles.calendarToggleBtnActive : null]}
              onPress={() => setCalendarMode('tasks')}
            >
              <Text style={[styles.calendarToggleText, calendarMode === 'tasks' ? styles.calendarToggleTextActive : null]}>Tasks</Text>
            </Pressable>
            <Pressable
              style={[styles.calendarToggleBtn, calendarMode === 'budget' ? styles.calendarToggleBtnActive : null]}
              onPress={() => setCalendarMode('budget')}
            >
              <Text style={[styles.calendarToggleText, calendarMode === 'budget' ? styles.calendarToggleTextActive : null]}>Budget</Text>
            </Pressable>
          </View>
          {calendarMode === 'tasks' ? <CalendarView todos={todos} /> : <BudgetCalendarScreen embedded />}
        </>
      ) : null}

      {!loading && activeTab === TAB_BUDGETIFY ? (
        <BudgetDashboard navigation={navigation} embedded showAddSpend={showAddSpend} onShowAddSpendChange={setShowAddSpend} />
      ) : null}

      {todoCreateMenuOpen && activeTab === TAB_TODOS ? (
        <View style={styles.todoFabStack}>
          <View style={styles.todoFabOptionsWrap}>
            <Pressable style={styles.todoModernFabOption} onPress={() => openCreateTodoModal('project')}>
              <Text style={styles.todoModernFabOptionText}>Add Project</Text>
              <View style={[styles.todoModernFabOptionIcon, styles.todoModernFabOptionProject]}>
                <Feather name="folder" size={16} color="#ffffff" />
              </View>
            </Pressable>
            <Pressable style={styles.todoModernFabOption} onPress={() => openCreateTodoModal('task')}>
              <Text style={styles.todoModernFabOptionText}>Add Task</Text>
              <View style={[styles.todoModernFabOptionIcon, styles.todoModernFabOptionTask]}>
                <Feather name="check-square" size={16} color="#ffffff" />
              </View>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={() => setActiveTab(TAB_NOTES)}>
          <Feather name="file-text" size={22} color={activeTab === TAB_NOTES ? '#60a5fa' : 'rgba(148,163,184,0.4)'} />
          <Text style={[styles.navLabel, activeTab === TAB_NOTES ? styles.navLabelActive : null]}>Notes</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => setActiveTab(TAB_BUDGETIFY)}>
          <Feather name="dollar-sign" size={22} color={activeTab === TAB_BUDGETIFY ? '#60a5fa' : 'rgba(148,163,184,0.4)'} />
          <Text style={[styles.navLabel, activeTab === TAB_BUDGETIFY ? styles.navLabelActive : null]}>Budget</Text>
        </Pressable>
        <Pressable style={styles.navCenterWrap} onPress={openPrimaryComposer}>
          <View style={styles.navFab}>
            <Feather name="plus" size={20} color="#ffffff" />
          </View>
          <Text style={styles.navFabLabel}>New</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => setActiveTab(TAB_TODOS)}>
          <Feather name="check-square" size={22} color={activeTab === TAB_TODOS ? '#60a5fa' : 'rgba(148,163,184,0.4)'} />
          <Text style={[styles.navLabel, activeTab === TAB_TODOS ? styles.navLabelActive : null]}>Tasks</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => setActiveTab(TAB_CALENDAR)}>
          <Feather name="calendar" size={22} color={activeTab === TAB_CALENDAR ? '#60a5fa' : 'rgba(148,163,184,0.4)'} />
          <Text style={[styles.navLabel, activeTab === TAB_CALENDAR ? styles.navLabelActive : null]}>Calendar</Text>
        </Pressable>
      </View>

      <NoteEditorModal
        visible={noteEditorVisible}
        editingNoteId={editingNoteId}
        editorSessionKey={noteEditorSessionKey}
        noteTitle={noteTitle}
        noteContent={noteContent}
        submitting={submitting}
        onChangeTitle={setNoteTitle}
        onChangeContent={setNoteContent}
        onClose={closeNoteEditor}
        onSave={onSaveNote}
      />

      <TodoEditorModal
        visible={todoEditorVisible}
        editingTodoId={editingTodoId}
        todoType={todoEditorType}
        todoTitle={todoTitle}
        todoItems={todoItems}
        submitting={submitting}
        onChangeTitle={setTodoTitle}
        onClose={closeTodoEditor}
        onSave={onSaveTodo}
        onToggleDone={toggleTodoItemDone}
        onChangeItemText={(itemId, value) => updateTodoItem(itemId, 'text', value)}
        onChangeItemDate={(itemId, value) => updateTodoItem(itemId, 'reminderDate', value)}
        onChangeItemTime={(itemId, value) => updateTodoItem(itemId, 'reminderTime', value)}
        onChangeItemReminderEnabled={(itemId, value) => updateTodoItem(itemId, 'reminderEnabled', value)}
        onRemoveItem={removeTodoItem}
        onAddItem={addTodoItem}
      />

      <SidebarDrawer
        open={sidebarOpen}
        activeTab={activeTab}
        onClose={closeSidebar}
        onTabChange={onSelectTab}
        onBudgetify={openBudgetifyPage}
        onSupportDev={openSupportDevPage}
        onProfile={openProfileModal}
        onSettings={openSettingsPage}
        onRefresh={onRefreshPress}
        onLogout={onLogout}
        drawerAnim={drawerAnim}
        name={name}
        email={session?.email || ''}
        profileImageKey={selectedProfileImageKey}
      />

      <ProfileDetailsModal
        visible={profileDetailsVisible}
        name={name}
        email={session?.email || ''}
        profileImageKey={selectedProfileImageKey}
        onClose={() => setProfileDetailsVisible(false)}
        onEditImage={() => {
          setProfileDetailsVisible(false);
          openProfileModal();
        }}
      />

      <ProfileImageModal
        visible={profileModalVisible}
        options={profileImageOptions}
        selectedKey={selectedProfileImageKey}
        saving={savingProfileImage}
        onClose={closeProfileModal}
        onSelect={setSelectedProfileImageKey}
        onSave={onSaveProfileImage}
      />
    </SafeAreaView>
  );
}
