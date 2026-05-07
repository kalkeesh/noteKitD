import React, { useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import KeyboardScreen from '../components/KeyboardScreen';
import { showAppAlert } from '../utils/appAlerts';

const UPI_ID = '7702726236-3@ybl';
const PAYEE_NAME = 'NoteKit Dev';

function buildParams(amount, message) {
  const parts = [
    `pa=${encodeURIComponent(UPI_ID)}`,
    `pn=${encodeURIComponent(PAYEE_NAME)}`,
    'cu=INR',
    `tn=${encodeURIComponent(message || 'Support developer')}`,
  ];
  if (amount) {
    parts.push(`am=${encodeURIComponent(amount)}`);
  }
  return parts.join('&');
}

async function openPaymentLink(link) {
  try {
    const supported = await Linking.canOpenURL(link);
    if (!supported) {
      showAppAlert('UPI unavailable', 'No UPI app was found on this device.');
      return;
    }
    await Linking.openURL(link);
  } catch (err) {
    showAppAlert('Unable to open payment app', err.message);
  }
}

export default function SupportDevScreen({ navigation }) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');

  const params = useMemo(() => buildParams(amount.trim(), message.trim()), [amount, message]);

  const onPay = async () => {
    const finalAmount = (amount || '').trim();
    if (!finalAmount || Number(finalAmount) <= 0) {
      showAppAlert('Invalid amount', 'Enter a valid amount.');
      return;
    }
    await openPaymentLink(`upi://pay?${params}`);
  };

  return (
    <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <View style={styles.card}>
        <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Feather name="x" size={20} color="#e2e8f0" />
        </Pressable>

        <Image source={require('../theme/kalki_dev.jpeg')} style={styles.devImage} />

        <Text style={styles.title}>Support Dev</Text>
        <Text style={styles.description}>Your support helps keep this project alive!</Text>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Amount (Rs)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="Enter amount"
            placeholderTextColor="rgba(226,232,240,0.42)"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Message (Optional)</Text>
          <TextInput
            style={[styles.input, styles.messageInput]}
            multiline
            placeholder="Leave a kind message..."
            placeholderTextColor="rgba(226,232,240,0.42)"
            value={message}
            onChangeText={setMessage}
            textAlignVertical="top"
          />
        </View>

        <Pressable style={styles.payBtn} onPress={onPay}>
          <Feather name="heart" size={18} color="#ffffff" />
          <Text style={styles.payBtnText}>Pay via UPI</Text>
        </Pressable>

        <Text style={styles.footerText}>UPI ID: {UPI_ID}</Text>
      </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  glowTop: {
    position: 'absolute',
    top: 84,
    left: 24,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.08)',
  },
  glowBottom: {
    position: 'absolute',
    right: -20,
    bottom: 80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(217,70,239,0.12)',
  },
  card: {
    backgroundColor: 'rgba(30,41,59,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  devImage: {
    width: 82,
    height: 82,
    borderRadius: 24,
    alignSelf: 'center',
    marginTop: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  title: {
    textAlign: 'center',
    fontSize: 25,
    fontWeight: '800',
    color: '#f8fafc',
  },
  description: {
    marginTop: 10,
    textAlign: 'center',
    color: 'rgba(226,232,240,0.78)',
    fontSize: 14,
    lineHeight: 21,
  },
  fieldBlock: {
    marginTop: 22,
  },
  label: {
    marginBottom: 10,
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(148,163,184,0.16)',
    color: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  messageInput: {
    minHeight: 124,
    paddingTop: 14,
  },
  payBtn: {
    marginTop: 22,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#ec4899',
  },
  payBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  footerText: {
    marginTop: 16,
    textAlign: 'center',
    color: 'rgba(226,232,240,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
});
