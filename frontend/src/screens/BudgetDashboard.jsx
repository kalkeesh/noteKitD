import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import AppDatePicker from '../components/AppDatePicker';
import FormInput from '../components/FormInput';
import { getProfileImageUrl } from '../config/profileImages';
import { useAuth } from '../context/AuthContext';
import { useBudgetify } from '../context/BudgetifyContext';
import { addSpend } from '../features/budgetify/api';
import { subscribeAssistantEvents } from '../features/assistant/events';
import { showAppAlert } from '../utils/appAlerts';

function statusColor(color) {
  if (color === 'red') {
    return '#dc2626';
  }
  if (color === 'yellow') {
    return '#d97706';
  }
  return '#16a34a';
}

function toIsoDate(value) {
  if (!value) {
    return '';
  }
  return String(value).slice(0, 10);
}

function monthName(month, year) {
  return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function buildCalendarCells(month, year) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const total = daysInMonth(month, year);
  const cells = [];

  for (let i = 0; i < firstDay; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= total; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function startOfMonth(month, year) {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function endOfMonth(month, year) {
  return `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(month, year)).padStart(2, '0')}`;
}

const STAT_META = [
  { key: 'budget', label: 'Budget', icon: 'wallet', accent: '#60a5fa', bg: 'rgba(37,99,235,0.16)' },
  { key: 'spend', label: 'Spent', icon: 'trending-up', accent: '#f472b6', bg: 'rgba(236,72,153,0.16)' },
  { key: 'remaining', label: 'Left', icon: 'shield', accent: '#34d399', bg: 'rgba(16,185,129,0.16)' },
  { key: 'month', label: 'Month', icon: 'calendar', accent: '#f59e0b', bg: 'rgba(245,158,11,0.16)' },
];

const ACTIONS = [
  { key: 'setup', label: 'Setup', icon: 'sliders', color: '#7dd3fc', bg: 'rgba(14,165,233,0.16)', route: 'BudgetSetup' },
  { key: 'emi', label: 'EMI', icon: 'credit-card', color: '#c084fc', bg: 'rgba(124,58,237,0.18)', route: 'AddEmi' },
  { key: 'debt', label: 'Debt', icon: 'alert-octagon', color: '#fb923c', bg: 'rgba(234,88,12,0.18)', route: 'AddDebt' },
  { key: 'analytics', label: 'Stats', icon: 'bar-chart-2', color: '#5eead4', bg: 'rgba(13,148,136,0.18)', route: 'Analytics' },
];

const EVENT_COLORS = {
  expense: '#2563eb',
  debt_due: '#d97706',
  debt_paid: '#16a34a',
  emi_paid: '#7c3aed',
  sip_paid: '#0891b2',
};

function StatCard({ label, value, icon, accent, bg }) {
  return (
    <Pressable style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: bg }]}>
        <Feather name={icon} size={15} color={accent} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function DayTimeline({ items }) {
  if (!items.length) {
    return <Text style={styles.empty}>No items for this day.</Text>;
  }

  return items.map((item, index) => (
    <View key={`${item.type}-${index}`} style={[styles.timelineRow, { borderLeftColor: item.color }]}>
      <View style={styles.timelineIconBadge}>
        <Feather name="activity" size={13} color={item.color} />
      </View>
      <View style={styles.timelineContent}>
        <Text style={styles.timelineTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.timelineMeta}>Rs {Number(item.amount || 0).toFixed(2)}</Text>
      </View>
    </View>
  ));
}

export default function BudgetDashboard({
  navigation,
  embedded = false,
  showAddSpend: externalShowAddSpend,
  onShowAddSpendChange,
}) {
  const { session } = useAuth();
  const { month, year, summary, loading, error, setPeriod, refreshSummary } = useBudgetify();
  const now = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => now.toISOString().slice(0, 10), [now]);
  const [internalShowAddSpend, setInternalShowAddSpend] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [date, setDate] = useState(todayIso);
  const [note, setNote] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const token = session?.token || '';
  const profileImageUrl = embedded ? '' : getProfileImageUrl(session?.profileImageKey || '');
  const showAddSpend = typeof externalShowAddSpend === 'boolean' ? externalShowAddSpend : internalShowAddSpend;
  const setShowAddSpend = onShowAddSpendChange || setInternalShowAddSpend;
  const Container = embedded ? View : SafeAreaView;

  const todayData = summary?.today || null;
  const spends = summary?.spends || [];
  const debts = summary?.debts || [];
  const emis = summary?.emis || [];
  const sips = summary?.sips || [];
  const setupRequired = Boolean(error && error.includes('Please complete the setup'));
  const upcomingReminders = useMemo(() => {
    const debtReminders = debts
      .filter((item) => item.reminder_enabled && item.status !== 'paid')
      .map((item) => ({
        id: `debt-${item.id}`,
        title: item.debt_name || 'Debt',
        dueDate: item.due_date,
        type: 'Debt',
      }));
    const emiReminders = emis
      .filter((item) => item.reminder_enabled)
      .map((item) => ({
        id: `emi-${item.id}`,
        title: item.emi_name || 'EMI',
        dueDate: item.last_payable_month,
        type: 'EMI',
      }));
    return [...debtReminders, ...emiReminders]
      .sort((left, right) => String(left.dueDate || '').localeCompare(String(right.dueDate || '')))
      .slice(0, 6);
  }, [debts, emis]);

  const eventsByDate = useMemo(() => {
    const map = {};
    const addEvent = (dateKey, entry) => {
      if (!dateKey) {
        return;
      }
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(entry);
    };

    spends.forEach((entry) => {
      addEvent(entry.date, {
        type: 'expense',
        title: `Expense: ${entry.category || 'other'}${entry.note ? ` - ${entry.note}` : ''}`,
        amount: Number(entry.amount || 0),
        color: EVENT_COLORS.expense,
      });
    });

    debts.forEach((entry) => {
      addEvent(entry.due_date, {
        type: 'debt_due',
        title: `Debt due: ${entry.debt_name || 'Debt'}`,
        amount: Number(entry.installment_amount || 0) || Number(entry.amount || 0),
        color: EVENT_COLORS.debt_due,
      });
      if (entry.status === 'paid' && entry.paid_at) {
        addEvent(toIsoDate(entry.paid_at), {
          type: 'debt_paid',
          title: `Debt paid: ${entry.debt_name || 'Debt'}`,
          amount: Number(entry.installment_amount || 0) || Number(entry.amount || 0),
          color: EVENT_COLORS.debt_paid,
        });
      }
    });

    emis.forEach((entry) => {
      Object.entries(entry.monthly_status_dates || {}).forEach(([, paidOn]) => {
        const day = toIsoDate(paidOn);
        if (day.startsWith(`${year}-${String(month).padStart(2, '0')}`)) {
          addEvent(day, {
            type: 'emi_paid',
            title: `EMI paid: ${entry.emi_name || 'EMI'}`,
            amount: Number(entry.monthly_amount || 0),
            color: EVENT_COLORS.emi_paid,
          });
        }
      });
    });

    sips.forEach((entry) => {
      Object.entries(entry.monthly_status_dates || {}).forEach(([, paidOn]) => {
        const day = toIsoDate(paidOn);
        if (day.startsWith(`${year}-${String(month).padStart(2, '0')}`)) {
          addEvent(day, {
            type: 'sip_paid',
            title: `SIP paid: ${entry.sip_name || 'SIP'}`,
            amount: Number(entry.monthly_amount || 0),
            color: EVENT_COLORS.sip_paid,
          });
        }
      });
    });

    return map;
  }, [debts, emis, month, sips, spends, year]);

  const spendColor = useMemo(() => statusColor(todayData?.spend_status_color), [todayData]);

  useFocusEffect(
    useCallback(() => {
      refreshSummary(month, year).catch((err) => {
        if (!(err?.message || '').includes('Please complete the setup')) {
          showAppAlert('Failed', err.message);
        }
      });
    }, [month, refreshSummary, year])
  );

  React.useEffect(() => {
    return subscribeAssistantEvents((event) => {
      if (event?.type === 'assistant-action-complete') {
        refreshSummary(month, year).catch(() => {});
      }
    });
  }, [month, refreshSummary, year]);

  const resetSpendForm = () => {
    setAmount('');
    setCategory('food');
    setDate(todayIso);
    setNote('');
  };

  const onSaveSpend = async () => {
    try {
      await addSpend(
        {
          amount: Number(amount || 0),
          category: category.trim() || 'other',
          note: note.trim(),
          date,
        },
        token
      );
      resetSpendForm();
      setShowAddSpend(false);
      await refreshSummary(month, year);
      showAppAlert('Saved', 'Daily expense logged.');
    } catch (err) {
      showAppAlert('Save failed', err.message);
    }
  };

  const calendarCells = useMemo(() => buildCalendarCells(month, year), [month, year]);
  const selectedItems = eventsByDate[selectedDate] || [];

  const onPrevMonth = () => {
    if (month === 1) {
      setPeriod(12, year - 1);
      setSelectedDate(`${year - 1}-12-01`);
      return;
    }
    const nextMonth = month - 1;
    setPeriod(nextMonth, year);
    setSelectedDate(`${year}-${String(nextMonth).padStart(2, '0')}-01`);
  };

  const onNextMonth = () => {
    if (month === 12) {
      setPeriod(1, year + 1);
      setSelectedDate(`${year + 1}-01-01`);
      return;
    }
    const nextMonth = month + 1;
    setPeriod(nextMonth, year);
    setSelectedDate(`${year}-${String(nextMonth).padStart(2, '0')}-01`);
  };

  const dateKeyForDay = (day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const statValues = [
    `Rs ${todayData?.recommended_budget ?? 0}`,
    `Rs ${todayData?.actual_spend ?? 0}`,
    `Rs ${todayData?.remaining_budget ?? 0}`,
    `${todayData?.month ?? '-'} / ${todayData?.year ?? '-'}`,
  ];

  return (
    <Container style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, embedded ? styles.contentEmbedded : null]} showsVerticalScrollIndicator={false}>
        {!embedded ? (
          <View style={styles.topBar}>
            <Pressable style={styles.topBarProfileButton} onPress={() => navigation.navigate('BudgetProfile')}>
              {profileImageUrl ? (
                <Image source={{ uri: profileImageUrl }} style={styles.topBarAvatar} />
              ) : (
                <View style={[styles.topBarAvatar, styles.topBarAvatarFallback]}>
                  <Text style={styles.topBarAvatarFallbackText}>
                    {(session?.name || 'U').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
            </Pressable>
            <View style={styles.topBarCopy}>
              <Text style={styles.heading}>Budgetify</Text>
              <Text style={styles.subHeading}>{loading ? 'Refreshing dashboard...' : 'Money command center'}</Text>
            </View>
            <Pressable style={styles.topBarMenuButton} onPress={() => navigation.navigate('BudgetProfile')}>
              <Feather name="user" size={18} color="#eff5ff" />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.statusCard, { borderColor: spendColor }]}>
          <View style={styles.statusHeaderRow}>
            <View>
              <Text style={styles.statusTitle}>Today</Text>
              <Text style={styles.statusCaption}>{monthName(month, year)}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: `${spendColor}20` }]}>
              <Feather name="activity" size={14} color={spendColor} />
              <Text style={[styles.statusPillText, { color: spendColor }]}>
                {todayData?.spend_status?.toUpperCase() || 'UNDER'}
              </Text>
            </View>
          </View>
          <Text style={[styles.statusText, { color: spendColor }]}>{`Rs ${todayData?.actual_spend ?? 0}`}</Text>
          <View style={styles.statusMetricsRow}>
            <View style={styles.statusMetricChip}>
              <Text style={styles.statusMetricLabel}>Budget</Text>
              <Text style={styles.statusMetricValue}>Rs {todayData?.recommended_budget ?? 0}</Text>
            </View>
            <View style={styles.statusMetricChip}>
              <Text style={styles.statusMetricLabel}>Left</Text>
              <Text style={styles.statusMetricValue}>Rs {todayData?.remaining_budget ?? 0}</Text>
            </View>
            <View style={styles.statusMetricChip}>
              <Text style={styles.statusMetricLabel}>Risk</Text>
              <Text style={styles.statusMetricValue}>{(todayData?.risk_indicator || 'low').toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          {STAT_META.map((item, index) => (
            <StatCard
              key={item.key}
              label={item.label}
              value={statValues[index]}
              icon={item.icon}
              accent={item.accent}
              bg={item.bg}
            />
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Payments</Text>
        {(todayData?.alerts || []).length === 0 ? <Text style={styles.empty}>No alerts right now.</Text> : null}
        {(todayData?.alerts || []).map((alertItem) => (
          <Pressable
            key={`${alertItem.kind}-${alertItem.id}`}
            style={[styles.alertRow, { borderColor: statusColor(alertItem.severity) }]}
            onPress={() => navigation.navigate(alertItem.kind === 'emi' ? 'AddEmi' : 'AddDebt')}
          >
            <View style={[styles.alertIconWrap, { backgroundColor: `${statusColor(alertItem.severity)}20` }]}>
              <Feather
                name={alertItem.kind === 'emi' ? 'credit-card' : 'alert-triangle'}
                size={15}
                color={statusColor(alertItem.severity)}
              />
            </View>
            <View style={styles.alertBody}>
              <Text style={styles.alertTitle}>
                {alertItem.kind === 'emi' ? 'EMI' : 'Debt'} . {alertItem.name}
              </Text>
              <Text style={styles.alertMeta}>Rs {alertItem.amount} . {alertItem.due_in_days}d . {alertItem.due_date}</Text>
            </View>
            <Text style={styles.chevronText}>{'>'}</Text>
          </Pressable>
        ))}

        {setupRequired ? (
          <View style={styles.setupCard}>
            <Text style={styles.setupTitle}>Setup needed</Text>
            <Text style={styles.setupText}>Complete setup to unlock all budgeting tools.</Text>
            <Pressable style={styles.setupButton} onPress={() => navigation.navigate('BudgetSetup')}>
              <Text style={styles.setupButtonText}>Open</Text>
            </Pressable>
          </View>
        ) : null}

        {(todayData?.smart_alerts || []).map((item) => (
          <View key={item.id} style={styles.smartAlertCard}>
            <Text style={styles.smartAlertTitle}>{item.title}</Text>
            <Text style={styles.smartAlertText}>{item.message}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Reminders</Text>
        {upcomingReminders.length === 0 ? <Text style={styles.empty}>No reminders enabled right now.</Text> : null}
        {upcomingReminders.map((item) => (
          <View key={item.id} style={styles.reminderRow}>
            <Text style={styles.reminderTitle}>{item.type} . {item.title}</Text>
            <Text style={styles.reminderMeta}>{item.dueDate}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          {ACTIONS.map((action) => (
            <Pressable
              key={action.key}
              style={styles.actionCard}
              onPress={() => navigation.navigate(action.route)}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.bg }]}>
                <Feather name={action.icon} size={18} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

      </ScrollView>

      {!embedded ? (
        <Pressable style={styles.fab} onPress={() => setShowAddSpend(true)}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      ) : null}

      <Modal visible={showAddSpend} transparent animationType="slide" onRequestClose={() => setShowAddSpend(false)}>
        <View style={styles.sheetOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.sheetCard}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Quick Spend</Text>
              <Text style={styles.sheetSubtitle}>Fast add for daily spend.</Text>
              <FormInput theme="dark" compact value={amount} onChangeText={setAmount} placeholder="Amount" keyboardType="numeric" />
              <FormInput theme="dark" compact value={category} onChangeText={setCategory} placeholder="Category" />
              <AppDatePicker theme="dark" label="Spend date" value={date} onChange={setDate} placeholder="Pick a date" />
              <FormInput theme="dark" compact value={note} onChangeText={setNote} placeholder="Note or details" multiline />

              <View style={styles.sheetActions}>
                <Pressable style={styles.sheetGhostBtn} onPress={() => setShowAddSpend(false)}>
                  <Text style={styles.sheetGhostText}>Close</Text>
                </Pressable>
                <Pressable style={styles.sheetPrimaryBtn} onPress={onSaveSpend}>
                  <Text style={styles.sheetPrimaryText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  contentEmbedded: { paddingTop: 4 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  topBarProfileButton: {
    width: 46,
    height: 46,
  },
  topBarAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#31476d',
    backgroundColor: '#172741',
  },
  topBarAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarAvatarFallbackText: {
    color: '#eff5ff',
    fontSize: 16,
    fontWeight: '800',
  },
  topBarCopy: {
    flex: 1,
    paddingHorizontal: 14,
  },
  topBarMenuButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
    backgroundColor: 'rgba(15,23,42,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { color: '#f3f7ff', fontSize: 28, fontWeight: '800' },
  subHeading: { color: '#a9b4d2', marginTop: 2 },
  statusCard: {
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: 'rgba(15,23,42,0.82)',
    padding: 16,
    marginBottom: 12,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusTitle: { color: '#d5ddf3', fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  statusCaption: { marginTop: 4, color: 'rgba(148,163,184,0.72)', fontSize: 12, fontWeight: '600' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusPillText: { marginLeft: 6, fontSize: 11, fontWeight: '800' },
  statusText: { marginTop: 10, fontSize: 28, fontWeight: '800' },
  statusMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statusMetricChip: {
    width: '31.5%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(30,41,59,0.82)',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  statusMetricLabel: { color: 'rgba(148,163,184,0.58)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  statusMetricValue: { color: '#f8fafc', marginTop: 4, fontSize: 12, fontWeight: '800' },
  setupCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.2)',
    backgroundColor: 'rgba(15,23,42,0.76)',
    padding: 16,
    marginBottom: 12,
  },
  setupTitle: {
    color: '#f4f8ff',
    fontSize: 18,
    fontWeight: '800',
  },
  setupText: {
    marginTop: 6,
    color: '#c0d0ee',
    lineHeight: 20,
  },
  setupButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: '#7dd3fc',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  setupButtonText: {
    color: '#083344',
    fontWeight: '800',
  },
  smartAlertCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.14)',
    backgroundColor: 'rgba(15,23,42,0.7)',
    padding: 12,
    marginBottom: 10,
  },
  smartAlertTitle: {
    color: '#f3f7ff',
    fontWeight: '800',
  },
  smartAlertText: {
    color: '#bdd0ef',
    marginTop: 4,
    lineHeight: 18,
  },
  statsRow: {
    paddingBottom: 4,
    marginBottom: 8,
  },
  statCard: {
    width: 92,
    minHeight: 108,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(15,23,42,0.76)',
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginRight: 8,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  statLabel: { color: '#afbddf', fontSize: 10, marginTop: 4, fontWeight: '700' },
  sectionTitle: { color: '#e8eeff', marginTop: 6, marginBottom: 8, fontSize: 15, fontWeight: '800' },
  empty: { color: '#95a4cb' },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(15,23,42,0.76)',
    padding: 10,
    marginBottom: 8,
  },
  alertIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  alertBody: { flex: 1 },
  alertTitle: { color: '#f2f6ff', fontWeight: '800', fontSize: 13 },
  alertMeta: { marginTop: 3, color: '#b1c0e4', fontSize: 11, fontWeight: '600' },
  chevronText: { color: '#8aa0c7', fontSize: 22, fontWeight: '800' },
  reminderRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.1)',
    backgroundColor: 'rgba(15,23,42,0.72)',
    padding: 10,
    marginBottom: 8,
  },
  reminderTitle: {
    color: '#f2f6ff',
    fontWeight: '700',
  },
  reminderMeta: {
    marginTop: 2,
    color: '#b1c0e4',
    fontSize: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '23.5%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.1)',
    backgroundColor: 'rgba(15,23,42,0.82)',
    paddingVertical: 13,
    paddingHorizontal: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    color: '#eff5ff',
    fontWeight: '800',
    fontSize: 11,
  },
  calendarCard: {
    marginTop: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(15,23,42,0.76)',
    padding: 12,
  },
  calendarHead: {
    marginBottom: 10,
  },
  calendarTitle: {
    color: '#eef5ff',
    fontSize: 18,
    fontWeight: '800',
  },
  calendarSubtitle: {
    marginTop: 3,
    color: '#9bb0d3',
  },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,41,59,0.82)',
  },
  monthBtnText: { color: '#dbeafe', fontSize: 18, fontWeight: '800' },
  monthTitle: { fontSize: 18, fontWeight: '800', color: '#f0f5ff' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekCell: { width: '14.28%', textAlign: 'center', fontSize: 11, color: '#97add1', fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCellEmpty: { width: '14.28%', height: 54 },
  dayCell: {
    width: '14.28%',
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
    backgroundColor: 'rgba(30,41,59,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dayCellSelected: { borderColor: '#7dd3fc', backgroundColor: '#1f4c6c' },
  dayText: { color: '#dce8ff', fontWeight: '700', fontSize: 12 },
  dayTextSelected: { color: '#ffffff' },
  dotRow: { flexDirection: 'row', marginTop: 3, minHeight: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, marginHorizontal: 1.5 },
  timelineCard: {
    marginTop: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(15,23,42,0.76)',
    padding: 12,
  },
  timelineHeader: { fontSize: 16, fontWeight: '800', color: '#f1f6ff', marginBottom: 8 },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    backgroundColor: 'rgba(30,41,59,0.78)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  timelineIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  timelineContent: { flex: 1 },
  timelineTitle: { color: '#eef5ff', fontWeight: '800', fontSize: 13 },
  timelineMeta: { color: '#a7bce1', marginTop: 3, fontSize: 11, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 24,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  fabText: { color: '#ffffff', fontSize: 30, fontWeight: '700', lineHeight: 30 },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 15, 27, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 50,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(148,163,184,0.32)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#f8fafc',
  },
  sheetSubtitle: {
    marginTop: 4,
    color: 'rgba(148,163,184,0.72)',
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  sheetGhostBtn: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: 'rgba(30,41,59,0.72)',
  },
  sheetGhostText: {
    color: '#dbeafe',
    fontWeight: '800',
  },
  sheetPrimaryBtn: {
    width: '48%',
    borderRadius: 14,
    backgroundColor: '#2563eb',
    borderWidth: 1,
    borderColor: 'rgba(191,219,254,0.5)',
    paddingVertical: 13,
    alignItems: 'center',
  },
  sheetPrimaryText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
