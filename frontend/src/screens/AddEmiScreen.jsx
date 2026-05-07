import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import FormInput from '../components/FormInput';
import KeyboardScreen from '../components/KeyboardScreen';
import MonthStepper from '../components/MonthStepper';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { useBudgetify } from '../context/BudgetifyContext';
import { addEmi, deleteEmi, getEmi, setEmiMonthlyStatus, updateEmi } from '../features/budgetify/api';
import {
  cancelNotifications,
  getNextEmiReminderTrigger,
  scheduleNotification,
} from '../features/notifications/service';
import { showAppAlert, showAppConfirm } from '../utils/appAlerts';

function buildEmiPayload({ emiName, monthlyAmount, lastPayableMonth, details, reminderEnabled, notificationId }) {
  return {
    emi_name: emiName.trim(),
    monthly_amount: Number(monthlyAmount || 0),
    last_payable_month: lastPayableMonth.trim(),
    details: details.trim(),
    reminder_enabled: Boolean(reminderEnabled),
    notification_id: notificationId || '',
  };
}

export default function AddEmiScreen() {
  const { session } = useAuth();
  const { refreshSummary } = useBudgetify();
  const token = session?.token || '';
  const now = useMemo(() => new Date(), []);
  const currentMonth = useMemo(
    () => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    [now]
  );

  const [emiName, setEmiName] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [lastPayableMonth, setLastPayableMonth] = useState(currentMonth);
  const [details, setDetails] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [editingEmiId, setEditingEmiId] = useState('');
  const [items, setItems] = useState([]);
  const [historyMonthById, setHistoryMonthById] = useState({});

  const load = useCallback(async () => {
    try {
      const data = await getEmi(token, now.getMonth() + 1, now.getFullYear());
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

  const onAdd = async () => {
    const existingEmi = editingEmiId ? items.find((item) => item.id === editingEmiId) : null;
    let notificationId = '';
    try {
      const basePayload = buildEmiPayload({
        emiName,
        monthlyAmount,
        lastPayableMonth,
        details,
        reminderEnabled,
        notificationId: '',
      });
      if (reminderEnabled) {
        notificationId = await scheduleNotification(
          `EMI Due: ${emiName.trim() || 'EMI'}`,
          'Payment is due tomorrow.',
          getNextEmiReminderTrigger({
            ...existingEmi,
            ...basePayload,
            start_month: existingEmi?.start_month || currentMonth,
            monthly_status: existingEmi?.monthly_status || {},
          })
        );
      }
      const payload = { ...basePayload, notification_id: notificationId };
      if (editingEmiId) {
        await updateEmi(editingEmiId, payload, token);
      } else {
        await addEmi(payload, token);
      }
      await cancelNotifications([existingEmi?.notification_id || '']);
      setEmiName('');
      setMonthlyAmount('');
      setLastPayableMonth(currentMonth);
      setDetails('');
      setReminderEnabled(false);
      setEditingEmiId('');
      await load();
      await refreshSummary();
      showAppAlert(editingEmiId ? 'Updated' : 'Added', editingEmiId ? 'EMI plan updated.' : 'EMI plan added.');
    } catch (err) {
      await cancelNotifications([notificationId]);
      showAppAlert(editingEmiId ? 'Update failed' : 'Add failed', err.message);
    }
  };

  const setStatus = async (id, month, paid) => {
    const existingEmi = items.find((item) => item.id === id);
    let nextNotificationId = '';
    try {
      const paidOn = paid ? (month === currentMonth ? now.toISOString().slice(0, 10) : `${month}-01`) : undefined;
      const updatedStatus = await setEmiMonthlyStatus(id, { month, paid, paid_on: paidOn }, token);
      if (updatedStatus?.reminder_enabled) {
        try {
          nextNotificationId = await scheduleNotification(
            `EMI Due: ${updatedStatus.emi_name || 'EMI'}`,
            'Payment is due tomorrow.',
            getNextEmiReminderTrigger(updatedStatus)
          );
        } catch (err) {
          if (err.message !== 'No future EMI reminder is available for this plan.') {
            throw err;
          }
        }
      }
      await updateEmi(
        id,
        {
          emi_name: updatedStatus.emi_name,
          monthly_amount: Number(updatedStatus.monthly_amount || 0),
          last_payable_month: updatedStatus.last_payable_month,
          details: updatedStatus.details || '',
          reminder_enabled: Boolean(updatedStatus.reminder_enabled),
          notification_id: nextNotificationId,
        },
        token
      );
      await cancelNotifications([existingEmi?.notification_id || '']);
      await load();
      await refreshSummary();
    } catch (err) {
      await cancelNotifications([nextNotificationId]);
      showAppAlert('Status update failed', err.message);
    }
  };

  const updateHistoryMonth = (id, value) => {
    setHistoryMonthById((prev) => ({ ...prev, [id]: value }));
  };

  const onEdit = (emi) => {
    setEditingEmiId(emi.id);
    setEmiName(emi.emi_name || '');
    setMonthlyAmount(String(emi.monthly_amount ?? ''));
    setLastPayableMonth(emi.last_payable_month || currentMonth);
    setDetails(emi.details || '');
    setReminderEnabled(Boolean(emi.reminder_enabled));
  };

  const onDelete = async (id) => {
    const confirmed = await showAppConfirm({
      title: 'Delete EMI',
      message: 'Do you want to delete this EMI plan?',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    const target = items.find((item) => item.id === id);
    try {
      await deleteEmi(id, token);
      await cancelNotifications([target?.notification_id || '']);
      if (editingEmiId === id) {
        setEditingEmiId('');
        setEmiName('');
        setMonthlyAmount('');
        setLastPayableMonth(currentMonth);
        setDetails('');
        setReminderEnabled(false);
      }
      await load();
      await refreshSummary();
      showAppAlert('Deleted', 'EMI plan removed.');
    } catch (err) {
      showAppAlert('Delete failed', err.message);
    }
  };

  return (
    <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>EMI Setup</Text>
        <Text style={styles.helper}>
          EMI is reserved from the monthly budget automatically. Paid status is only for tracking.
        </Text>
        <View style={styles.card}>
          <FormInput theme="dark" compact label="EMI name" value={emiName} onChangeText={setEmiName} placeholder="EMI name" />
          <FormInput theme="dark" compact label="Monthly amount" value={monthlyAmount} onChangeText={setMonthlyAmount} placeholder="Monthly amount" keyboardType="numeric" />
          <MonthStepper theme="dark" label="Last payable month" value={lastPayableMonth} onChange={setLastPayableMonth} />
          <FormInput theme="dark" compact label="Details" value={details} onChangeText={setDetails} placeholder="Details (optional)" />
          <Pressable
            style={[styles.reminderToggle, reminderEnabled ? styles.reminderToggleActive : null]}
            onPress={() => setReminderEnabled((prev) => !prev)}
          >
            <Text style={[styles.reminderToggleText, reminderEnabled ? styles.reminderToggleTextActive : null]}>
              Reminder {reminderEnabled ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
          <PrimaryButton theme="dark" compact title={editingEmiId ? 'Update EMI' : 'Add EMI'} onPress={onAdd} />
          {editingEmiId ? (
            <Pressable
              style={styles.cancelBtn}
              onPress={() => {
                setEditingEmiId('');
                setEmiName('');
                setMonthlyAmount('');
                setLastPayableMonth(currentMonth);
                setDetails('');
                setReminderEnabled(false);
              }}
            >
              <Feather name="x" size={14} color="#cbd5e1" />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.subTitle}>Active EMI Plans</Text>
        {items.some((item) => item.reminder_enabled) ? (
          <View style={styles.upcomingCard}>
            <Text style={styles.upcomingTitle}>Upcoming Reminders</Text>
            {items
              .filter((item) => item.reminder_enabled)
              .slice(0, 5)
              .map((emi, index) => (
                <View key={`upcoming-${emi.id}`} style={[styles.upcomingItem, index === 0 ? styles.upcomingItemFirst : null]}>
                  <Text style={styles.upcomingItemTitle}>{emi.emi_name}</Text>
                  <Text style={styles.upcomingItemMeta}>Last payable month: {emi.last_payable_month}</Text>
                </View>
              ))}
          </View>
        ) : null}
        {items.length === 0 ? <Text style={styles.empty}>No EMI plans found.</Text> : null}
        {items.map((emi) => {
          const historyMonth = historyMonthById[emi.id] || '';
          return (
            <View key={emi.id} style={styles.row}>
              <Text style={styles.name}>{emi.emi_name}</Text>
              <Text style={styles.meta}>Monthly: Rs {emi.monthly_amount}</Text>
              <Text style={styles.meta}>Last payable month: {emi.last_payable_month}</Text>
              <Text style={styles.meta}>
                {currentMonth} status: {emi.current_month_paid ? 'Paid' : 'Pending'}
              </Text>
              {emi.details ? <Text style={styles.meta}>Details: {emi.details}</Text> : null}

              <View style={styles.rowActions}>
                <Pressable style={[styles.iconBtn, styles.paidBtn]} onPress={() => setStatus(emi.id, currentMonth, true)}>
                  <Feather name="check" size={15} color="#ffffff" />
                </Pressable>
                <Pressable style={[styles.iconBtn, styles.unpaidBtn]} onPress={() => setStatus(emi.id, currentMonth, false)}>
                  <Feather name="x" size={15} color="#ffffff" />
                </Pressable>
                <Pressable style={[styles.iconBtn, styles.editBtn]} onPress={() => onEdit(emi)}>
                  <Feather name="edit-3" size={15} color="#ffffff" />
                </Pressable>
                <Pressable style={[styles.iconBtn, styles.deleteBtn]} onPress={() => onDelete(emi.id)}>
                  <Feather name="trash-2" size={15} color="#ffffff" />
                </Pressable>
              </View>

              <MonthStepper
                theme="dark"
                label="Previous paid month"
                value={historyMonth || currentMonth}
                onChange={(value) => updateHistoryMonth(emi.id, value)}
              />
              <View style={styles.rowActions}>
                <Pressable
                  style={[styles.iconBtn, styles.historyBtn]}
                  onPress={() => {
                    const month = (historyMonth || currentMonth).trim();
                    if (!month) {
                      showAppAlert('Required', 'Enter previous month in YYYY-MM.');
                      return;
                    }
                    setStatus(emi.id, month, true);
                  }}
                >
                  <Feather name="corner-up-left" size={15} color="#ffffff" />
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
  helper: { color: 'rgba(148,163,184,0.74)', marginBottom: 8 },
  subTitle: { fontSize: 16, fontWeight: '800', color: '#f8fafc', marginBottom: 8, marginTop: 6 },
  card: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  empty: { color: 'rgba(148,163,184,0.72)' },
  row: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    borderRadius: 16,
    padding: 10,
    marginBottom: 8,
  },
  name: { fontWeight: '800', color: '#f8fafc' },
  meta: { color: 'rgba(148,163,184,0.72)', marginTop: 2, fontSize: 12 },
  rowActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  paidBtn: { backgroundColor: '#16a34a' },
  unpaidBtn: { backgroundColor: '#dc2626' },
  historyBtn: { backgroundColor: '#2563eb' },
  editBtn: { backgroundColor: '#475569' },
  deleteBtn: { backgroundColor: '#b91c1c' },
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
});
