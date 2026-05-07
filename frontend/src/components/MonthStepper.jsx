import React from 'react';

import AppDatePicker from './AppDatePicker';

export default function MonthStepper({ label, value, onChange, theme = 'light' }) {
  return <AppDatePicker label={label} value={value} onChange={onChange} mode="month" placeholder="Select month" theme={theme} />;
}
