import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import OTPVerifyScreen from './screens/OTPVerifyScreen';
import NewPasswordScreen from './screens/NewPasswordScreen';
import HomeScreen from './screens/HomeScreen';
import NoteKitScreen from './screens/NoteKitScreen';
import ProjectTasksScreen from './screens/ProjectTasksScreen';
import BudgetSetupScreen from './screens/BudgetSetupScreen';
import BudgetProfileScreen from './screens/BudgetProfileScreen';
import BudgetDashboard from './screens/BudgetDashboard';
import AddSpendScreen from './screens/AddSpendScreen';
import AddExpenseScreen from './screens/AddExpenseScreen';
import AddEmiScreen from './screens/AddEmiScreen';
import AddSipScreen from './screens/AddSipScreen';
import AddDebtScreen from './screens/AddDebtScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import BudgetCalendarScreen from './screens/BudgetCalendarScreen';
import SettingsScreen from './screens/SettingsScreen';
import SupportDevScreen from './screens/SupportDevScreen';
import GlobalSearchScreen from './screens/GlobalSearchScreen';
import SplashScreen from './screens/SplashScreen';
import { AuthContext } from './context/AuthContext';
import { BudgetifyProvider } from './context/BudgetifyContext';
import { clearSession, loadSession } from './config/sessionStorage';
import { configureNotificationsAsync } from './features/notifications/service';
import AIAssistantBubble from './features/assistant/components/AIAssistantBubble';
import AIAssistantModal from './features/assistant/components/AIAssistantModal';
import { ConfirmDialogHost, ToastHost } from './components/Toast';
import BackendStatusIndicator from './components/BackendStatusIndicator';
import {
  getPostLoginRoute,
  loadPrimaryApp,
  PRIMARY_APP_BUDGETIFY,
  PRIMARY_APP_TODOS,
} from './config/primaryAppStorage';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();
const budgetDetailScreenOptions = {
  headerStyle: { backgroundColor: '#090d16' },
  headerShadowVisible: false,
  headerTintColor: '#f8fafc',
  headerTitleStyle: { fontWeight: '800' },
  contentStyle: { backgroundColor: '#090d16' },
};

