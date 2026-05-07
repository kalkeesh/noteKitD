import { Platform } from 'react-native';
import cancelScheduledNotificationAsync from 'expo-notifications/build/cancelScheduledNotificationAsync';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { IosAuthorizationStatus } from 'expo-notifications/build/NotificationPermissions.types';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import scheduleNotificationAsync from 'expo-notifications/build/scheduleNotificationAsync';
import setNotificationChannelAsync from 'expo-notifications/build/setNotificationChannelAsync';

import { parseDateValue, parseMonthValue, parseTimeValue } from '../../utils/dateTime';
import { buildNotificationContent } from '../../utils/notificationService';

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let permissionsRequested = false;

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function asDate(value) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  const parsed = new Date(value);
  return parsed;
}

export function combineDateAndTime(dateValue, timeValue, fallbackHour = 9, fallbackMinute = 0) {
  if (!dateValue) {
    return null;
  }

  const dateParts = parseDateValue(dateValue);
  const timeParts = timeValue
    ? parseTimeValue(timeValue)
    : { hour: fallbackHour, minute: fallbackMinute };
  const merged = new Date(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    0,
    0
  );

  return isValidDate(merged) ? merged : null;
}

export function ensureFutureTriggerTime(triggerTime) {
  const nextTrigger = asDate(triggerTime);
  if (!isValidDate(nextTrigger)) {
    throw new Error('Invalid reminder date.');
  }
  if (nextTrigger.getTime() <= Date.now()) {
    throw new Error('Reminder time must be in the future.');
  }
  return nextTrigger;
}

export async function configureNotificationsAsync() {
  if (Platform.OS === 'web') {
    return false;
  }

  if (Platform.OS === 'android') {
    await setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existing = await getPermissionsAsync();
  if (existing.granted || existing.ios?.status === IosAuthorizationStatus.PROVISIONAL) {
    permissionsRequested = true;
    return true;
  }

  if (permissionsRequested) {
    return false;
  }

  permissionsRequested = true;
  const requested = await requestPermissionsAsync();
  return requested.granted || requested.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}

export async function scheduleNotification(title, body, triggerTime) {
  if (Platform.OS === 'web') {
    throw new Error('Local notifications are not supported on web.');
  }

  const granted = await configureNotificationsAsync();
  if (!granted) {
    throw new Error('Notification permission was not granted.');
  }

  const content = buildNotificationContent(title, body);

  let trigger;
  if (triggerTime?.type === 'daily') {
    trigger =
      Platform.OS === 'android'
        ? {
            type: 'daily',
            hour: triggerTime.hour,
            minute: triggerTime.minute,
            channelId: 'reminders',
          }
        : {
            hour: triggerTime.hour,
            minute: triggerTime.minute,
            repeats: true,
          };
  } else {
    const triggerDate = ensureFutureTriggerTime(triggerTime);
    trigger =
      Platform.OS === 'android'
        ? {
            type: 'date',
            date: triggerDate,
            channelId: 'reminders',
          }
        : triggerDate;
  }

  return scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      sound: true,
    },
    trigger,
  });
}

export async function sendNotification(title, body, triggerTime) {
  return scheduleNotification(title, body, triggerTime);
}

export async function cancelNotification(notificationId) {
  if (!notificationId) {
    return;
  }
  try {
    await cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Ignore stale notification ids that are no longer scheduled on the device.
  }
}

export async function cancelNotifications(notificationIds) {
  await Promise.all((notificationIds || []).filter(Boolean).map((id) => cancelNotification(id)));
}

export function getTodoReminderTrigger(item) {
  if (!item?.reminderEnabled) {
    return null;
  }
  if (!item.reminderTime) {
    throw new Error(`Task "${item.text || 'Untitled task'}" needs a reminder time.`);
  }

  const time = parseTimeValue(item.reminderTime);
  if (!item.reminderDate) {
    return {
      type: 'daily',
      hour: time.hour,
      minute: time.minute,
    };
  }

  const dueAt = combineDateAndTime(item.reminderDate, item.reminderTime);
  if (!dueAt) {
    throw new Error(`Task "${item.text || 'Untitled task'}" has an invalid reminder date.`);
  }

  const trigger = new Date(dueAt.getTime() - 60 * 60 * 1000);
  return ensureFutureTriggerTime(trigger);
}

export function getDebtReminderTrigger(dueDate) {
  const dueAt = combineDateAndTime(dueDate, '', 9, 0);
  if (!dueAt) {
    throw new Error('Debt due date is invalid.');
  }
  const trigger = new Date(dueAt.getTime() - 24 * 60 * 60 * 1000);
  return ensureFutureTriggerTime(trigger);
}

function endOfMonthDate(year, month) {
  return new Date(year, month, 0, 9, 0, 0, 0);
}

function nextMonthKey(year, month) {
  if (month === 12) {
    return { year: year + 1, month: 1 };
  }
  return { year, month: month + 1 };
}

export function getNextEmiReminderTrigger(emi, now = new Date()) {
  if (!emi?.reminder_enabled) {
    return null;
  }

  const lastMonth = parseMonthValue(emi.last_payable_month);
  let cursor = parseMonthValue(emi.start_month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const currentMonthValue = now.getFullYear() * 100 + (now.getMonth() + 1);
  const cursorMonthValue = cursor.year * 100 + cursor.month;
  if (cursorMonthValue < currentMonthValue) {
    cursor = { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  while (cursor.year * 100 + cursor.month <= lastMonth.year * 100 + lastMonth.month) {
    const monthKey = `${cursor.year}-${String(cursor.month).padStart(2, '0')}`;
    const isPaid = Boolean((emi.monthly_status || {})[monthKey]);
    const dueAt = endOfMonthDate(cursor.year, cursor.month);
    const trigger = new Date(dueAt.getTime() - 24 * 60 * 60 * 1000);
    if (!isPaid && trigger.getTime() > now.getTime()) {
      return trigger;
    }
    cursor = nextMonthKey(cursor.year, cursor.month);
  }

  throw new Error('No future EMI reminder is available for this plan.');
}
