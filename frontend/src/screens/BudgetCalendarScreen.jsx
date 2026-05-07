import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useBudgetify } from '../context/BudgetifyContext';
import { showAppAlert } from '../utils/appAlerts';

const EVENT_COLORS = {
  expense: '#2563eb',
  debt_due: '#d97706',
  debt_paid: '#16a34a',
  emi_paid: '#7c3aed',
  sip_paid: '#0891b2',
};

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
  for (let d = 1; d <= total; d += 1) {
    cells.push(d);
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

export default function BudgetCalendarScreen({ embedded = false }) {
  const { month, year, summary, setPeriod, refreshSummary } = useBudgetify();
  const now = useMemo(() => new Date(), []);
  const Container = embedded ? View : SafeAreaView;

  const [selectedDate, setSelectedDate] = useState(toIsoDate(now.toISOString()));
  const spends = summary?.spends || [];
  const debts = summary?.debts || [];
  const emis = summary?.emis || [];
  const sips = summary?.sips || [];

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

    spends.forEach((s) => {
      addEvent(s.date, {
        type: 'expense',
        title: `Expense: ${s.category || 'other'}`,
        amount: Number(s.amount || 0),
        color: EVENT_COLORS.expense,
      });
    });
    debts.forEach((d) => {
      addEvent(d.due_date, {
        type: 'debt_due',
        title: `Debt due: ${d.debt_name || 'Debt'}`,
        amount: Number(d.installment_amount || 0) || Number(d.amount || 0),
        color: EVENT_COLORS.debt_due,
      });
      if (d.status === 'paid' && d.paid_at) {
        addEvent(toIsoDate(d.paid_at), {
          type: 'debt_paid',
          title: `Debt paid: ${d.debt_name || 'Debt'}`,
          amount: Number(d.installment_amount || 0) || Number(d.amount || 0),
          color: EVENT_COLORS.debt_paid,
        });
      }
    });
    emis.forEach((e) => {
      Object.entries(e.monthly_status_dates || {}).forEach(([, paidOn]) => {
        const day = toIsoDate(paidOn);
        if (day.startsWith(`${year}-${String(month).padStart(2, '0')}`)) {
          addEvent(day, {
            type: 'emi_paid',
            title: `EMI paid: ${e.emi_name || 'EMI'}`,
            amount: Number(e.monthly_amount || 0),
            color: EVENT_COLORS.emi_paid,
          });
        }
      });
    });
    sips.forEach((s) => {
      Object.entries(s.monthly_status_dates || {}).forEach(([, paidOn]) => {
        const day = toIsoDate(paidOn);
        if (day.startsWith(`${year}-${String(month).padStart(2, '0')}`)) {
          addEvent(day, {
            type: 'sip_paid',
            title: `SIP paid: ${s.sip_name || 'SIP'}`,
            amount: Number(s.monthly_amount || 0),
            color: EVENT_COLORS.sip_paid,
          });
        }
      });
    });
    return map;
  }, [debts, emis, month, sips, spends, year]);

  useFocusEffect(
    useCallback(() => {
      refreshSummary(month, year).catch((err) => showAppAlert('Failed', err.message));
    }, [month, refreshSummary, year])
  );

  const calendarCells = useMemo(() => buildCalendarCells(month, year), [month, year]);
  const selectedEvents = eventsByDate[selectedDate] || [];

  const onPrevMonth = () => {
    if (month === 1) {
      setPeriod(12, year - 1);
      setSelectedDate(`${year - 1}-12-01`);
      return;
    }
    const newMonth = month - 1;
    setPeriod(newMonth, year);
    setSelectedDate(`${year}-${String(newMonth).padStart(2, '0')}-01`);
  };

  const onNextMonth = () => {
    if (month === 12) {
      setPeriod(1, year + 1);
      setSelectedDate(`${year + 1}-01-01`);
      return;
    }
    const newMonth = month + 1;
    setPeriod(newMonth, year);
    setSelectedDate(`${year}-${String(newMonth).padStart(2, '0')}-01`);
  };

  const dateKeyForDay = (day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <Container style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, embedded ? styles.contentEmbedded : null]}>
        {!embedded ? <Text style={styles.heading}>Budget Calendar</Text> : null}
        {!embedded ? <Text style={styles.subHeading}>Tap a date to view money activity.</Text> : null}

        <View style={styles.monthHeader}>
          <Pressable style={styles.monthBtn} onPress={onPrevMonth}>
            <Text style={styles.monthBtnText}>{'<'}</Text>
          </Pressable>
          <Text style={styles.monthTitle}>{monthName(month, year)}</Text>
          <Pressable style={styles.monthBtn} onPress={onNextMonth}>
            <Text style={styles.monthBtnText}>{'>'}</Text>
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
            <Text key={w} style={styles.weekCell}>{w}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {calendarCells.map((day, idx) => {
            if (!day) {
              return <View key={`empty-${idx}`} style={styles.dayCellEmpty} />;
            }
            const key = dateKeyForDay(day);
            const dayEvents = eventsByDate[key] || [];
            const uniqueTypes = [...new Set(dayEvents.map((x) => x.type))];
            const selected = key === selectedDate;
            return (
              <Pressable
                key={key}
                style={[styles.dayCell, selected ? styles.dayCellSelected : null]}
                onPress={() => setSelectedDate(key)}
              >
                <Text style={[styles.dayText, selected ? styles.dayTextSelected : null]}>{day}</Text>
                <View style={styles.dotRow}>
                  {uniqueTypes.slice(0, 3).map((type) => (
                    <View key={type} style={[styles.dot, { backgroundColor: EVENT_COLORS[type] }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Legend</Text>
          <View style={styles.legendWrap}>
            <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: EVENT_COLORS.expense }]} /><Text style={styles.legendText}>Expense</Text></View>
            <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: EVENT_COLORS.debt_due }]} /><Text style={styles.legendText}>Debt Due</Text></View>
            <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: EVENT_COLORS.debt_paid }]} /><Text style={styles.legendText}>Debt Paid</Text></View>
            <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: EVENT_COLORS.emi_paid }]} /><Text style={styles.legendText}>EMI Paid</Text></View>
            <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: EVENT_COLORS.sip_paid }]} /><Text style={styles.legendText}>SIP Paid</Text></View>
          </View>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{selectedDate}</Text>
          {selectedEvents.length === 0 ? <Text style={styles.empty}>No events for this date.</Text> : null}
          {selectedEvents.map((e, i) => (
            <View key={`${e.type}-${i}`} style={[styles.eventRow, { borderLeftColor: e.color }]}>
              <Text style={styles.eventName}>{e.title}</Text>
              <Text style={styles.eventAmount}>Rs {Number(e.amount || 0).toFixed(2)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  contentEmbedded: { paddingTop: 2, paddingBottom: 120 },
  heading: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  subHeading: { color: 'rgba(148,163,184,0.74)', marginTop: 3, marginBottom: 12 },
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
  monthBtnText: { color: '#dbeafe', fontWeight: '800', fontSize: 16 },
  monthTitle: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekCell: { width: '14.28%', textAlign: 'center', fontSize: 11, color: 'rgba(148,163,184,0.62)', fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCellEmpty: { width: '14.28%', height: 52 },
  dayCell: {
    width: '14.28%',
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
    backgroundColor: 'rgba(30,41,59,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dayCellSelected: { borderColor: 'rgba(191,219,254,0.46)', backgroundColor: 'rgba(37,99,235,0.72)' },
  dayText: { color: '#e2e8f0', fontWeight: '700', fontSize: 12 },
  dayTextSelected: { color: '#ffffff' },
  dotRow: { flexDirection: 'row', gap: 3, marginTop: 3, minHeight: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legendCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(15,23,42,0.78)',
    padding: 12,
  },
  legendTitle: { fontSize: 15, fontWeight: '800', color: '#f8fafc', marginBottom: 6 },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(30,41,59,0.78)',
  },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendText: { color: '#cbd5e1', fontWeight: '600', fontSize: 12 },
  detailCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(15,23,42,0.78)',
    padding: 12,
  },
  detailTitle: { fontSize: 15, fontWeight: '800', color: '#f8fafc', marginBottom: 8 },
  empty: { color: 'rgba(148,163,184,0.72)' },
  eventRow: {
    borderLeftWidth: 4,
    backgroundColor: 'rgba(30,41,59,0.78)',
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
  },
  eventName: { color: '#f8fafc', fontWeight: '700' },
  eventAmount: { color: 'rgba(148,163,184,0.72)', marginTop: 2, fontSize: 12 },
});
