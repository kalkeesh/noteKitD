import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import FormInput from '../components/FormInput';
import KeyboardScreen from '../components/KeyboardScreen';
import MonthStepper from '../components/MonthStepper';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { useBudgetify } from '../context/BudgetifyContext';
import { setupBudget } from '../features/budgetify/api';
import { showAppAlert } from '../utils/appAlerts';

export default function BudgetProfileScreen({ navigation }) {
  const { session } = useAuth();
  const { refreshSummary } = useBudgetify();
  const token = session?.token || '';
  const now = useMemo(() => new Date(), []);

  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [weekdayBudget, setWeekdayBudget] = useState('100');
  const [weekendBudget, setWeekendBudget] = useState('200');
  const [budgetMonth, setBudgetMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [savingsTarget, setSavingsTarget] = useState('0');
  const [foodBudget, setFoodBudget] = useState('0');
  const [travelBudget, setTravelBudget] = useState('0');
  const [shoppingBudget, setShoppingBudget] = useState('0');
  const [billsBudget, setBillsBudget] = useState('0');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!token) {
      showAppAlert('Login required', 'Please login first.');
      navigation.navigate('Login');
      return;
    }

    try {
      setSaving(true);
      const [year, month] = budgetMonth.split('-');
      await setupBudget(
        {
          monthly_income: Number(monthlyIncome || 0),
          weekday_budget_per_day: Number(weekdayBudget || 0),
          weekend_budget_per_day: Number(weekendBudget || 0),
          month: Number(month),
          year: Number(year),
          savings_target: Number(savingsTarget || 0),
          category_budgets: {
            food: Number(foodBudget || 0),
            travel: Number(travelBudget || 0),
            shopping: Number(shoppingBudget || 0),
            bills: Number(billsBudget || 0),
          },
        },
        token
      );
      await refreshSummary(Number(month), Number(year));
      showAppAlert('Saved', 'Budget profile updated.');
      navigation.goBack();
    } catch (err) {
      showAppAlert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Feather name="sliders" size={18} color="#dbeafe" />
        </View>
        <Text style={styles.eyebrow}>Budgetify Profile</Text>
        <Text style={styles.title}>Money Rules</Text>
        <Text style={styles.subtitle}>Set income, daily limits, and category caps with a tighter dark layout.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Feather name="wallet" size={15} color="#93c5fd" />
          </View>
          <Text style={styles.sectionLabel}>Core setup</Text>
        </View>
        <FormInput theme="dark" compact label="Monthly income" value={monthlyIncome} onChangeText={setMonthlyIncome} placeholder="Monthly income" keyboardType="numeric" />
        <View style={styles.twoCol}>
          <View style={styles.twoColItem}>
            <FormInput theme="dark" compact label="Weekday" value={weekdayBudget} onChangeText={setWeekdayBudget} placeholder="Daily weekday budget" keyboardType="numeric" />
          </View>
          <View style={styles.twoColItem}>
            <FormInput theme="dark" compact label="Weekend" value={weekendBudget} onChangeText={setWeekendBudget} placeholder="Daily weekend budget" keyboardType="numeric" />
          </View>
        </View>
        <View style={styles.twoCol}>
          <View style={styles.twoColItem}>
            <FormInput theme="dark" compact label="Savings target" value={savingsTarget} onChangeText={setSavingsTarget} placeholder="Savings target" keyboardType="numeric" />
          </View>
          <View style={styles.twoColItem}>
            <MonthStepper theme="dark" label="Month" value={budgetMonth} onChange={setBudgetMonth} />
          </View>
        </View>

        <View style={[styles.sectionHeader, styles.sectionHeaderTight]}>
          <View style={styles.sectionIcon}>
            <Feather name="pie-chart" size={15} color="#93c5fd" />
          </View>
          <Text style={styles.sectionLabel}>Category limits</Text>
        </View>
        <View style={styles.twoCol}>
          <View style={styles.twoColItem}>
            <FormInput theme="dark" compact label="Food" value={foodBudget} onChangeText={setFoodBudget} placeholder="Food budget" keyboardType="numeric" />
          </View>
          <View style={styles.twoColItem}>
            <FormInput theme="dark" compact label="Travel" value={travelBudget} onChangeText={setTravelBudget} placeholder="Travel budget" keyboardType="numeric" />
          </View>
        </View>
        <View style={styles.twoCol}>
          <View style={styles.twoColItem}>
            <FormInput theme="dark" compact label="Shopping" value={shoppingBudget} onChangeText={setShoppingBudget} placeholder="Shopping budget" keyboardType="numeric" />
          </View>
          <View style={styles.twoColItem}>
            <FormInput theme="dark" compact label="Bills" value={billsBudget} onChangeText={setBillsBudget} placeholder="Bills budget" keyboardType="numeric" />
          </View>
        </View>
        <PrimaryButton theme="dark" compact title={saving ? 'Saving...' : 'Save Setup'} onPress={onSave} />
      </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.18)',
    backgroundColor: 'rgba(15,23,42,0.82)',
    padding: 16,
    marginBottom: 12,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(37,99,235,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  eyebrow: {
    color: '#90d0ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    fontSize: 27,
    fontWeight: '900',
    color: '#f8fbff',
  },
  subtitle: {
    marginTop: 6,
    color: 'rgba(148,163,184,0.8)',
    lineHeight: 19,
  },
  card: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  sectionHeaderTight: {
    marginTop: 10,
  },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(37,99,235,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    color: '#dbeafe',
    fontWeight: '800',
    fontSize: 13,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  twoColItem: {
    flex: 1,
  },
});
