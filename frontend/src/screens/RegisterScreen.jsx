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
import { getAuthErrorMessage, validatePasswordStrength } from '../utils/authFeedback';
import { toast } from '../utils/toastService';

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

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
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

  const onRegister = async () => {
    const passwordMessage = validatePasswordStrength(password);
    if (passwordMessage) {
      showAppAlert('Weak password', passwordMessage);
      return;
    }
    try {
      setSubmitting(true);
      await apiRequest('/api/signup', 'POST', { name, email, phoneNumber, password });
      toast.success('Registration complete. Please sign in.');
      navigation.navigate('Login');
    } catch (err) {
      showAppAlert('Registration failed', getAuthErrorMessage(err, 'Unable to create your account right now.'));
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
            <Text style={styles.logoTagline}>Create your account</Text>
          </Animated.View>

          {/* Card */}
          <Animated.View
            style={[styles.card, { opacity: cardFade, transform: [{ translateY: cardRise }] }]}
          >
            <View style={styles.cardTopAccent} />

            <GlassInput
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              returnKeyType="next"
              fadeDelay={250}
            />
            <GlassInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              autoCapitalize="none"
              fadeDelay={330}
            />
            <GlassInput
              label="Phone Number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Phone number"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="next"
              fadeDelay={410}
            />
            <GlassInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={onRegister}
              fadeDelay={490}
            />

            <Text style={styles.passwordHint}>
              Use at least 8 characters with both letters and numbers.
            </Text>

            <PrimaryBtn
              label={submitting ? 'Creating account…' : 'Create Account'}
              onPress={onRegister}
              disabled={submitting}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable style={styles.loginRow} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginPrompt}>Already have an account? </Text>
              <Text style={styles.loginLink}>Sign in</Text>
            </Pressable>
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
    marginBottom: 28,
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

  // Inputs
  inputBlock: {
    marginBottom: 14,
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

  // Password hint
  passwordHint: {
    color: 'rgba(148, 163, 184, 0.5)',
    fontSize: 12,
    marginBottom: 20,
    marginTop: -4,
    lineHeight: 17,
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

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.14)',
  },
  dividerText: {
    color: 'rgba(148, 163, 184, 0.4)',
    fontSize: 12,
    marginHorizontal: 12,
    fontWeight: '500',
  },

  // Login row
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginPrompt: {
    color: 'rgba(148, 163, 184, 0.55)',
    fontSize: 14,
  },
  loginLink: {
    color: '#93c5fd',
    fontSize: 14,
    fontWeight: '700',
  },
});

// import React, { useState } from 'react';
// import { Pressable, StyleSheet, Text, View } from 'react-native';
// import FormInput from '../components/FormInput';
// import KeyboardScreen from '../components/KeyboardScreen';
// import PrimaryButton from '../components/PrimaryButton';
// import { apiRequest } from '../config/api';
// import { showAppAlert } from '../utils/appAlerts';
// import { getAuthErrorMessage, validatePasswordStrength } from '../utils/authFeedback';

// export default function RegisterScreen({ navigation }) {
//   const [name, setName] = useState('');
//   const [email, setEmail] = useState('');
//   const [phoneNumber, setPhoneNumber] = useState('');
//   const [password, setPassword] = useState('');
//   const [submitting, setSubmitting] = useState(false);

//   const onRegister = async () => {
//     const passwordMessage = validatePasswordStrength(password);
//     if (passwordMessage) {
//       showAppAlert('Weak password', passwordMessage);
//       return;
//     }

//     try {
//       setSubmitting(true);
//       await apiRequest('/api/signup', 'POST', { name, email, phoneNumber, password });
//       showAppAlert('Success', 'Registration complete. Please login.');
//       navigation.navigate('Login');
//     } catch (err) {
//       showAppAlert('Registration failed', getAuthErrorMessage(err, 'Unable to create your account right now.'));
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <KeyboardScreen style={styles.container} contentContainerStyle={styles.content} centerContent>
//       <View style={styles.card}>
//         <Text style={styles.title}>Register</Text>
//         <Text style={styles.subtitle}>Create your account to access notes, tasks, and Budgetify in one place.</Text>
//         <FormInput label="Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" returnKeyType="next" />
//         <FormInput
//           label="Email"
//           value={email}
//           onChangeText={setEmail}
//           placeholder="you@example.com"
//           keyboardType="email-address"
//           autoComplete="email"
//           textContentType="emailAddress"
//           returnKeyType="next"
//         />
//         <FormInput
//           label="Phone Number"
//           value={phoneNumber}
//           onChangeText={setPhoneNumber}
//           placeholder="Phone number"
//           keyboardType="phone-pad"
//           autoComplete="tel"
//           textContentType="telephoneNumber"
//           returnKeyType="next"
//         />
//         <FormInput
//           label="Password"
//           value={password}
//           onChangeText={setPassword}
//           placeholder="At least 8 characters"
//           secureTextEntry
//           autoComplete="new-password"
//           textContentType="newPassword"
//           returnKeyType="done"
//           onSubmitEditing={onRegister}
//         />
//         <Text style={styles.passwordHint}>Use at least 8 characters with both letters and numbers.</Text>
//         <PrimaryButton title={submitting ? 'Creating account...' : 'Create Account'} onPress={onRegister} disabled={submitting} />
//         <Pressable style={styles.linkButton} onPress={() => navigation.navigate('Login')}>
//           <Text style={styles.link}>Already have an account? Login</Text>
//         </Pressable>
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
//     shadowColor: '#0f172a',
//     shadowOpacity: 0.08,
//     shadowRadius: 18,
//     shadowOffset: { width: 0, height: 10 },
//     elevation: 4,
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
//   passwordHint: {
//     marginTop: 10,
//     color: '#64748b',
//     fontSize: 12,
//   },
//   link: {
//     color: '#0369a1',
//     fontWeight: '600',
//   },
//   linkButton: {
//     marginTop: 14,
//   },
// });
