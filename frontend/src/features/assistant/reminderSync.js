import { apiRequest } from '../../config/api';
import { updateDebt, updateEmi } from '../budgetify/api';
import {
  cancelNotifications,
  getDebtReminderTrigger,
  getNextEmiReminderTrigger,
  getTodoReminderTrigger,
  scheduleNotification,
} from '../notifications/service';

function todoReminderTitle(resource) {
  const item = resource?.items?.[0] || {};
  if ((resource?.listType || 'task') === 'task') {
    return `Task Due: ${item.text || resource?.title || 'Untitled task'}`;
  }
  return `Project Task Due: ${item.text || resource?.title || 'Task'}`;
}

export async function syncAssistantReminderIfNeeded(response, token) {
  const resourceType = response?.resource_type || '';
  const resource = response?.resource;
  const cleanupNotificationIds = response?.cleanup_notification_ids || [];
  if (cleanupNotificationIds.length) {
    await cancelNotifications(cleanupNotificationIds);
  }
  if (!resourceType || !resource || !token) {
    return { resource, warning: '' };
  }

  if (resourceType === 'todo') {
    if (response?.operation === 'delete') {
      return { resource, warning: '' };
    }
    if ((resource?.listType || 'task') !== 'task') {
      return { resource, warning: '' };
    }
    const item = resource.items?.[0];
    if (!item?.reminderEnabled || item?.done) {
      return { resource, warning: '' };
    }
    const notificationId = await scheduleNotification(
      todoReminderTitle(resource),
      'Scheduled in 1 hour.',
      getTodoReminderTrigger(item)
    );
    const updated = await apiRequest(
      `/api/todos/${resource.id}`,
      'PUT',
      {
        title: resource.title,
        listType: resource.listType || 'task',
        items: (resource.items || []).map((entry, index) => ({
          id: entry.id ?? index + 1,
          text: entry.text || '',
          done: Boolean(entry.done),
          reminderDate: entry.reminderDate || '',
          reminderTime: entry.reminderTime || '',
          reminderEnabled: Boolean(entry.reminderEnabled),
          notificationId: entry.id === item.id ? notificationId : entry.notificationId || '',
        })),
      },
      token
    );
    return {
      resource: updated,
      warning: '',
    };
  }

  if (resourceType === 'debt' && resource.reminder_enabled && resource.status !== 'paid') {
    const notificationId = await scheduleNotification(
      `Debt Due: ${resource.debt_name || 'Debt'}`,
      'Payment is due tomorrow.',
      getDebtReminderTrigger(resource.due_date)
    );
    const updated = await updateDebt(
      resource.id,
      {
        debt_name: resource.debt_name,
        amount: Number(resource.amount || 0),
        due_date: resource.due_date,
        status: resource.status || 'pending',
        installment_amount: Number(resource.installment_amount || 0),
        installment_count: Number(resource.installment_count || 0),
        reminder_enabled: true,
        notification_id: notificationId,
      },
      token
    );
    return { resource: updated, warning: '' };
  }

  if (resourceType === 'emi' && resource.reminder_enabled) {
    const notificationId = await scheduleNotification(
      `EMI Due: ${resource.emi_name || 'EMI'}`,
      'Payment is due tomorrow.',
      getNextEmiReminderTrigger(resource)
    );
    const updated = await updateEmi(
      resource.id,
      {
        emi_name: resource.emi_name,
        monthly_amount: Number(resource.monthly_amount || 0),
        last_payable_month: resource.last_payable_month,
        details: resource.details || '',
        reminder_enabled: true,
        notification_id: notificationId,
      },
      token
    );
    return { resource: updated, warning: '' };
  }

  return { resource, warning: '' };
}
