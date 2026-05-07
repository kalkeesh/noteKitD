import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import AppDatePicker from '../components/AppDatePicker';
import DateStepper from '../components/DateStepper';
import FormInput from '../components/FormInput';
import KeyboardScreen from '../components/KeyboardScreen';
import MonthStepper from '../components/MonthStepper';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { useBudgetify } from '../context/BudgetifyContext';
import { addSpend, getSpends, getTodayBudget, updateSpend } from '../features/budgetify/api';
import { showAppAlert } from '../utils/appAlerts';

const SPEND_CATEGORIES = ['food', 'travel', 'shopping', 'bills', 'health', 'other'];

function statusColor(color) {
  if (color === 'red') {
    return '#dc2626';
  }
  if (color === 'yellow') {
    return '#d97706';
  }
  return '#16a34a';
}

function categoryBreakdown(items) {
  const totals = {};
  items.forEach((entry) => {
    const key = (entry.category || 'other').toLowerCase();
    totals[key] = (totals[key] || 0) + Number(entry.amount || 0);
  });
  const maxValue = Math.max(1, ...Object.values(totals));
  return Object.entries(totals).map(([category, total]) => ({
    category,
    total: Number(total.toFixed(2)),
    widthPct: Math.max(5, Math.round((total / maxValue) * 100)),
  }));
}

