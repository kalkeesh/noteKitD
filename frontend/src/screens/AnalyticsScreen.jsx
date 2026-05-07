import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useBudgetify } from '../context/BudgetifyContext';
import { showAppAlert } from '../utils/appAlerts';

const CATEGORY_COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#ea580c', '#16a34a', '#dc2626', '#ca8a04', '#475569'];
const FOCUS_OPTIONS = [
  { key: 'liabilities', label: 'Liabilities' },
  { key: 'categories', label: 'Categories' },
  { key: 'weekly', label: 'Weekly' },
];

function MetricCard({ icon, label, value, bg, border, accent }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: bg, borderColor: border }]}>
      <View style={[styles.metricIcon, { backgroundColor: `${accent}20` }]}>
        <Text style={[styles.metricGlyph, { color: accent }]}>{icon}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function AnimatedBar({ progress, pct, color, style }) {
  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.max(4, pct)}%`],
  });

  return <Animated.View style={[style, { width, backgroundColor: color }]} />;
}

export default function AnalyticsScreen() {
  const { month, year, summary, refreshSummary } = useBudgetify();
  const [focusMode, setFocusMode] = useState('liabilities');
  const progress = useRef(new Animated.Value(0)).current;
  const report = summary?.report || null;

  useFocusEffect(
    useCallback(() => {
      refreshSummary(month, year).catch((err) => showAppAlert('Failed', err.message));
    }, [month, refreshSummary, year])
  );

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [progress, report, focusMode]);

  const categoryBars = useMemo(() => {
    const src = report?.expense_breakdown_by_category || {};
    const entries = Object.entries(src).map(([name, value]) => ({ name, value: Number(value || 0) }));
    const total = Math.max(1, entries.reduce((acc, item) => acc + item.value, 0));

    return entries
      .sort((a, b) => b.value - a.value)
      .map((item, index) => ({
        ...item,
        pct: (item.value / total) * 100,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }));
  }, [report]);

  const weeklyBars = useMemo(() => {
    const src = report?.weekly_spending_pattern || {};
    const entries = Object.entries(src).map(([week, value]) => ({ week, value: Number(value || 0) }));
    const max = Math.max(1, ...entries.map((item) => item.value));

    return entries.map((item, index) => ({
      ...item,
      pct: (item.value / max) * 100,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }));
  }, [report]);

  const liabilityBars = useMemo(
    () => [
      { label: 'EMI Ratio', value: Number(report?.EMI_ratio || 0), color: '#7c3aed' },
      { label: 'SIP Ratio', value: Number(report?.SIP_ratio || 0), color: '#0891b2' },
      { label: 'Debt Ratio', value: Number(report?.debt_ratio || 0), color: '#ea580c' },
    ],
    [report]
  );

  const healthColor = useMemo(() => {
    const score = Number(report?.budget_health_score || 0);
    if (score >= 75) {
      return '#16a34a';
    }
    if (score >= 50) {
      return '#d97706';
    }
    return '#dc2626';
  }, [report]);

  const healthWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.max(0, Math.min(100, Number(report?.budget_health_score || 0)))}%`],
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Budgetify</Text>
          <Text style={styles.heading}>Analytics</Text>
          <Text style={styles.subHeading}>Compact view for spend, savings, and liabilities.</Text>
        </View>

        <View style={styles.grid}>
          <MetricCard label="Total Spent" value={`Rs ${report?.total_spent ?? 0}`} icon="SP" bg="rgba(37,99,235,0.14)" border="rgba(96,165,250,0.18)" accent="#60a5fa" />
          <MetricCard label="Total Saved" value={`Rs ${report?.total_saved ?? 0}`} icon="SV" bg="rgba(16,185,129,0.14)" border="rgba(52,211,153,0.18)" accent="#34d399" />
          <MetricCard label="Avg Daily Spend" value={`Rs ${report?.average_daily_spend ?? 0}`} icon="DY" bg="rgba(245,158,11,0.14)" border="rgba(251,191,36,0.18)" accent="#fbbf24" />
          <MetricCard label="Savings Rate" value={`${report?.savings_rate ?? 0}%`} icon="RT" bg="rgba(124,58,237,0.14)" border="rgba(167,139,250,0.18)" accent="#a78bfa" />
        </View>

        <View style={styles.healthCard}>
          <View style={styles.healthHeader}>
            <View>
              <Text style={styles.healthLabel}>Budget Health Score</Text>
              <Text style={[styles.healthValue, { color: healthColor }]}>{report?.budget_health_score ?? 0} / 100</Text>
            </View>
            <View style={[styles.healthBadge, { backgroundColor: `${healthColor}20` }]}>
              <Text style={[styles.healthGlyph, { color: healthColor }]}>OK</Text>
            </View>
          </View>
          <View style={styles.healthTrack}>
            <Animated.View style={[styles.healthFill, { width: healthWidth, backgroundColor: healthColor }]} />
          </View>
        </View>

        <View style={styles.switchRow}>
          {FOCUS_OPTIONS.map((option) => (
            <Pressable
              key={option.key}
              style={[styles.switchChip, focusMode === option.key ? styles.switchChipActive : null]}
              onPress={() => setFocusMode(option.key)}
            >
              <Text style={[styles.switchText, focusMode === option.key ? styles.switchTextActive : null]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {focusMode === 'liabilities' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Liability Ratios</Text>
            {liabilityBars.map((item) => (
              <View key={item.label} style={styles.barBlock}>
                <View style={styles.barHead}>
                  <Text style={styles.barLabel}>{item.label}</Text>
                  <Text style={styles.barValue}>{item.value.toFixed(1)}%</Text>
                </View>
                <View style={styles.track}>
                  <AnimatedBar progress={progress} pct={item.value} color={item.color} style={styles.fill} />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {focusMode === 'categories' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Expense Category Distribution</Text>
            {categoryBars.length === 0 ? <Text style={styles.empty}>No category data.</Text> : null}
            {categoryBars.map((item) => (
              <View key={item.name} style={styles.barBlock}>
                <View style={styles.barHead}>
                  <View style={styles.categoryHead}>
                    <View style={[styles.catDot, { backgroundColor: item.color }]} />
                    <Text style={styles.barLabel}>{item.name}</Text>
                  </View>
                  <Text style={styles.barValue}>Rs {item.value.toFixed(2)}</Text>
                </View>
                <View style={styles.track}>
                  <AnimatedBar progress={progress} pct={item.pct} color={item.color} style={styles.fill} />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {focusMode === 'weekly' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Weekly Spending Trend</Text>
            {weeklyBars.length === 0 ? <Text style={styles.empty}>No weekly data.</Text> : null}
            {weeklyBars.map((item) => (
              <View key={item.week} style={styles.barBlock}>
                <View style={styles.barHead}>
                  <Text style={styles.barLabel}>{item.week}</Text>
                  <Text style={styles.barValue}>Rs {item.value.toFixed(2)}</Text>
                </View>
                <View style={styles.track}>
                  <AnimatedBar progress={progress} pct={item.pct} color={item.color} style={styles.fill} />
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  hero: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.18)',
    backgroundColor: 'rgba(15,23,42,0.82)',
    padding: 16,
    marginBottom: 12,
  },
  heroEyebrow: {
    color: '#90d0ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heading: { marginTop: 6, fontSize: 28, fontWeight: '900', color: '#f8fbff' },
  subHeading: { marginTop: 6, color: 'rgba(148,163,184,0.8)', lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  metricCard: {
    width: '48.5%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricGlyph: { fontSize: 11, fontWeight: '900' },
  metricValue: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  metricLabel: { color: 'rgba(148,163,184,0.72)', marginTop: 4, fontWeight: '600', fontSize: 12 },
  healthCard: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    padding: 14,
    marginBottom: 12,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthLabel: { color: '#dbeafe', fontWeight: '700' },
  healthValue: { fontSize: 28, fontWeight: '900', marginTop: 4 },
  healthBadge: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthGlyph: { fontSize: 12, fontWeight: '900' },
  healthTrack: {
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(51,65,85,0.88)',
    overflow: 'hidden',
    marginTop: 10,
  },
  healthFill: { height: 14, borderRadius: 7 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  switchChip: {
    width: '32%',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(30,41,59,0.84)',
  },
  switchChipActive: {
    backgroundColor: '#2563eb',
  },
  switchText: {
    color: '#94a3b8',
    fontWeight: '800',
    fontSize: 12,
  },
  switchTextActive: {
    color: '#ffffff',
  },
  card: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: '900', color: '#f8fafc', marginBottom: 10 },
  barBlock: { marginBottom: 12 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  categoryHead: { flexDirection: 'row', alignItems: 'center' },
  catDot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  barLabel: { color: '#cbd5e1', fontWeight: '700' },
  barValue: { color: '#f8fafc', fontWeight: '800' },
  track: { height: 12, borderRadius: 6, backgroundColor: 'rgba(51,65,85,0.88)', overflow: 'hidden' },
  fill: { height: 12, borderRadius: 6 },
  empty: { color: 'rgba(148,163,184,0.72)' },
});
