import React from 'react';

import AppDatePicker from './AppDatePicker';

export default function DateStepper({ label, value, onChange, minDate, maxDate, placeholder, theme = 'light' }) {
  return (
    <AppDatePicker
      label={label}
      value={value}
      onChange={onChange}
      minDate={minDate}
      maxDate={maxDate}
      placeholder={placeholder}
      mode="date"
      theme={theme}
    />
  );
}
