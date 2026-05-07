import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '../config/api';
import { showAppAlert } from '../utils/appAlerts';
import { getAuthErrorMessage } from '../utils/authFeedback';

function GlassInput({ label, fadeDelay = 0, ...inputProps }) {
  const glow = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 500,
      delay: fadeDelay,
      useNativeDriver: true,
    }).start();
  }, []);

  const onFocus = () =>
    Animated.timing(glow, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  const onBlur = () =>
    Animated.timing(glow, { toValue: 0, duration: 200, useNativeDriver: false }).start();

  const borderColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(148, 163, 184, 0.18)', 'rgba(96, 165, 250, 0.55)'],
  });
  const bgColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(15, 23, 42, 0.52)', 'rgba(30, 41, 80, 0.62)'],
  });

  return (
    <Animated.View style={[styles.inputBlock, { opacity: fade }]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Animated.View style={[styles.inputWrap, { borderColor, backgroundColor: bgColor }]}>
        <TextInput
          style={styles.input}
          placeholderTextColor="rgba(148, 163, 184, 0.45)"
          onFocus={onFocus}
          onBlur={onBlur}
          {...inputProps}
        />
      </Animated.View>
    </Animated.View>
  );
}

function PrimaryBtn({ label, onPress, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (v) =>
    Animated.spring(scale, { toValue: v, speed: 28, bounciness: 5, useNativeDriver: true }).start();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => animateTo(0.97)}
      onPressOut={() => animateTo(1)}
      style={styles.primaryBtnPressable}
    >
      <Animated.View style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled, { transform: [{ scale }] }]}>
        <View style={styles.primaryBtnGradientA} />
        <View style={styles.primaryBtnGradientB} />
        <Text style={styles.primaryBtnText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cardFade = useRef(new Animated.Value(0)).current;
  const cardRise = useRef(new Animated.Value(30)).current;
  const logoFade = useRef(new Animated.Value(0)).current;
  const logoRise = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoFade, { toValue: 1, duration: 750, useNativeDriver: true }),
      Animated.timing(logoRise, { toValue: 0, duration: 750, useNativeDriver: true }),
      Animated.timing(cardFade, { toValue: 1, duration: 700, delay: 150, useNativeDriver: true }),
      Animated.timing(cardRise, { toValue: 0, duration: 700, delay: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTransparent: true,
      headerTitle: '',
      headerTintColor: '#bfdbfe',
    });
  }, [navigation]);

  const onSendOtp = async () => {
    try {
      setSubmitting(true);
      await apiRequest('/api/forgot-password', 'POST', { email });
      showAppAlert('OTP sent', 'Check your email for the OTP code.');
      navigation.navigate('OTPVerify', { email });
    } catch (err) {
      showAppAlert('Unable to send OTP', getAuthErrorMessage(err, 'Please try again in a moment.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Background orbs */}
      <View style={styles.backgroundLayer}>
        <View style={styles.orbTop} />
        <View style={styles.orbBottom} />
        <View style={styles.orbCenter} />
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inner}>
          {/* Logo */}
          <Animated.View
            style={[styles.logoWrap, { opacity: logoFade, transform: [{ translateY: logoRise }] }]}
          >
            <Text style={styles.logoText}>
              <Text style={styles.logoBlue}>Note</Text>
              <Text style={styles.logoPurple}>Kit</Text>
            </Text>
            <Text style={styles.logoTagline}>Password recovery</Text>
          </Animated.View>

          {/* Card */}
          <Animated.View
            style={[styles.card, { opacity: cardFade, transform: [{ translateY: cardRise }] }]}
          >
            <View style={styles.cardTopAccent} />

            <Text style={styles.cardTitle}>Forgot Password</Text>
            <Text style={styles.cardSubtitle}>
              Enter your email and we'll send you a one-time code.
            </Text>

            <GlassInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="done"
              autoCapitalize="none"
              onSubmitEditing={onSendOtp}
              fadeDelay={300}
            />

            <PrimaryBtn
              label={submitting ? 'Sending OTP…' : 'Send OTP'}
              onPress={onSendOtp}
              disabled={submitting}
            />
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  orbTop: {
    position: 'absolute',
    top: -80,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  orbBottom: {
    position: 'absolute',
    right: -80,
    bottom: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(139, 92, 246, 0.13)',
  },
  orbCenter: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
  },
  kav: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
  },

  // Logo
  logoWrap: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(96, 165, 250, 0.2)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  logoBlue: { color: '#bfdbfe' },
  logoPurple: { color: '#c4b5fd' },
  logoTagline: {
    marginTop: 6,
    color: 'rgba(226, 232, 240, 0.55)',
    fontSize: 13,
    letterSpacing: 0.4,
  },

  // Glass card
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.13)',
    padding: 24,
    shadowColor: '#020617',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
    overflow: 'hidden',
  },
  cardTopAccent: {
    position: 'absolute',
    top: 0,
    left: 40,
    right: 40,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.22)',
    borderRadius: 1,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: 'rgba(148, 163, 184, 0.65)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },

  // Inputs
  inputBlock: {
    marginBottom: 24,
  },
  inputLabel: {
    color: 'rgba(203, 213, 225, 0.75)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  inputWrap: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
    justifyContent: 'center',
  },
  input: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '500',
  },

  // Primary button
  primaryBtnPressable: {
    width: '100%',
  },
  primaryBtn: {
    height: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#2563eb',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  primaryBtnDisabled: {
    opacity: 0.55,
  },
  primaryBtnGradientA: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#2563eb',
    opacity: 0.96,
  },
  primaryBtnGradientB: {
    position: 'absolute',
    right: -18,
    top: -4,
    bottom: -4,
    width: '60%',
    borderRadius: 999,
    backgroundColor: '#8b5cf6',
    opacity: 0.9,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

// import React, { useState } from 'react';
// import { StyleSheet, Text, View } from 'react-native';
// import FormInput from '../components/FormInput';
// import KeyboardScreen from '../components/KeyboardScreen';
// import PrimaryButton from '../components/PrimaryButton';
// import { apiRequest } from '../config/api';
// import { showAppAlert } from '../utils/appAlerts';
// import { getAuthErrorMessage } from '../utils/authFeedback';

// export default function ForgotPasswordScreen({ navigation }) {
//   const [email, setEmail] = useState('');
//   const [submitting, setSubmitting] = useState(false);

//   const onSendOtp = async () => {
//     try {
//       setSubmitting(true);
//       await apiRequest('/api/forgot-password', 'POST', { email });
//       showAppAlert('OTP sent', 'Check your email for the OTP code.');
//       navigation.navigate('OTPVerify', { email });
//     } catch (err) {
//       showAppAlert('Unable to send OTP', getAuthErrorMessage(err, 'Please try again in a moment.'));
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <KeyboardScreen style={styles.container} contentContainerStyle={styles.content} centerContent>
//       <View style={styles.card}>
//         <Text style={styles.title}>Forget Password</Text>
//         <Text style={styles.subtitle}>Enter your email and weâ€™ll send you a one-time code.</Text>
//         <FormInput
//           label="Email"
//           value={email}
//           onChangeText={setEmail}
//           placeholder="you@example.com"
//           keyboardType="email-address"
//           autoComplete="email"
//           textContentType="emailAddress"
//           returnKeyType="done"
//           onSubmitEditing={onSendOtp}
//         />
//         <PrimaryButton title={submitting ? 'Sending OTP...' : 'Send OTP'} onPress={onSendOtp} disabled={submitting} />
//       </View>
//     </KeyboardScreen>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: 'center',
//     backgroundColor: '#f8fafc',
//   },
//   content: {
//     padding: 18,
//   },
//   card: {
//     backgroundColor: '#ffffff',
//     borderRadius: 18,
//     padding: 22,
//     borderWidth: 1,
//     borderColor: '#e2e8f0',
//   },
//   title: {
//     fontSize: 26,
//     fontWeight: '800',
//   },
//   subtitle: {
//     marginTop: 6,
//     marginBottom: 6,
//     color: '#64748b',
//     lineHeight: 20,
//   },
// });
