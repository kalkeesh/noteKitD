let toastHandler = null;

export function registerToastHandler(handler) {
  toastHandler = handler;
  return () => {
    if (toastHandler === handler) {
      toastHandler = null;
    }
  };
}

export function showToast(message, type = 'info', options = {}) {
  const text = String(message || '').trim();
  if (!text) {
    return;
  }

  toastHandler?.({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: text,
    type: ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info',
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
