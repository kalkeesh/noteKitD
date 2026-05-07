import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import KeyboardScreen from '../components/KeyboardScreen';

const SETUP_ACTIONS = [
  {
    key: 'profile',
    title: 'Budget Profile',
    subtitle: 'Income, daily budget, savings target',
    icon: 'tune-variant',
    color: '#0f4c81',
    bg: '#ddecff',
    route: 'BudgetProfile',
  },
  {
    key: 'expense',
    title: 'Mandatory Expense',
    subtitle: 'Rent, subscriptions, bills, insurance',
    icon: 'file-document-edit-outline',
    color: '#8b3d16',
    bg: '#ffe5d4',
    route: 'AddExpense',
  },
  {
    key: 'sip',
    title: 'SIP Tracker',
    subtitle: 'Manage SIP plans and mark paid months',
    icon: 'chart-timeline-variant',
    color: '#0c6b58',
    bg: '#ddfff4',
    route: 'AddSip',
  },
  {
    key: 'emi',
    title: 'EMI Tracker',
    subtitle: 'Track monthly EMI obligations and payment history',
    icon: 'tune-variant',
    color: '#7c3aed',
    bg: '#efe2ff',
    route: 'AddEmi',
  },
  {
    key: 'debt',
    title: 'Debt Tracker',
    subtitle: 'Manage due dates, installments, and debt payments',
    icon: 'file-document-edit-outline',
    color: '#b45309',
    bg: '#ffedd5',
    route: 'AddDebt',
  },
];

function iconGlyph(icon) {
  if (icon === 'tune-variant') {
    return 'sliders';
  }
  if (icon === 'file-document-edit-outline') {
    return 'file-text';
  }
  if (icon === 'chart-timeline-variant') {
    return 'activity';
  }
  return 'circle';
}

export default function BudgetSetupScreen({ navigation }) {
  return (
    <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Budgetify</Text>
        <Text style={styles.heroTitle}>Setup Hub</Text>
        <Text style={styles.heroText}>Start with profile, then bills, SIP, EMI, and debt.</Text>
      </View>

      {SETUP_ACTIONS.map((action) => (
        <Pressable
          key={action.key}
          style={styles.actionCard}
          onPress={() => navigation.navigate(action.route)}
        >
          <View style={[styles.iconWrap, { backgroundColor: action.bg }]}>
            <Feather name={iconGlyph(action.icon)} size={18} color={action.color} />
          </View>
          <View style={styles.actionBody}>
            <Text style={styles.actionTitle}>{action.title}</Text>
            <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
          </View>
          <Feather name="chevron-right" size={18} color="rgba(148,163,184,0.72)" />
        </Pressable>
      ))}
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 26 },
  hero: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.18)',
    backgroundColor: 'rgba(15,23,42,0.82)',
    padding: 16,
    marginBottom: 12,
  },
  heroEyebrow: {
    color: '#91d8ff',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: { marginTop: 6, fontSize: 26, fontWeight: '900', color: '#f8fbff' },
  heroText: { marginTop: 8, color: 'rgba(148,163,184,0.8)', lineHeight: 19 },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(15,23,42,0.78)',
    padding: 13,
    marginBottom: 10,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionBody: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  actionSubtitle: {
    marginTop: 3,
    color: 'rgba(148,163,184,0.72)',
    lineHeight: 17,
    fontSize: 12,
  },
});
