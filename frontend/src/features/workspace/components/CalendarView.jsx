import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { styles } from '../styles';
import { buildTaskCalendarMap, formatMonthYear, getMonthGrid, toDateKey } from '../utils/calendar';
import { formatDisplayTime } from '../../../utils/dateTime';

const WEEK_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function shiftSundayToEnd(day) {
  return day === 0 ? 6 : day - 1;
}

function getTaskTone(task) {
  if (task.done) {
    return 'done';
  }
  if (task.time) {
    return 'timed';
  }
  return 'open';
}

function getTaskToneStyles(task) {
  const tone = getTaskTone(task);
  if (tone === 'done') {
    return {
      pill: styles.calendarAgendaToneDone,
      dot: styles.calendarAgendaDotDone,
      badge: 'Done',
    };
  }
  if (tone === 'timed') {
    return {
      pill: styles.calendarAgendaToneTimed,
      dot: styles.calendarAgendaDotTimed,
      badge: 'Scheduled',
    };
  }
  return {
    pill: styles.calendarAgendaToneOpen,
    dot: styles.calendarAgendaDotOpen,
    badge: 'Task',
  };
}

function formatSelectedDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function CalendarView({ todos }) {
  const today = new Date();
  const todayKey = toDateKey(today);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayKey);

  const tasksByDate = useMemo(() => buildTaskCalendarMap(todos), [todos]);
  const monthGrid = useMemo(() => getMonthGrid(currentYear, currentMonth), [currentYear, currentMonth]);
  const selectedTasks = tasksByDate[selectedDate] || [];
  const totalMonthTasks = useMemo(
    () =>
      monthGrid.reduce((count, week) => {
        return (
          count +
          week.reduce((weekCount, cell) => {
            if (!cell.inCurrentMonth) {
              return weekCount;
            }
            return weekCount + (tasksByDate[toDateKey(cell.date)]?.length || 0);
          }, 0)
        );
      }, 0),
    [monthGrid, tasksByDate]
  );

  const selectedDateObj = useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map((part) => Number(part));
    if (!year || !month || !day) {
      return new Date(currentYear, currentMonth, 1);
    }
    return new Date(year, month - 1, day);
  }, [currentMonth, currentYear, selectedDate]);

  const goPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
      return;
    }
    setCurrentMonth((prev) => prev - 1);
  };

  const goNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
      return;
    }
    setCurrentMonth((prev) => prev + 1);
  };

  return (
    <ScrollView contentContainerStyle={styles.calendarModernWrap} showsVerticalScrollIndicator={false}>
      <View style={styles.calendarModernCard}>
        <View style={styles.calendarModernTopBar}>
          <View style={styles.calendarModernMonthChip}>
            <Feather name="calendar" size={15} color="#60a5fa" />
            <Text style={styles.calendarModernMonthChipText}>{formatMonthYear(currentYear, currentMonth)}</Text>
          </View>

          <View style={styles.calendarModernActions}>
            <Pressable style={styles.calendarModernIconBtn} onPress={goPrevMonth}>
              <Feather name="chevron-left" size={18} color="#cbd5e1" />
            </Pressable>
            <Pressable style={styles.calendarModernIconBtn} onPress={goNextMonth}>
              <Feather name="chevron-right" size={18} color="#cbd5e1" />
            </Pressable>
          </View>
        </View>

        <View style={styles.calendarModernWeekRow}>
          {WEEK_LABELS.map((label) => (
            <Text key={label} style={styles.calendarModernWeekText}>
              {label}
            </Text>
          ))}
        </View>

        {monthGrid.map((week, weekIndex) => (
          <View key={`week-${weekIndex + 1}`} style={styles.calendarModernRow}>
            {week.map((cell) => {
              const dateKey = toDateKey(cell.date);
              const tasks = tasksByDate[dateKey] || [];
              const hasTasks = tasks.length > 0;
              const hasTimedTask = tasks.some((task) => task.time);
              const hasDoneTask = tasks.some((task) => task.done);
              const isSelected = selectedDate === dateKey;
              const isToday = dateKey === todayKey;
              const weekday = shiftSundayToEnd(cell.date.getDay());
              const isWeekend = weekday >= 5;

              return (
                <Pressable
                  key={dateKey}
                  style={styles.calendarModernDayPressable}
                  onPress={() => setSelectedDate(dateKey)}
                >
                  <View
                    style={[
                      styles.calendarModernDayBubble,
                      !cell.inCurrentMonth ? styles.calendarModernDayOutside : null,
                      isWeekend && cell.inCurrentMonth ? styles.calendarModernDayWeekend : null,
                      hasTasks ? styles.calendarModernDayHasItems : null,
                      isToday ? styles.calendarModernDayToday : null,
                      isSelected ? styles.calendarModernDaySelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarModernDayText,
                        !cell.inCurrentMonth ? styles.calendarModernDayTextOutside : null,
                        isToday ? styles.calendarModernDayTextToday : null,
                        isSelected ? styles.calendarModernDayTextSelected : null,
                      ]}
                    >
                      {cell.date.getDate()}
                    </Text>

                    {hasTasks ? (
                      <View style={styles.calendarModernIndicators}>
                        <View style={[styles.calendarModernIndicatorDot, hasTimedTask ? styles.calendarModernIndicatorBlue : styles.calendarModernIndicatorSlate]} />
                        {hasDoneTask ? <View style={[styles.calendarModernIndicatorDot, styles.calendarModernIndicatorGreen]} /> : null}
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.calendarAgendaCard}>
        <View style={styles.calendarAgendaHeader}>
          <View style={styles.calendarAgendaHeaderLeft}>
            <Text style={styles.calendarAgendaEyebrow}>{selectedDate === todayKey ? 'TODAY' : 'SELECTED DAY'}</Text>
            <Text style={styles.calendarAgendaDateNumber}>{selectedDateObj.getDate()}</Text>
            <Text style={styles.calendarAgendaDateLabel}>{formatSelectedDate(selectedDateObj)}</Text>
          </View>

          <View style={styles.calendarAgendaHeaderRight}>
            <Text style={styles.calendarAgendaSummary}>{selectedTasks.length} tasks</Text>
            <Text style={styles.calendarAgendaSummaryMuted}>{totalMonthTasks} this month</Text>
          </View>
        </View>

        {selectedTasks.length === 0 ? (
          <View style={styles.calendarAgendaEmptyCard}>
            <Text style={styles.calendarAgendaEmptyTitle}>No tasks on this date</Text>
            <Text style={styles.calendarAgendaEmptyText}>Use the add flow to create one for this day.</Text>
          </View>
        ) : null}

        {selectedTasks.map((task) => {
          const tone = getTaskToneStyles(task);
          return (
            <View key={task.id} style={[styles.calendarAgendaTaskCard, tone.pill]}>
              <View style={styles.calendarAgendaTaskTop}>
                <View style={[styles.calendarAgendaTaskDot, tone.dot]} />
                <Text style={styles.calendarAgendaTaskTime}>
                  {task.time ? formatDisplayTime(task.time, '12h') : 'Any time'}
                </Text>
                <View style={styles.calendarAgendaBadge}>
                  <Text style={styles.calendarAgendaBadgeText}>{tone.badge}</Text>
                </View>
              </View>

              <Text style={[styles.calendarAgendaTaskTitle, task.done ? styles.doneText : null]}>{task.text}</Text>
              <Text style={styles.calendarAgendaTaskMeta} numberOfLines={1}>
                {task.listTitle || 'Untitled List'}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