export default function AddSpendScreen() {
  const { session } = useAuth();
  const { refreshSummary } = useBudgetify();
  const token = session?.token || '';
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => today.toISOString().slice(0, 10), [today]);

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [date, setDate] = useState(todayIso);
  const [note, setNote] = useState('');
  const [editingSpendId, setEditingSpendId] = useState('');
  const [todayData, setTodayData] = useState(null);
  const [spends, setSpends] = useState([]);

  const [filterPeriod, setFilterPeriod] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadToday = useCallback(async () => {
    try {
      const data = await getTodayBudget(token);
      setTodayData(data);
    } catch {
      setTodayData(null);
    }
  }, [token]);

  const loadSpends = useCallback(async () => {
    try {
      const params = {};
      if (filterPeriod) {
        const [yearValue, monthValue] = filterPeriod.split('-');
        params.month = Number(monthValue);
        params.year = Number(yearValue);
      }
      if (dateFrom.trim()) {
        params.date_from = dateFrom.trim();
      }
      if (dateTo.trim()) {
        params.date_to = dateTo.trim();
      }
      const data = await getSpends(token, params);
      setSpends(Array.isArray(data) ? data : []);
    } catch (err) {
      showAppAlert('Load failed', err.message);
    }
  }, [dateFrom, dateTo, filterPeriod, token]);

  useFocusEffect(
    useCallback(() => {
      loadToday();
      loadSpends();
    }, [loadSpends, loadToday])
  );

  const resetForm = () => {
    setAmount('');
    setCategory('food');
    setDate(todayIso);
    setNote('');
    setEditingSpendId('');
  };

  const onSave = async () => {
    try {
      const payload = {
        amount: Number(amount || 0),
        category: category.trim() || 'other',
        note: note.trim(),
        date,
      };
      if (editingSpendId) {
        await updateSpend(editingSpendId, payload, token);
        showAppAlert('Updated', 'Expense updated.');
      } else {
        await addSpend(payload, token);
        showAppAlert('Saved', 'Daily expense logged.');
      }
      resetForm();
      await refreshSummary();
      await loadToday();
      await loadSpends();
    } catch (err) {
      showAppAlert('Save failed', err.message);
    }
  };

  const onEdit = (entry) => {
    setEditingSpendId(entry.id);
    setAmount(String(entry.amount ?? ''));
    setCategory(entry.category || 'other');
    setDate(entry.date || todayIso);
    setNote(entry.note || '');
  };

  const breakdown = categoryBreakdown(spends);
  const color = statusColor(todayData?.spend_status_color);

  return (
    <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
        <View style={[styles.infoCard, { borderColor: color }]}>
          <Text style={styles.infoTitle}>Today</Text>
          <Text style={styles.infoText}>Budget: Rs {todayData?.recommended_budget ?? 0}</Text>
          <Text style={styles.infoText}>Spent: Rs {todayData?.actual_spend ?? 0}</Text>
          <Text style={styles.infoText}>Left: Rs {todayData?.remaining_budget ?? 0}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{editingSpendId ? 'Edit Spend' : 'Quick Spend'}</Text>
          <FormInput theme="dark" compact label="Amount" value={amount} onChangeText={setAmount} placeholder="Amount" keyboardType="numeric" />
          <Text style={styles.label}>Category</Text>
          <View style={styles.chips}>
            {SPEND_CATEGORIES.map((item) => (
              <Text
                key={item}
                style={[styles.chip, category === item ? styles.chipActive : null]}
                onPress={() => setCategory(item)}
              >
                {item}
              </Text>
            ))}
          </View>
          <DateStepper theme="dark" label="Spend date" value={date} onChange={setDate} />
          <FormInput theme="dark" compact label="Note" value={note} onChangeText={setNote} placeholder="Note" />
          <PrimaryButton theme="dark" compact title={editingSpendId ? 'Update Spend' : 'Save Spend'} onPress={onSave} />
          {editingSpendId ? (
            <Pressable style={styles.cancelBtn} onPress={resetForm}>
              <Feather name="x" size={14} color="#cbd5e1" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Filters</Text>
          <MonthStepper theme="dark" label="Filter month" value={filterPeriod} onChange={setFilterPeriod} />
          <AppDatePicker theme="dark" label="Date from" value={dateFrom} onChange={setDateFrom} placeholder="Start date" />
          <AppDatePicker theme="dark" label="Date to" value={dateTo} onChange={setDateTo} placeholder="End date" />
          <PrimaryButton theme="dark" compact title="Apply Filters" onPress={loadSpends} />
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Expense Chart (Category)</Text>
          {breakdown.length === 0 ? <Text style={styles.emptyText}>No expense data for selected filters.</Text> : null}
          {breakdown.map((item) => (
            <View key={item.category} style={styles.chartRow}>
              <Text style={styles.chartLabel}>{item.category}</Text>
              <View style={styles.chartBarBg}>
                <View style={[styles.chartBarFill, { width: `${item.widthPct}%` }]} />
              </View>
              <Text style={styles.chartValue}>Rs {item.total}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Expense Table</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.colDate]}>Date</Text>
            <Text style={[styles.tableCell, styles.colCategory]}>Category</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>Amount</Text>
            <Text style={[styles.tableCell, styles.colAction]}>Action</Text>
          </View>
          {spends.length === 0 ? <Text style={styles.emptyText}>No expenses found.</Text> : null}
          {spends.map((entry) => (
            <View key={entry.id} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colDate]}>{entry.date}</Text>
              <Text style={[styles.tableCell, styles.colCategory]}>{entry.category}</Text>
              <Text style={[styles.tableCell, styles.colAmount]}>Rs {entry.amount}</Text>
              <View style={[styles.colAction, styles.actionWrap]}>
                <Pressable style={styles.iconActionBtn} onPress={() => onEdit(entry)}>
                  <Feather name="edit-3" size={14} color="#dbeafe" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'rgba(15,23,42,0.82)',
    padding: 14,
    marginBottom: 10,
  },
  infoTitle: { fontSize: 16, fontWeight: '800', color: '#f8fafc' },
  infoText: { marginTop: 4, color: 'rgba(148,163,184,0.76)' },
  card: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    padding: 14,
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#f8fafc', marginBottom: 8 },
  label: { marginTop: 12, color: 'rgba(148,163,184,0.78)', fontWeight: '600' },
  cancelBtn: {
    marginTop: 8,
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,41,59,0.72)',
  },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterCol: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#cbd5e1',
    overflow: 'hidden',
    backgroundColor: 'rgba(30,41,59,0.88)',
  },
  chipActive: {
    borderColor: 'rgba(96,165,250,0.45)',
    backgroundColor: 'rgba(37,99,235,0.16)',
    color: '#93c5fd',
  },
  chartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  chartLabel: { width: 90, color: '#cbd5e1', fontWeight: '600', fontSize: 12 },
  chartBarBg: { flex: 1, height: 12, borderRadius: 6, backgroundColor: 'rgba(51,65,85,0.88)', marginHorizontal: 8 },
  chartBarFill: { height: 12, borderRadius: 6, backgroundColor: '#2563eb' },
  chartValue: { width: 80, textAlign: 'right', color: '#f8fafc', fontWeight: '700', fontSize: 12 },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.14)',
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.08)',
    paddingVertical: 8,
  },
  tableCell: { color: '#cbd5e1', fontSize: 12 },
  colDate: { width: 90 },
  colCategory: { flex: 1, paddingRight: 8 },
  colAmount: { width: 90 },
  colAction: { width: 70, alignItems: 'flex-end' },
  actionWrap: { justifyContent: 'center' },
  iconActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(37,99,235,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: 'rgba(148,163,184,0.72)', fontSize: 12 },
});
