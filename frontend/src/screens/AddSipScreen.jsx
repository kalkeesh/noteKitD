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
import { addSip, getSip, setSipMonthlyStatus } from '../features/budgetify/api';
import { showAppAlert } from '../utils/appAlerts';

export default function AddSipScreen() {
  const { session } = useAuth();
  const { refreshSummary } = useBudgetify();
  const token = session?.token || '';
  const now = useMemo(() => new Date(), []);
  const currentMonth = useMemo(
    () => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    [now]
  );

  const [sipName, setSipName] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [details, setDetails] = useState('');
  const [items, setItems] = useState([]);
  const [historyMonthById, setHistoryMonthById] = useState({});

  const load = useCallback(async () => {
    try {
      const data = await getSip(token, now.getMonth() + 1, now.getFullYear());
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
    try {
      await addSip(
        {
          sip_name: sipName.trim(),
          monthly_amount: Number(monthlyAmount || 0),
          details: details.trim(),
        },
        token
      );
      setSipName('');
      setMonthlyAmount('');
      setDetails('');
      await load();
      await refreshSummary();
      showAppAlert('Added', 'SIP added.');
    } catch (err) {
      showAppAlert('Add failed', err.message);
    }
  };

  const setStatus = async (id, month, paid) => {
    try {
      const paidOn = paid ? (month === currentMonth ? now.toISOString().slice(0, 10) : `${month}-01`) : undefined;
      await setSipMonthlyStatus(id, { month, paid, paid_on: paidOn }, token);
      await load();
      await refreshSummary();
    } catch (err) {
      showAppAlert('Status update failed', err.message);
    }
  };

  const updateHistoryMonth = (id, value) => {
    setHistoryMonthById((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>SIP Setup</Text>
        <Text style={styles.helper}>
          SIP is reserved from the monthly budget automatically. Paid status is only for tracking.
        </Text>
        <View style={styles.card}>
          <FormInput theme="dark" compact value={sipName} onChangeText={setSipName} placeholder="SIP name" />
          <FormInput theme="dark" compact value={monthlyAmount} onChangeText={setMonthlyAmount} placeholder="Monthly amount" keyboardType="numeric" />
          <FormInput theme="dark" compact value={details} onChangeText={setDetails} placeholder="Details (optional)" />
          <PrimaryButton theme="dark" compact title="Add SIP" onPress={onAdd} />
        </View>

        <Text style={styles.subTitle}>Active SIP Plans</Text>
        {items.length === 0 ? <Text style={styles.empty}>No SIP plans found.</Text> : null}
        {items.map((sip) => {
          const historyMonth = historyMonthById[sip.id] || '';
          return (
            <View key={sip.id} style={styles.row}>
              <Text style={styles.name}>{sip.sip_name}</Text>
              <Text style={styles.meta}>Monthly: Rs {sip.monthly_amount}</Text>
              <Text style={styles.meta}>
                {currentMonth} status: {sip.current_month_paid ? 'Paid' : 'Pending'}
              </Text>
              {sip.details ? <Text style={styles.meta}>Details: {sip.details}</Text> : null}

              <View style={styles.rowActions}>
                <Pressable style={[styles.iconBtn, styles.paidBtn]} onPress={() => setStatus(sip.id, currentMonth, true)}>
                  <Feather name="check" size={15} color="#ffffff" />
                </Pressable>
                <Pressable style={[styles.iconBtn, styles.unpaidBtn]} onPress={() => setStatus(sip.id, currentMonth, false)}>
                  <Feather name="x" size={15} color="#ffffff" />
                </Pressable>
              </View>

              <MonthStepper
                theme="dark"
                label="Previous paid month"
                value={historyMonth || currentMonth}
                onChange={(value) => updateHistoryMonth(sip.id, value)}
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
                    setStatus(sip.id, month, true);
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
});
