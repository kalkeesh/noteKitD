import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import DateStepper from '../components/DateStepper';
import FormInput from '../components/FormInput';
import KeyboardScreen from '../components/KeyboardScreen';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { useBudgetify } from '../context/BudgetifyContext';
import { addDebt, deleteDebt, getDebts, markDebtPaid, updateDebt } from '../features/budgetify/api';
import {
  cancelNotifications,
  getDebtReminderTrigger,
  scheduleNotification,
} from '../features/notifications/service';
import { showAppAlert, showAppConfirm } from '../utils/appAlerts';

function buildDebtPayload({
  debtName,
  amount,
  dueDate,
  status,
  installmentAmount,
  installmentCount,
  reminderEnabled,
  notificationId,
}) {
  return {
    debt_name: debtName.trim(),
    amount: Number(amount || 0),
    due_date: dueDate,
    status,
    installment_amount: Number(installmentAmount || 0),
    installment_count: Number(installmentCount || 0),
    reminder_enabled: Boolean(reminderEnabled),
    notification_id: notificationId || '',
  };
}

export default function AddDebtScreen() {
  const { session } = useAuth();
  const { refreshSummary } = useBudgetify();
  const token = session?.token || '';
  const now = useMemo(() => new Date(), []);
  const [debtName, setDebtName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(now.toISOString().slice(0, 10));
  const [status, setStatus] = useState('pending');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [installmentCount, setInstallmentCount] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState('');
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    try {
      const data = await getDebts(token, now.getMonth() + 1, now.getFullYear());
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      showAppAlert('Load failed', err.message);
    }
  }, [now, token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const resetForm = () => {
    setDebtName('');
    setAmount('');
    setDueDate(now.toISOString().slice(0, 10));
    setStatus('pending');
    setInstallmentAmount('');
    setInstallmentCount('');
    setReminderEnabled(false);
    setEditingDebtId('');
  };

  const onSave = async () => {
    const existingDebt = editingDebtId ? items.find((item) => item.id === editingDebtId) : null;
    let notificationId = '';
    try {
      if (reminderEnabled && status !== 'paid') {
        notificationId = await scheduleNotification(
          `Debt Due: ${debtName.trim() || 'Debt'}`,
          'Payment is due tomorrow.',
          getDebtReminderTrigger(dueDate)
        );
      }
      const payload = buildDebtPayload({
        debtName,
        amount,
        dueDate,
        status,
        installmentAmount,
        installmentCount,
        reminderEnabled,
        notificationId,
      });
      if (editingDebtId) {
        await updateDebt(editingDebtId, payload, token);
        showAppAlert('Updated', 'Debt updated successfully.');
      } else {
        await addDebt(payload, token);
        showAppAlert('Added', 'Debt added successfully.');
      }
      await cancelNotifications([existingDebt?.notification_id || '']);
      resetForm();
      await load();
      await refreshSummary();
    } catch (err) {
      await cancelNotifications([notificationId]);
      showAppAlert('Save failed', err.message);
    }
  };

  const onPaid = async (id) => {
    try {
      const target = items.find((item) => item.id === id);
      await markDebtPaid(id, token);
      await cancelNotifications([target?.notification_id || '']);
      await load();
      await refreshSummary();
    } catch (err) {
      showAppAlert('Update failed', err.message);
    }
  };

  const onEdit = (debt) => {
    setEditingDebtId(debt.id);
    setDebtName(debt.debt_name || '');
    setAmount(String(debt.amount ?? ''));
    setDueDate(debt.due_date || now.toISOString().slice(0, 10));
    setStatus(debt.status || 'pending');
    setInstallmentAmount(String(debt.installment_amount || ''));
    setInstallmentCount(String(debt.installment_count || ''));
    setReminderEnabled(Boolean(debt.reminder_enabled));
  };

  const onDelete = async (id) => {
    const confirmed = await showAppConfirm({
      title: 'Delete debt',
      message: 'Do you want to delete this debt?',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    try {
      const target = items.find((item) => item.id === id);
      await deleteDebt(id, token);
      await cancelNotifications([target?.notification_id || '']);
      if (editingDebtId === id) {
        resetForm();
      }
      await load();
      await refreshSummary();
      showAppAlert('Deleted', 'Debt removed.');
    } catch (err) {
      showAppAlert('Delete failed', err.message);
    }
  };

  return (
    <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Debt Tracking</Text>
        <View style={styles.card}>
          <FormInput theme="dark" compact label="Debt name" value={debtName} onChangeText={setDebtName} placeholder="Debt name" />
          <FormInput theme="dark" compact label="Total amount" value={amount} onChangeText={setAmount} placeholder="Amount" keyboardType="numeric" />
          <FormInput theme="dark" compact label="Installment amount (optional)" value={installmentAmount} onChangeText={setInstallmentAmount} placeholder="Installment amount" keyboardType="numeric" />
          <FormInput theme="dark" compact label="Installment count (optional)" value={installmentCount} onChangeText={setInstallmentCount} placeholder="Installment count" keyboardType="numeric" />
          <DateStepper theme="dark" label="Due date" value={dueDate} onChange={setDueDate} />
          <FormInput theme="dark" compact label="Status" value={status} onChangeText={setStatus} placeholder="pending or paid" />
          <Pressable
            style={[styles.reminderToggle, reminderEnabled ? styles.reminderToggleActive : null]}
            onPress={() => setReminderEnabled((prev) => !prev)}
          >
            <Text style={[styles.reminderToggleText, reminderEnabled ? styles.reminderToggleTextActive : null]}>
              Reminder {reminderEnabled ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
          <PrimaryButton theme="dark" compact title={editingDebtId ? 'Update Debt' : 'Add Debt'} onPress={onSave} />
          {editingDebtId ? (
            <Pressable style={styles.cancelBtn} onPress={resetForm}>
              <Feather name="x" size={14} color="#cbd5e1" />
            </Pressable>
          ) : null}
        </View>

        {items.some((item) => item.reminder_enabled && item.status !== 'paid') ? (
          <View style={styles.upcomingCard}>
            <Text style={styles.upcomingTitle}>Upcoming Reminders</Text>
            {items
              .filter((item) => item.reminder_enabled && item.status !== 'paid')
              .sort((left, right) => String(left.due_date || '').localeCompare(String(right.due_date || '')))
              .slice(0, 5)
              .map((item, index) => (
                <View
                  key={`reminder-${item.id}`}
                  style={[styles.upcomingItem, index === 0 ? styles.upcomingItemFirst : null]}
                >
                  <Text style={styles.upcomingItemTitle}>{item.debt_name}</Text>
                  <Text style={styles.upcomingItemMeta}>Due on {item.due_date}</Text>
                </View>
              ))}
          </View>
        ) : null}

        {items.map((debt) => {
          const due = new Date(debt.due_date);
          const daysLeft = Math.ceil((due - now) / (24 * 60 * 60 * 1000));
          const severity = debt.status === 'paid' ? '#17a34a' : daysLeft < 0 ? '#dc2626' : daysLeft <= 3 ? '#d97706' : '#475569';
          return (
            <View key={debt.id} style={[styles.row, { borderColor: severity }]}>
              <View style={styles.rowBody}>
                <Text style={styles.name}>{debt.debt_name}</Text>
                <Text style={styles.meta}>Rs {debt.amount} | {debt.due_date} | {debt.status}</Text>
              </View>
              <View style={styles.actions}>
                {debt.status === 'pending' ? (
                  <Pressable style={[styles.iconActionBtn, styles.paidBtn]} onPress={() => onPaid(debt.id)}>
                    <Feather name="check" size={15} color="#ffffff" />
                  </Pressable>
                ) : null}
                <Pressable style={[styles.iconActionBtn, styles.editBtn]} onPress={() => onEdit(debt)}>
                  <Feather name="edit-3" size={15} color="#ffffff" />
                </Pressable>
                <Pressable style={[styles.iconActionBtn, styles.deleteBtn]} onPress={() => onDelete(debt.id)}>
                  <Feather name="trash-2" size={15} color="#ffffff" />
                </Pressable>
              </View>
            </View>
          );
        })}
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30 },
  heading: { fontSize: 24, fontWeight: '800', color: '#f8fafc', marginBottom: 8 },
  card: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  cancelBtn: {
    marginTop: 8,
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,41,59,0.72)',
  },
  reminderToggle: {
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(30,41,59,0.82)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  reminderToggleActive: {
    borderColor: 'rgba(96,165,250,0.45)',
    backgroundColor: 'rgba(37,99,235,0.16)',
  },
  reminderToggleText: {
    color: '#cbd5e1',
    fontWeight: '700',
  },
  reminderToggleTextActive: {
    color: '#93c5fd',
  },
  upcomingCard: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  upcomingTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  upcomingItem: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.12)',
    paddingTop: 8,
    marginTop: 8,
  },
  upcomingItemFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
    marginTop: 0,
  },
  upcomingItemTitle: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  upcomingItemMeta: {
    color: 'rgba(148,163,184,0.72)',
    fontSize: 12,
    marginTop: 2,
  },
  row: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  rowBody: { marginBottom: 8 },
  name: { fontWeight: '800', color: '#f8fafc' },
  meta: { color: 'rgba(148,163,184,0.72)', marginTop: 2, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  iconActionBtn: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  paidBtn: { backgroundColor: '#16a34a' },
  editBtn: { backgroundColor: '#2563eb' },
  deleteBtn: { backgroundColor: '#dc2626' },
});
