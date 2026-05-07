import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import AppDatePicker from '../../../components/AppDatePicker';
import AppTimePicker from '../../../components/AppTimePicker';
import { formatDisplayDate, formatDisplayTime } from '../../../utils/dateTime';
import { styles } from '../styles';
import { toDateKey } from '../utils/calendar';

const FILTER_TODAY = 'today';
const FILTER_SCHEDULED = 'scheduled';
const FILTER_FINISHED = 'finished';
const FILTER_TOTAL = 'total';
const PROJECT_ACCENTS = ['blue', 'purple', 'teal', 'rose', 'amber'];

function normalizeType(item) {
  return item?.listType === 'task' ? 'task' : 'project';
}

function getProjectAccent(project) {
  const seed = String(project?.id || project?.title || '')
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return PROJECT_ACCENTS[seed % PROJECT_ACCENTS.length];
}

function buildTaskRows(blocks) {
  return (blocks || []).flatMap((block) =>
    (block.items || []).map((item) => ({
      id: `${block.id}-${item.id}`,
      itemId: item.id,
      ownerId: block.id,
      ownerTitle: block.title || (normalizeType(block) === 'task' ? 'Standalone Task' : 'Untitled Project'),
      text: item.text || '(empty task)',
      done: Boolean(item.done),
      reminderDate: item.reminderDate || '',
      reminderTime: item.reminderTime || '',
      reminderEnabled: Boolean(item.reminderEnabled),
      accent: getProjectAccent(block),
    }))
  );
}