export default function App() {
  const [session, setSession] = useState(null);
  const [primaryApp, setPrimaryApp] = useState('notekit');
  const [booting, setBooting] = useState(true);
  const [minimumSplashComplete, setMinimumSplashComplete] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const [assistantVisible, setAssistantVisible] = useState(false);
  const [navigationReady, setNavigationReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const splashTimer = setTimeout(() => {
      if (mounted) {
        setMinimumSplashComplete(true);
      }
    }, 2600);
    (async () => {
      const [saved, preferredPrimaryApp] = await Promise.all([
        loadSession(),
        loadPrimaryApp(),
        configureNotificationsAsync().catch(() => false),
      ]);
      if (mounted) {
        setSession(saved);
        setPrimaryApp(preferredPrimaryApp);
        setBooting(false);
      }
    })();
    return () => {
      mounted = false;
      clearTimeout(splashTimer);
    };
  }, []);

  useEffect(() => {
    if (!booting && minimumSplashComplete) {
      setSplashVisible(false);
    }
  }, [booting, minimumSplashComplete]);

  const logout = useCallback(async () => {
    try {
      await clearSession();
    } catch (err) {
      console.warn('Session clear failed during logout:', err);
    } finally {
      setAssistantVisible(false);
      setSession(null);
      if (navigationReady && navigationRef.isReady()) {
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }
    }
  }, [navigationReady]);

  useEffect(() => {
    if (!navigationReady || booting || !navigationRef.isReady()) {
      return;
    }

    const targetRoute = session?.token ? getPostLoginRoute(primaryApp) : { name: 'Home' };
    navigationRef.resetRoot({
      index: 0,
      routes: [targetRoute],
    });
  }, [booting, navigationReady, primaryApp, session?.token]);

  const authContextValue = useMemo(
    () => ({ session, setSession, primaryApp, setPrimaryApp, logout }),
    [logout, primaryApp, session]
  );

  if (booting && !splashDismissed) {
    return (
      <SafeAreaView style={styles.bootWrap}>
        <SplashScreen onFadeComplete={() => setSplashDismissed(true)} />
        <BackendStatusIndicator />
      </SafeAreaView>
    );
  }

  const startRoute = session?.token ? getPostLoginRoute(primaryApp) : { name: 'Home' };

  return (
    <AuthContext.Provider value={authContextValue}>
      <BudgetifyProvider>
        <View style={styles.appShell}>
          <NavigationContainer ref={navigationRef} onReady={() => setNavigationReady(true)}>
            <Stack.Navigator
              initialRouteName={startRoute.name}
              screenOptions={{ headerTitleAlign: 'center' }}
            >
              <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{ title: 'Forget Password' }}
              />
              <Stack.Screen name="OTPVerify" component={OTPVerifyScreen} options={{ title: 'OTP Verify' }} />
              <Stack.Screen name="NewPassword" component={NewPasswordScreen} options={{ title: 'New Password' }} />
              <Stack.Screen
                name="NoteKit"
                component={NoteKitScreen}
                options={{ headerShown: false }}
                initialParams={{
                  initialTab:
                    primaryApp === PRIMARY_APP_TODOS
                      ? PRIMARY_APP_TODOS
                      : primaryApp === PRIMARY_APP_BUDGETIFY
                        ? PRIMARY_APP_BUDGETIFY
                        : 'notekit',
                }}
              />
              <Stack.Screen name="ProjectTasks" component={ProjectTasksScreen} options={{ title: 'Project Tasks' }} />
              <Stack.Screen
                name="BudgetDashboard"
                component={BudgetDashboard}
                options={{ headerShown: false }}
                initialParams={{
                  openedFromPrimary: primaryApp === PRIMARY_APP_BUDGETIFY,
                }}
              />
              <Stack.Screen name="BudgetSetup" component={BudgetSetupScreen} options={{ title: 'Budget Setup', ...budgetDetailScreenOptions }} />
              <Stack.Screen name="BudgetProfile" component={BudgetProfileScreen} options={{ title: 'Budget Profile', ...budgetDetailScreenOptions }} />
              <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Mandatory Expense', ...budgetDetailScreenOptions }} />
              <Stack.Screen name="AddEmi" component={AddEmiScreen} options={{ title: 'Add EMI', ...budgetDetailScreenOptions }} />
              <Stack.Screen name="AddSip" component={AddSipScreen} options={{ title: 'Add SIP', ...budgetDetailScreenOptions }} />
              <Stack.Screen name="AddDebt" component={AddDebtScreen} options={{ title: 'Add Debt', ...budgetDetailScreenOptions }} />
              <Stack.Screen name="AddSpend" component={AddSpendScreen} options={{ title: 'Expenses', ...budgetDetailScreenOptions }} />
              <Stack.Screen name="BudgetCalendar" component={BudgetCalendarScreen} options={{ title: 'Calendar', ...budgetDetailScreenOptions }} />
              <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Analytics', ...budgetDetailScreenOptions }} />
              <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
              <Stack.Screen name="SupportDev" component={SupportDevScreen} options={{ headerShown: false }} />
              <Stack.Screen name="GlobalSearch" component={GlobalSearchScreen} options={{ headerShown: false }} />
            </Stack.Navigator>
          </NavigationContainer>
          <ConfirmDialogHost />
          <ToastHost />
          <BackendStatusIndicator />
          {session?.token ? (
            <>
              <AIAssistantBubble onPress={() => setAssistantVisible(true)} />
              <AIAssistantModal
                visible={assistantVisible}
                onClose={() => setAssistantVisible(false)}
                onActionComplete={(response) => {
                  const resourceType = response?.resource_type || '';
                  if (!navigationRef.isReady()) {
                    return;
                  }
                  if (resourceType === 'note' || resourceType === 'todo') {
                    navigationRef.navigate('NoteKit');
                    return;
                  }
                  if (resourceType === 'spend' || resourceType === 'debt' || resourceType === 'emi') {
                    navigationRef.navigate('NoteKit', { initialTab: PRIMARY_APP_BUDGETIFY });
                  }
                }}
              />
            </>
          ) : null}
          {!splashDismissed ? (
            <SplashScreen visible={splashVisible} onFadeComplete={() => setSplashDismissed(true)} />
          ) : null}
        </View>
      </BudgetifyProvider>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  bootWrap: {
    flex: 1,
    backgroundColor: '#0b0f1a',
  },
  appShell: {
    flex: 1,
  },
});
