function lower(value) {
  return String(value || '').toLowerCase();
}

export function validatePasswordStrength(password) {
  const value = String(password || '');
  if (value.length < 8) {
    return 'Use at least 8 characters in your password.';
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return 'Use both letters and numbers in your password.';
  }
  return '';
}

function isNetworkError(message) {
  const text = lower(message);
  return (
    text.includes('network request failed') ||
    text.includes('timed out') ||
    text.includes('failed to fetch')
  );
}

export function getAuthErrorMessage(error, fallbackMessage) {
  const message = error?.message || '';
  const status = error?.status;
  const text = lower(message);

  if (text.includes('email already registered')) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (text.includes('incorrect password')) {
    return 'The password you entered is incorrect. Please try again.';
  }
  if (text.includes('invalid credentials')) {
    return 'The email or password you entered is incorrect.';
  }
  if (text.includes('user not found')) {
    return 'We could not find an account with that email address.';
  }
  if (text.includes('weak password')) {
    return 'Choose a stronger password with at least 8 characters, including letters and numbers.';
  }
  if (text.includes('invalid email or otp')) {
    return 'The email or OTP you entered is incorrect.';
  }
  if (text.includes('expired otp')) {
    return 'That OTP has expired. Please request a new one.';
  }
  if (text.includes('token expired')) {
    return 'Your session has expired. Please log in again.';
  }
  if (text.includes('database unavailable')) {
    return 'The backend is running, but the database is not reachable right now. Check MONGO_URI and MongoDB, then try again.';
  }
  if (text.includes('password reset verification expired')) {
    return 'Your reset session expired. Please request a new OTP.';
  }
  if (text.includes('invalid password reset token')) {
    return 'Your reset session is no longer valid. Please verify OTP again.';
  }
  if (isNetworkError(text)) {
    return 'Unable to reach the server right now. Check your connection and try again.';
  }
  if (status >= 500) {
    return 'Something went wrong on the server. Please try again in a moment.';
  }

  return fallbackMessage || 'Something went wrong. Please try again.';
}
