import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import DateStepper from '../components/DateStepper';
import FormInput from '../components/FormInput';
import KeyboardScreen from '../components/KeyboardScreen';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { useBudgetify } from '../context/BudgetifyContext';
import { addExpense } from '../features/budgetify/api';
import { showAppAlert } from '../utils/appAlerts';

const EXPENSE_CATEGORIES = ['rent', 'subscriptions', 'electricity', 'internet', 'insurance', 'other'];

export default function AddExpenseScreen() {
  const { session } = useAuth();
  const { refreshSummary } = useBudgetify();
  const token = session?.token || '';
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('rent');
  const [expenseDueDate, setExpenseDueDate] = useState(today);

  const onAddExpense = async () => {
    try {
      await addExpense(
        {
          expense_name: expenseName.trim(),
          amount: Number(expenseAmount || 0),
          category: expenseCategory,
          due_date: expenseDueDate,
          is_recurring: true,
        },
        token
      );
      setExpenseName('');
      setExpenseAmount('');
      await refreshSummary();
      showAppAlert('Added', 'Mandatory expense added.');
    } catch (err) {
      showAppAlert('Failed', err.message);
    }
  };

  return (
    <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Mandatory Expense</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly Bill</Text>
          <FormInput theme="dark" compact label="Expense name" value={expenseName} onChangeText={setExpenseName} placeholder="Expense name" />
          <FormInput theme="dark" compact label="Amount" value={expenseAmount} onChangeText={setExpenseAmount} placeholder="Amount" keyboardType="numeric" />
          <Text style={styles.label}>Category</Text>
          <View style={styles.chips}>
            {EXPENSE_CATEGORIES.map((item) => (
              <Text
                key={item}
                style={[styles.chip, expenseCategory === item ? styles.chipActive : null]}
                onPress={() => setExpenseCategory(item)}
              >
                {item}
              </Text>
            ))}
          </View>
          <DateStepper theme="dark" label="Due date" value={expenseDueDate} onChange={setExpenseDueDate} />
          <PrimaryButton theme="dark" compact title="Save Expense" onPress={onAddExpense} />
        </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },
  heading: { fontSize: 24, fontWeight: '800', color: '#f8fafc', marginBottom: 10 },
  label: { marginTop: 12, color: 'rgba(148,163,184,0.78)', fontWeight: '600' },
  card: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#f8fafc', marginBottom: 4 },
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
});
