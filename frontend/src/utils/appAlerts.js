import { showConfirm } from './confirmService';
import { showToast } from './toastService';

export function showAppAlert(title, message) {
  const normalizedTitle = String(title || '').toLowerCase();
  const normalizedMessage = String(message || '').trim();
  let type = 'info';

  if (normalizedTitle.includes('fail') || normalizedTitle.includes('error') || normalizedTitle.includes('unable')) {
    type = 'error';
  } else if (
    normalizedTitle.includes('required') ||
    normalizedTitle.includes('invalid') ||
    normalizedTitle.includes('expired') ||
    normalizedTitle.includes('no images')
  ) {
    type = 'warning';
  } else if (
    normalizedTitle.includes('success') ||
    normalizedTitle.includes('verified') ||
    normalizedTitle.includes('logged in') ||
    normalizedTitle.includes('otp sent') ||
    normalizedTitle.includes('complete') ||
    normalizedTitle.includes('saved') ||
    normalizedTitle.includes('added') ||
    normalizedTitle.includes('updated') ||
    normalizedTitle.includes('deleted') ||
    normalizedTitle.includes('removed') ||
    normalizedTitle.includes('refreshed')
  ) {
    type = 'success';
  }

  showToast(normalizedMessage || title, type, { title });
}

export function showAppConfirm(options) {
  return showConfirm(options);
}