function formatTaskDateTime(task) {
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

function taskDueAt(task) {
  if (!task?.reminderDate) {
    return null;
  }
  const fallbackTime = task?.reminderTime || '23:59';
  const value = new Date(`${task.reminderDate}T${fallbackTime}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function isOverdue(task) {
  const dueAt = taskDueAt(task);
  if (!dueAt || task.done) {
    return false;
  }
  return dueAt.getTime() < Date.now();
}

function StatCard({ value, label, accent, active, onPress }) {
  return (
    <Pressable
      style={[
        styles.todoModernStatCard,
        styles[`todoModernStatCard${accent}`],
        active ? styles.todoModernStatCardActive : null,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.todoModernStatValue, styles[`todoModernStatValue${accent}`]]}>{value}</Text>
      <Text style={styles.todoModernStatLabel}>{label}</Text>
    </Pressable>
  );
}

function ProjectCard({ project, onPress, onDelete }) {
  const accent = getProjectAccent(project);
  const totalCount = (project.items || []).length;
  const doneCount = (project.items || []).filter((item) => item.done).length;
  const progress = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <Pressable style={styles.todoModernProjectCard} onPress={() => onPress(project)}>
      <View style={[styles.todoModernProjectAccent, styles[`todoModernProjectAccent${accent}`]]} />
      <View style={styles.todoModernProjectTop}>
        <View style={[styles.todoModernProjectIcon, styles[`todoModernProjectIcon${accent}`]]}>
          <Feather name="folder" size={15} color="#e2e8f0" />
        </View>
        <Pressable
          style={styles.todoModernProjectDelete}
          onPress={(event) => {
            event.stopPropagation();
            onDelete(project);
          }}
        >
          <Feather name="trash-2" size={11} color="rgba(148,163,184,0.65)" />
        </Pressable>
      </View>
      <Text style={styles.todoModernProjectName} numberOfLines={1}>
        {project.title || 'Untitled Project'}
      </Text>
      <Text style={styles.todoModernProjectMeta}>
        {doneCount}/{totalCount} finished
      </Text>
      <View style={styles.todoModernProjectProgressTrack}>
        <View
          style={[
            styles.todoModernProjectProgressFill,
            styles[`todoModernProjectProgressFill${accent}`],
            { width: `${progress}%` },
          ]}
        />
      </View>
      <View style={styles.todoModernProjectBottom}>
        <Text style={styles.todoModernProjectPct}>{progress}%</Text>
      </View>
    </Pressable>
  );
}

function TaskRow({ task, onPress, onDelete, onEditDateTime, onToggleDone }) {
  const dateTimeLabel = formatTaskDateTime(task);
  const overdue = isOverdue(task);

  return (
    <Pressable style={styles.todoModernTaskRow} onPress={() => onPress(task.ownerId)}>
      <Pressable
        style={[styles.todoModernCheckbox, task.done ? styles.todoModernCheckboxDone : null]}
        onPress={(event) => {
          event.stopPropagation();
          onToggleDone(task);
        }}
      >
        {task.done ? <Feather name="check" size={12} color="#ffffff" /> : null}
      </Pressable>

      <View style={styles.todoModernTaskBody}>
        <Text style={[styles.todoModernTaskName, task.done ? styles.todoModernTaskNameDone : null]} numberOfLines={1}>
          {task.text}
        </Text>

        <View style={styles.todoModernTaskMetaRow}>
          <View style={[styles.todoModernTaskTag, styles[`todoModernTaskTag${task.accent}`]]}>
            <Text style={[styles.todoModernTaskTagText, styles[`todoModernTaskTagText${task.accent}`]]} numberOfLines={1}>
              {task.ownerTitle}
            </Text>
          </View>

          {dateTimeLabel ? (
            <Pressable
              style={styles.todoModernTaskDateWrap}
              onPress={(event) => {
                event.stopPropagation();
                onEditDateTime(task);
              }}
            >
              <Feather
                name="clock"
                size={11}
                color={overdue ? 'rgba(248,113,113,0.8)' : 'rgba(148,163,184,0.48)'}
              />
              <Text style={[styles.todoModernTaskDateText, overdue ? styles.todoModernTaskDateTextOverdue : null]}>
                {dateTimeLabel}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.todoModernTaskDateWrap}
              onPress={(event) => {
                event.stopPropagation();
                onEditDateTime(task);
              }}
            >
              <Feather name="calendar" size={11} color="rgba(148,163,184,0.48)" />
              <Text style={styles.todoModernTaskDateText}>Set date</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.todoModernTaskActions}>
        <Pressable
          style={styles.todoModernTaskDelete}
          onPress={(event) => {
            event.stopPropagation();
            onDelete(task);
          }}
        >
          <Feather name="trash-2" size={12} color="rgba(148,163,184,0.58)" />
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function TodosGrid({
  todos,
  onEditTodo,
  onOpenProject,
  onDeleteTodo,
  onDeleteTaskEntry,
  onToggleTaskDone,
  onUpdateTaskDateTime,
}) {
  const [activeFilter, setActiveFilter] = useState(FILTER_TOTAL);
  const [dateEditorVisible, setDateEditorVisible] = useState(false);
  const [dateEditorTask, setDateEditorTask] = useState(null);
  const [pickerDate, setPickerDate] = useState('');
  const [pickerTime, setPickerTime] = useState('');

  const todayKey = toDateKey(new Date());
  const projects = useMemo(() => (todos || []).filter((todo) => normalizeType(todo) === 'project'), [todos]);
  const standaloneTasks = useMemo(() => (todos || []).filter((todo) => normalizeType(todo) === 'task'), [todos]);
  const allTaskRows = useMemo(() => buildTaskRows(standaloneTasks), [standaloneTasks]);

  const stats = useMemo(() => {
    const todayTasks = allTaskRows.filter((task) => task.reminderDate === todayKey).length;
    const scheduledTasks = allTaskRows.filter((task) => task.reminderEnabled && !task.done).length;
    const finishedTasks = allTaskRows.filter((task) => task.done).length;
    const totalTasks = allTaskRows.length;
    return {
      [FILTER_TODAY]: todayTasks,
      [FILTER_SCHEDULED]: scheduledTasks,
      [FILTER_FINISHED]: finishedTasks,
      [FILTER_TOTAL]: totalTasks,
      pending: totalTasks - finishedTasks,
    };
  }, [allTaskRows, todayKey]);

  const filteredTasks = useMemo(() => {
    if (activeFilter === FILTER_TODAY) {
      return allTaskRows.filter((task) => task.reminderDate === todayKey);
    }
    if (activeFilter === FILTER_SCHEDULED) {
      return allTaskRows.filter((task) => task.reminderEnabled && !task.done);
    }
    if (activeFilter === FILTER_FINISHED) {
      return allTaskRows.filter((task) => task.done);
    }
    return allTaskRows;
  }, [activeFilter, allTaskRows, todayKey]);

  const todoById = useMemo(() => {
    const map = new Map();
    (todos || []).forEach((todo) => map.set(todo.id, todo));
    return map;
  }, [todos]);

  const openOwnerEditor = (ownerId) => {
    const target = todoById.get(ownerId);
    if (target) {
      onEditTodo(target);
    }
  };

  const openDateEditor = (task) => {
    setDateEditorTask(task);
    setPickerDate(task.reminderDate || '');
    setPickerTime(task.reminderTime || '');
    setDateEditorVisible(true);
  };

  const saveDateEditor = () => {
    if (!dateEditorTask) {
      return;
    }
    onUpdateTaskDateTime({
      ownerId: dateEditorTask.ownerId,
      itemId: dateEditorTask.itemId,
      reminderDate: pickerDate || '',
      reminderTime: pickerTime || '',
    });
    setDateEditorVisible(false);
    setDateEditorTask(null);
  };

  return (
    <View style={styles.todoScreenWrap}>
      <ScrollView contentContainerStyle={[styles.todoModernWrap, styles.todoBoardWrapWithFab]} showsVerticalScrollIndicator={false}>
        <View style={styles.todoModernTitleRow}>
          <Text style={styles.todoModernTitle}>Tasks</Text>
          <View style={styles.todoModernBadge}>
            <Text style={styles.todoModernBadgeText}>{stats[FILTER_TOTAL]} total</Text>
          </View>
        </View>

        <View style={styles.todoModernStatsRow}>
          <StatCard
            value={stats[FILTER_TOTAL]}
            label="Total Tasks"
            accent="Blue"
            active={activeFilter === FILTER_TOTAL}
            onPress={() => setActiveFilter(FILTER_TOTAL)}
          />
          <StatCard
            value={stats[FILTER_FINISHED]}
            label="Completed"
            accent="Green"
            active={activeFilter === FILTER_FINISHED}
            onPress={() => setActiveFilter(FILTER_FINISHED)}
          />
          <StatCard
            value={stats.pending}
            label="Pending"
            accent="Amber"
            active={activeFilter === FILTER_SCHEDULED}
            onPress={() => setActiveFilter(FILTER_SCHEDULED)}
          />
        </View>

        <View style={styles.todoModernSectionHeader}>
          <Text style={styles.todoModernSectionTitle}>Projects</Text>
          <Text style={styles.todoModernSectionCount}>
            {projects.length} project{projects.length === 1 ? '' : 's'}
          </Text>
        </View>

        {projects.length === 0 ? (
          <Text style={styles.todoEmptyText}>No projects yet. Add your first project.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.todoModernProjectsScroll}
          >
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onPress={onOpenProject} onDelete={onDeleteTodo} />
            ))}
          </ScrollView>
        )}

        <View style={styles.todoModernSectionHeader}>
          <Text style={styles.todoModernSectionTitle}>Task List</Text>
          <Text style={styles.todoModernSectionCount}>All lists</Text>
        </View>

        {filteredTasks.length === 0 ? (
          <Text style={styles.todoEmptyText}>No tasks in this selection.</Text>
        ) : null}

        {filteredTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onPress={openOwnerEditor}
            onEditDateTime={openDateEditor}
            onToggleDone={(picked) => onToggleTaskDone({ ownerId: picked.ownerId, itemId: picked.itemId })}
            onDelete={(picked) => onDeleteTaskEntry({ ownerId: picked.ownerId, itemId: picked.itemId })}
          />
        ))}
      </ScrollView>

      <Modal visible={dateEditorVisible} transparent animationType="fade" onRequestClose={() => setDateEditorVisible(false)}>
        <View style={styles.quickPickerBackdrop}>
          <View style={styles.quickPickerModal}>
            <Text style={styles.quickPickerTitle}>Edit Date & Time</Text>
            <Text style={styles.quickPickerSection}>Update the reminder for this task.</Text>
            <AppDatePicker
              label="Reminder date"
              value={pickerDate}
              onChange={setPickerDate}
              placeholder="Pick a date"
            />
            <AppTimePicker
              label="Reminder time"
              value={pickerTime}
              onChange={setPickerTime}
              placeholder="Pick a time"
            />

            <View style={styles.quickPickerActions}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => {
                  setPickerDate('');
                  setPickerTime('');
                }}
              >
                <Text style={styles.secondaryBtnText}>Clear</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => setDateEditorVisible(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={saveDateEditor}>
                <Text style={styles.primaryBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
