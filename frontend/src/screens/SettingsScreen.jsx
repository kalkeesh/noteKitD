import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import {
  getApiBaseUrl,
  getBudgetifyApiBaseUrl,
  getDefaultApiBaseUrl,
  getDefaultBudgetifyApiBaseUrl,
  normalizeSavedBudgetifyApiBaseUrl,
  normalizeSavedCoreApiBaseUrl,
  setApiBaseUrl,
  setBudgetifyApiBaseUrl,
} from '../config/appConfig';
import {
  loadSavedApiBaseUrl,
  loadSavedBudgetifyApiBaseUrl,
  saveApiBaseUrl,
  saveBudgetifyApiBaseUrl,
} from '../config/apiBaseUrlStorage';
import { loadSavedAiProvider, saveAiProvider } from '../config/aiProviderStorage';
import {
  NOTIFICATION_THEMES,
  loadSavedNotificationTheme,
  saveNotificationTheme,
} from '../config/notificationThemeStorage';
import KeyboardScreen from '../components/KeyboardScreen';
import { showAppAlert } from '../utils/appAlerts';
import { setToastNotificationTheme, toast } from '../utils/toastService';

const AI_PASSWORD = '8989';
const SETTINGS_ACTIONS = [
  {
    key: 'base-url',
    title: 'Base URL',
    description: 'Update the backend address used by the app.',
    icon: 'wifi',
  },
  {
    key: 'ai-assistant',
    title: 'AI Assistant',
    description: 'Choose the provider used for DUDE! requests.',
    icon: 'cpu',
  },
  {
    key: 'notifications',
    title: 'Notifications',
    description: 'Choose how app alerts should look.',
    icon: 'bell',
  },
  {
    key: 'about-app',
    title: 'About App',
    description: 'See what Notes, Tasks, Budgetify, and AI can do.',
    icon: 'info',
  },
];

