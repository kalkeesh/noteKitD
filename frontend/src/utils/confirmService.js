let confirmHandler = null;

export function registerConfirmHandler(handler) {
  confirmHandler = handler;
  return () => {
    if (confirmHandler === handler) {
      confirmHandler = null;
    }
  };
}

export function showConfirm(options) {
  return new Promise((resolve) => {
    if (!confirmHandler) {
      resolve(false);
      return;
    }

    confirmHandler({
      title: options?.title || 'Confirm action',
      message: options?.message || 'Are you sure you want to continue?',
      confirmText: options?.confirmText || 'Confirm',
      cancelText: options?.cancelText || 'Cancel',
      tone: options?.tone || 'danger',
      onResolve: resolve,
    });
  });
}
