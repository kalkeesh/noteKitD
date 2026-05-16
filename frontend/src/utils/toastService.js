let toastHandler = null;
let themeHandler = null;
let activeNotificationTheme = 'midnight';

const VALID_NOTIFICATION_KINDS = ['budget', 'task', 'app'];

export function registerToastHandler(handler) {
  toastHandler = handler;
  return () => {
    if (toastHandler === handler) {
      toastHandler = null;
    }
  };
}

export function registerNotificationThemeHandler(handler) {
  themeHandler = handler;
  handler?.(activeNotificationTheme);
  return () => {
    if (themeHandler === handler) {
      themeHandler = null;
    }
  };
}

export function setToastNotificationTheme(theme) {
  const normalized = ['midnight', 'aurora', 'ember'].includes(theme) ? theme : 'midnight';
  activeNotificationTheme = normalized;
  themeHandler?.(normalized);
}

export function getToastNotificationTheme() {
  return activeNotificationTheme;
}

export function inferNotificationKind(...values) {
  const text = values
    .map((value) => String(value || '').toLowerCase())
    .join(' ');

  if (
    /\b(budget|budgetify|expense|expenses|spend|spent|emi|sip|debt|money|payment|paid|cash)\b/.test(text)
  ) {
    return 'budget';
  }

  if (/\b(task|tasks|todo|todos|project|reminder|workspace|note|notes)\b/.test(text)) {
    return 'task';
  }

  return 'app';
}

export function showToast(message, type = 'info', options = {}) {
  const text = String(message || '').trim();
  if (!text) {
    return;
  }
  const notificationKind = VALID_NOTIFICATION_KINDS.includes(options.kind)
    ? options.kind
    : inferNotificationKind(options.title, text);

  toastHandler?.({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: text,
    type: ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info',
    kind: notificationKind,
    theme: options.theme || activeNotificationTheme,
    duration: options.duration || 2600,
  });
}

export const toast = {
  success(message, options) {
    showToast(message, 'success', options);
  },
  error(message, options) {
    showToast(message, 'error', options);
  },
  warning(message, options) {
    showToast(message, 'warning', options);
  },
  info(message, options) {
    showToast(message, 'info', options);
  },
};