export default function SettingsScreen({ navigation }) {
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState(getApiBaseUrl());
  const [budgetifyApiBaseUrlInput, setBudgetifyApiBaseUrlInput] = useState(getBudgetifyApiBaseUrl());
  const [savedBaseUrl, setSavedBaseUrl] = useState(getApiBaseUrl());
  const [savedBudgetifyBaseUrl, setSavedBudgetifyBaseUrl] = useState(getBudgetifyApiBaseUrl());
  const [selectedAiProvider, setSelectedAiProvider] = useState('gemini');
  const [selectedNotificationTheme, setSelectedNotificationTheme] = useState('midnight');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [saving, setSaving] = useState(false);
  const [baseUrlModalVisible, setBaseUrlModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [aiConfigModalVisible, setAiConfigModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [saved, savedBudgetify, savedProvider, savedNotificationTheme] = await Promise.all([
        loadSavedApiBaseUrl(),
        loadSavedBudgetifyApiBaseUrl(),
        loadSavedAiProvider(),
        loadSavedNotificationTheme(),
      ]);
      if (mounted) {
        if (saved) {
          const normalizedSaved = normalizeSavedCoreApiBaseUrl(saved);
          setApiBaseUrl(normalizedSaved);
          setApiBaseUrlInput(normalizedSaved);
          setSavedBaseUrl(normalizedSaved);
          if (normalizedSaved !== saved) {
            await saveApiBaseUrl(normalizedSaved);
          }
        } else {
          const fallback = getApiBaseUrl();
          setApiBaseUrl(fallback);
          setApiBaseUrlInput(fallback);
          setSavedBaseUrl(fallback);
        }
        if (savedBudgetify) {
          const normalizedSavedBudgetify = normalizeSavedBudgetifyApiBaseUrl(savedBudgetify);
          setBudgetifyApiBaseUrl(normalizedSavedBudgetify);
          setBudgetifyApiBaseUrlInput(normalizedSavedBudgetify);
          setSavedBudgetifyBaseUrl(normalizedSavedBudgetify);
          if (normalizedSavedBudgetify !== savedBudgetify) {
            await saveBudgetifyApiBaseUrl(normalizedSavedBudgetify);
          }
        } else {
          const fallback = getBudgetifyApiBaseUrl();
          setBudgetifyApiBaseUrl(fallback);
          setBudgetifyApiBaseUrlInput(fallback);
          setSavedBudgetifyBaseUrl(fallback);
        }
        setSelectedAiProvider(savedProvider);
        setSelectedNotificationTheme(savedNotificationTheme);
        setToastNotificationTheme(savedNotificationTheme);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onSave = async () => {
    const nextUrl = normalizeSavedCoreApiBaseUrl(apiBaseUrlInput);
    if (!/^https?:\/\//i.test(nextUrl)) {
      showAppAlert('Invalid URL', 'Core API link must start with http:// or https://');
      return;
    }
    const nextBudgetifyUrl = normalizeSavedBudgetifyApiBaseUrl(budgetifyApiBaseUrlInput);
    if (!/^https?:\/\//i.test(nextBudgetifyUrl)) {
      showAppAlert('Invalid URL', 'Budgetify API link must start with http:// or https://');
      return;
    }

    try {
      setSaving(true);
      setApiBaseUrl(nextUrl);
      setBudgetifyApiBaseUrl(nextBudgetifyUrl);
      await saveApiBaseUrl(nextUrl);
      await saveBudgetifyApiBaseUrl(nextBudgetifyUrl);
      setSavedBaseUrl(nextUrl);
      setSavedBudgetifyBaseUrl(nextBudgetifyUrl);
      setBaseUrlModalVisible(false);
      showAppAlert('Saved', 'API links updated.');
    } catch (err) {
      showAppAlert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const onUseDefault = async () => {
    const fallback = getDefaultApiBaseUrl();
    const budgetifyFallback = getDefaultBudgetifyApiBaseUrl();
    setApiBaseUrl(fallback);
    setBudgetifyApiBaseUrl(budgetifyFallback);
    setApiBaseUrlInput(fallback);
    setBudgetifyApiBaseUrlInput(budgetifyFallback);
    await saveApiBaseUrl(fallback);
    await saveBudgetifyApiBaseUrl(budgetifyFallback);
    setSavedBaseUrl(fallback);
    setSavedBudgetifyBaseUrl(budgetifyFallback);
  };

  const openBaseUrlModal = () => {
    setApiBaseUrlInput(savedBaseUrl || getApiBaseUrl());
    setBudgetifyApiBaseUrlInput(savedBudgetifyBaseUrl || getBudgetifyApiBaseUrl());
    setBaseUrlModalVisible(true);
  };

  const openAiPasswordModal = () => {
    setPasswordInput('');
    setPasswordError('');
    setPasswordModalVisible(true);
  };

  const onSubmitAiPassword = () => {
    if (passwordInput.trim() !== AI_PASSWORD) {
      setPasswordError('Incorrect password. Please try again.');
      return;
    }
    setPasswordError('');
    setPasswordInput('');
    setPasswordModalVisible(false);
    setAiConfigModalVisible(true);
  };

  const onSaveAiProvider = async (provider) => {
    const nextProvider = provider === 'groq' ? 'groq' : 'gemini';
    setSelectedAiProvider(nextProvider);
    await saveAiProvider(nextProvider);
    setAiConfigModalVisible(false);
    showAppAlert('Saved', `AI provider set to ${nextProvider === 'groq' ? 'Groq' : 'Gemini'}.`);
  };

  const onSaveNotificationTheme = async (theme) => {
    const nextTheme = await saveNotificationTheme(theme);
    setSelectedNotificationTheme(nextTheme);
    setToastNotificationTheme(nextTheme);
    showAppAlert('Saved', `${getNotificationThemeTitle(nextTheme)} notifications selected.`);
  };

  const onTestNotificationTheme = () => {
    setToastNotificationTheme(selectedNotificationTheme);
    toast.info('This is how NoteKit notifications will look.', { duration: 3200 });
  };

  const onPressSettingsAction = (key) => {
    if (key === 'base-url') {
      openBaseUrlModal();
      return;
    }
    if (key === 'ai-assistant') {
      openAiPasswordModal();
      return;
    }
    if (key === 'notifications') {
      setNotificationModalVisible(true);
      return;
    }
    setAboutModalVisible(true);
  };

  return (
    <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.navigate('NoteKit', { initialTab: 'notes' })}
        >
          <Feather name="chevron-left" size={18} color="#e2e8f0" />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Connection, AI, and app controls.</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>DEVICE SETTINGS</Text>
        <Text style={styles.heroTitle}>Control Center</Text>
        <Text style={styles.heroCaption}>Everything important in one clean place.</Text>
      </View>

      <View style={styles.settingsGroup}>
        <Text style={styles.groupLabel}>Preferences</Text>
        {SETTINGS_ACTIONS.map((item) => (
          <Pressable key={item.key} style={styles.actionCard} onPress={() => onPressSettingsAction(item.key)}>
            <View style={styles.actionIconWrap}>
              <Feather name={item.icon} size={17} color="#93c5fd" />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>{item.title}</Text>
              <Text style={styles.actionDescription}>{item.description}</Text>
              {item.key === 'base-url' ? (
                <Text style={styles.actionMeta}>Core: {savedBaseUrl || getApiBaseUrl()}</Text>
              ) : null}
              {item.key === 'base-url' ? (
                <Text style={styles.actionMeta}>Budgetify: {savedBudgetifyBaseUrl || getBudgetifyApiBaseUrl()}</Text>
              ) : null}
              {item.key === 'ai-assistant' ? (
                <Text style={styles.actionMeta}>
                  Current: {selectedAiProvider === 'groq' ? 'Groq' : 'Gemini'}
                </Text>
              ) : null}
              {item.key === 'notifications' ? (
                <Text style={styles.actionMeta}>Current: {getNotificationThemeTitle(selectedNotificationTheme)}</Text>
              ) : null}
            </View>
            <Feather name="chevron-right" size={18} color="rgba(148,163,184,0.7)" />
          </Pressable>
        ))}
      </View>

      <Modal
        visible={baseUrlModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBaseUrlModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Base URL</Text>
            <Text style={styles.modalDescription}>Update the backend addresses used by the app.</Text>
            <Text style={styles.inputLabel}>Core Backend</Text>
            <TextInput
              style={styles.input}
              placeholder="https://your-core-api-domain.com"
              placeholderTextColor="#9ca3af"
              value={apiBaseUrlInput}
              onChangeText={setApiBaseUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>Detected default: {getDefaultApiBaseUrl()}</Text>
            <Text style={styles.inputLabel}>Budgetify Backend</Text>
            <TextInput
              style={styles.input}
              placeholder="https://your-budgetify-api-domain.com"
              placeholderTextColor="#9ca3af"
              value={budgetifyApiBaseUrlInput}
              onChangeText={setBudgetifyApiBaseUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>Detected default: {getDefaultBudgetifyApiBaseUrl()}</Text>

            <Pressable style={styles.secondaryBtn} onPress={onUseDefault}>
              <Feather name="rotate-ccw" size={14} color="#dbeafe" />
              <Text style={styles.secondaryBtnText}>Use Default</Text>
            </Pressable>
            <View style={styles.modalActionRow}>
              <Pressable style={styles.iconGhostBtn} onPress={() => setBaseUrlModalVisible(false)}>
                <Feather name="x" size={16} color="#e2e8f0" />
              </Pressable>
              <Pressable style={styles.iconPrimaryBtn} onPress={onSave} disabled={saving}>
                <Feather name={saving ? 'loader' : 'check'} size={16} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>AI Assistant</Text>
            <Text style={styles.modalDescription}>Enter the frontend password to edit AI provider settings.</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor="#9ca3af"
              value={passwordInput}
              onChangeText={(value) => {
                setPasswordInput(value);
                if (passwordError) {
                  setPasswordError('');
                }
              }}
              secureTextEntry
            />
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            <View style={styles.modalActionRow}>
              <Pressable style={styles.iconGhostBtn} onPress={() => setPasswordModalVisible(false)}>
                <Feather name="x" size={16} color="#e2e8f0" />
              </Pressable>
              <Pressable style={styles.iconPrimaryBtn} onPress={onSubmitAiPassword}>
                <Feather name="check" size={16} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={aiConfigModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAiConfigModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>AI Provider</Text>
            <Text style={styles.modalDescription}>Choose which AI provider NoteKit should prefer.</Text>
            {['gemini', 'groq'].map((provider) => {
              const selected = selectedAiProvider === provider;
              return (
                <Pressable
                  key={provider}
                  style={[styles.providerOption, selected ? styles.providerOptionActive : null]}
                  onPress={() => setSelectedAiProvider(provider)}
                >
                  <View style={[styles.providerIconWrap, selected ? styles.providerIconWrapActive : null]}>
                    <Feather
                      name={provider === 'groq' ? 'cpu' : 'star'}
                      size={15}
                      color={selected ? '#ffffff' : '#93c5fd'}
                    />
                  </View>
                  <View style={styles.providerCopy}>
                    <Text style={styles.providerTitle}>{provider === 'groq' ? 'Groq' : 'Gemini'}</Text>
                    <Text style={styles.providerDescription}>
                      {provider === 'groq'
                        ? 'Use Groq as the active AI provider.'
                        : 'Use Gemini as the active AI provider.'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <View style={styles.modalActionRow}>
              <Pressable style={styles.iconGhostBtn} onPress={() => setAiConfigModalVisible(false)}>
                <Feather name="x" size={16} color="#e2e8f0" />
              </Pressable>
              <Pressable style={styles.iconPrimaryBtn} onPress={() => onSaveAiProvider(selectedAiProvider)}>
                <Feather name="check" size={16} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={notificationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNotificationModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Notifications</Text>
            <Text style={styles.modalDescription}>Choose the alert style used across the app.</Text>
            {NOTIFICATION_THEMES.map((theme) => {
              const selected = selectedNotificationTheme === theme.key;
              return (
                <Pressable
                  key={theme.key}
                  style={[styles.providerOption, selected ? styles.providerOptionActive : null]}
                  onPress={() => setSelectedNotificationTheme(theme.key)}
                >
                  <View style={[styles.notificationPreview, styles[`notificationPreview_${theme.key}`]]}>
                    <Feather
                      name={theme.key === 'ember' ? 'zap' : theme.key === 'aurora' ? 'activity' : 'moon'}
                      size={15}
                      color="#ffffff"
                    />
                  </View>
                  <View style={styles.providerCopy}>
                    <Text style={styles.providerTitle}>{theme.title}</Text>
                    <Text style={styles.providerDescription}>{theme.description}</Text>
                  </View>
                  {selected ? <Feather name="check" size={17} color="#60a5fa" /> : null}
                </Pressable>
              );
            })}
            <Pressable style={styles.secondaryBtn} onPress={onTestNotificationTheme}>
              <Feather name="bell" size={14} color="#dbeafe" />
              <Text style={styles.secondaryBtnText}>Test Notification</Text>
            </Pressable>
            <View style={styles.modalActionRow}>
              <Pressable style={styles.iconGhostBtn} onPress={() => setNotificationModalVisible(false)}>
                <Feather name="x" size={16} color="#e2e8f0" />
              </Pressable>
              <Pressable
                style={styles.iconPrimaryBtn}
                onPress={() => {
                  onSaveNotificationTheme(selectedNotificationTheme);
                  setNotificationModalVisible(false);
                }}
              >
                <Feather name="check" size={16} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={aboutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAboutModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.aboutModalCard]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>About NoteKit</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.aboutBlock}>
                <Text style={styles.aboutTitle}>Notes</Text>
                <Text style={styles.aboutText}>Create, edit, and organize your notes in one place.</Text>
              </View>
              <View style={styles.aboutBlock}>
                <Text style={styles.aboutTitle}>Tasks</Text>
                <Text style={styles.aboutText}>Manage todos and attach dates or times to stay on track.</Text>
              </View>
              <View style={styles.aboutBlock}>
                <Text style={styles.aboutTitle}>Budgetify</Text>
                <Text style={styles.aboutText}>Track expenses, reminders, and money activity from the dashboard.</Text>
              </View>
              <View style={styles.aboutBlock}>
                <Text style={styles.aboutTitle}>AI Assistant</Text>
                <Text style={styles.aboutText}>Use voice or text commands to control notes, tasks, and expenses faster.</Text>
              </View>
            </ScrollView>
            <Pressable style={[styles.iconPrimaryBtn, styles.aboutCloseBtn]} onPress={() => setAboutModalVisible(false)}>
              <Feather name="x" size={16} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardScreen>
  );
}

function getNotificationThemeTitle(themeKey) {
  return NOTIFICATION_THEMES.find((theme) => theme.key === themeKey)?.title || 'Midnight';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 32,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(15,23,42,0.82)',
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f8fafc',
  },
  subtitle: {
    marginTop: 4,
    color: 'rgba(148,163,184,0.72)',
    fontSize: 13,
  },
  heroCard: {
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.16)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
  },
  heroEyebrow: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    marginTop: 6,
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '800',
  },
  heroCaption: {
    marginTop: 6,
    color: 'rgba(148,163,184,0.74)',
    fontSize: 13,
  },
  settingsGroup: {
    marginBottom: 8,
  },
  groupLabel: {
    color: 'rgba(148,163,184,0.58)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  actionCard: {
    backgroundColor: 'rgba(15,23,42,0.8)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(37,99,235,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionCopy: {
    flex: 1,
    paddingRight: 10,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  actionDescription: {
    marginTop: 4,
    color: 'rgba(148,163,184,0.7)',
    lineHeight: 18,
    fontSize: 12,
  },
  actionMeta: {
    marginTop: 8,
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
  },
  modalHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.28)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  aboutModalCard: {
    maxHeight: '72%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
  },
  modalDescription: {
    marginTop: 6,
    marginBottom: 14,
    color: 'rgba(148,163,184,0.72)',
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#f8fafc',
    backgroundColor: 'rgba(15,23,42,0.92)',
  },
  hint: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 12,
    color: 'rgba(148,163,184,0.68)',
  },
  inputLabel: {
    marginBottom: 6,
    color: '#dbeafe',
    fontSize: 12,
    fontWeight: '800',
  },
  errorText: {
    marginTop: 8,
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.22)',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(37,99,235,0.14)',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#dbeafe',
    fontWeight: '700',
    marginLeft: 8,
  },
  modalActionRow: {
    flexDirection: 'row',
    marginTop: 8,
    justifyContent: 'flex-end',
    gap: 12,
  },
  iconGhostBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,41,59,0.84)',
  },
  iconPrimaryBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(191,219,254,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
  },
  aboutCloseBtn: {
    marginTop: 12,
    alignSelf: 'flex-end',
  },
  ghostBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: 'rgba(30,41,59,0.84)',
    marginRight: 10,
  },
  ghostBtnText: {
    color: '#e2e8f0',
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    borderWidth: 1,
    borderColor: 'rgba(191,219,254,0.48)',
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  providerOption: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(15,23,42,0.72)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  providerOptionActive: {
    borderColor: 'rgba(96,165,250,0.4)',
    backgroundColor: 'rgba(37,99,235,0.18)',
  },
  providerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(37,99,235,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  providerIconWrapActive: {
    backgroundColor: '#2563eb',
  },
  notificationPreview: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  notificationPreview_midnight: {
    backgroundColor: '#1d4ed8',
  },
  notificationPreview_aurora: {
    backgroundColor: '#059669',
  },
  notificationPreview_ember: {
    backgroundColor: '#d97706',
  },
  providerCopy: {
    flex: 1,
  },
  providerTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  providerDescription: {
    marginTop: 3,
    color: 'rgba(148,163,184,0.72)',
    lineHeight: 18,
  },
  aboutBlock: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.12)',
  },
  aboutTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  aboutText: {
    marginTop: 4,
    color: 'rgba(148,163,184,0.72)',
    lineHeight: 20,
  },
});
