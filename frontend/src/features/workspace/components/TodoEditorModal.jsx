import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import AppDatePicker from '../../../components/AppDatePicker';
import AppTimePicker from '../../../components/AppTimePicker';
import { formatDisplayDate, formatDisplayTime } from '../../../utils/dateTime';
import { styles } from '../styles';

function ReminderSummary({ item }) {
  const dateLabel = formatDisplayDate(item.reminderDate);
  const timeLabel = formatDisplayTime(item.reminderTime, '12h');

  if (!item.reminderEnabled && !dateLabel && !timeLabel) {
    return <Text style={styles.todoReminderSummaryText}>Reminder is off</Text>;
  }
  if (timeLabel && dateLabel) {
    return <Text style={styles.todoReminderSummaryText}>{`${dateLabel} | ${timeLabel}${item.reminderEnabled ? '' : ' | Reminder off'}`}</Text>;
  }
  if (timeLabel) {
    return <Text style={styles.todoReminderSummaryText}>{`${timeLabel} | Every day${item.reminderEnabled ? '' : ' | Reminder off'}`}</Text>;
  }
  if (dateLabel) {
    return <Text style={styles.todoReminderSummaryText}>{`${dateLabel}${item.reminderEnabled ? '' : ' | Reminder off'}`}</Text>;
  }
  return <Text style={styles.todoReminderSummaryText}>Pick a time to enable reminders</Text>;
}

function ReminderToggle({ value, onChange }) {
  return (
    <Pressable
      style={[styles.todoReminderSwitch, value ? styles.todoReminderSwitchActive : null]}
      onPress={() => onChange(!value)}
    >
      <Text style={[styles.todoReminderSwitchLabel, value ? styles.todoReminderSwitchLabelActive : null]}>
        Reminder
      </Text>
      <View style={[styles.todoReminderTrack, value ? styles.todoReminderTrackActive : null]}>
        <View style={[styles.todoReminderThumb, value ? styles.todoReminderThumbActive : null]} />
      </View>
    </Pressable>
  );
}

export default function TodoEditorModal({
  visible,
  editingTodoId,
  todoType,
  todoTitle,
  todoItems,
  submitting,
  onChangeTitle,
  onClose,
  onSave,
  onToggleDone,
  onChangeItemText,
  onChangeItemDate,
  onChangeItemTime,
  onChangeItemReminderEnabled,
  onRemoveItem,
  onAddItem,
}) {
  const isTaskMode = todoType === 'task';
  const [activeDateItemId, setActiveDateItemId] = useState(null);
  const [activeTimeItemId, setActiveTimeItemId] = useState(null);

  const activeDateItem = todoItems.find((item) => item.id === activeDateItemId) || null;
  const activeTimeItem = todoItems.find((item) => item.id === activeTimeItemId) || null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.fullScreenModalCard}>
        <View style={styles.todoEditorHeader}>
          <Pressable style={styles.todoEditorHeaderIcon} onPress={onClose}>
            <Feather name="x" size={26} color="#f8fafc" />
          </Pressable>
          <Text style={styles.todoEditorHeaderTitle}>
            {editingTodoId
              ? isTaskMode
                ? 'Edit Task'
                : 'Edit Project'
              : isTaskMode
                ? 'Add Task'
                : 'Add Project'}
          </Text>
          <Pressable style={styles.todoEditorHeaderIcon} onPress={onSave} disabled={submitting}>
            <Feather name="check" size={26} color={submitting ? 'rgba(226,232,240,0.45)' : '#f8fafc'} />
          </Pressable>
        </View>

        {isTaskMode ? null : (
          <TextInput
            style={styles.titleInput}
            placeholder="Project title"
            placeholderTextColor="#9f93b7"
            value={todoTitle}
            onChangeText={onChangeTitle}
          />
        )}

        <ScrollView style={styles.fullScreenItemsScroll} contentContainerStyle={styles.todoEditorScrollContent}>
          {todoItems.map((item, index) => (
            <View key={item.id} style={styles.todoEditorCard}>
              <View style={styles.todoEditorItemTop}>
                <Pressable
                  style={[styles.checkbox, item.done ? styles.checkboxDone : null]}
                  onPress={() => onToggleDone(item.id)}
                >
                  <Text style={styles.checkboxText}>{item.done ? '\u2713' : ''}</Text>
                </Pressable>
                <View style={styles.todoEditorTopRight}>
                  <ReminderToggle
                    value={item.reminderEnabled}
                    onChange={(value) => onChangeItemReminderEnabled(item.id, value)}
                  />
                  {isTaskMode ? null : (
                    <Pressable style={styles.todoEditorRemoveBtn} onPress={() => onRemoveItem(item.id)}>
                      <Feather name="trash-2" size={14} color="rgba(244,63,94,0.82)" />
                    </Pressable>
                  )}
                </View>
              </View>

              <TextInput
                style={[styles.todoLargeTextInput, item.done ? styles.doneText : null]}
                placeholder={isTaskMode ? 'Write your task here...' : `Task item ${index + 1}`}
                placeholderTextColor="rgba(148,163,184,0.4)"
                value={item.text}
                onChangeText={(value) => onChangeItemText(item.id, value)}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.todoReminderCompactRow}>
                <Pressable
                  style={styles.todoReminderIconBtn}
                  onPress={() => {
                    setActiveTimeItemId(item.id);
                  }}
                >
                  <Feather name="clock" size={16} color="#f8fafc" />
                  <Text style={styles.todoReminderIconLabel}>
                    {formatDisplayTime(item.reminderTime, '12h') || 'Set time'}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.todoReminderIconBtn}
                  onPress={() => {
                    setActiveDateItemId(item.id);
                  }}
                >
                  <Feather name="calendar" size={16} color="#f8fafc" />
                  <Text style={styles.todoReminderIconLabel}>
                    {formatDisplayDate(item.reminderDate) || 'Every day'}
                  </Text>
                </Pressable>
              </View>

              <ReminderSummary item={item} />
              {item.reminderEnabled ? (
                <Text style={styles.todoReminderHint}>Time is required. Date is optional for a daily reminder.</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>

        {isTaskMode ? null : (
          <Pressable style={styles.addItemBtn} onPress={onAddItem}>
            <Text style={styles.addItemBtnText}>+ Add Item</Text>
          </Pressable>
        )}

      </View>

      {activeTimeItem ? (
        <AppTimePicker
          value={activeTimeItem.reminderTime}
          onChange={(value) => onChangeItemTime(activeTimeItem.id, value)}
          placeholder="Pick a time"
          format="12h"
          openOnMount
          hideField
          onDismiss={() => setActiveTimeItemId(null)}
          theme="dark"
        />
      ) : null}

      {activeDateItem ? (
        <AppDatePicker
          value={activeDateItem.reminderDate}
          onChange={(value) => onChangeItemDate(activeDateItem.id, value)}
          placeholder="Pick a date"
          openOnMount
          hideField
          onDismiss={() => setActiveDateItemId(null)}
          theme="dark"
        />
      ) : null}
    </Modal>
  );
}
