import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  compareIsoDate,
  daysInMonth,
  formatDateParts,
  formatDisplayDate,
  formatDisplayMonth,
  formatMonthParts,
  monthLabel,
  parseDateValue,
  parseMonthValue,
  toDateKey,
} from '../utils/dateTime';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildCalendarCells(year, month) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function clampMonthYear(year, month) {
  if (month < 1) {
    return { year: year - 1, month: 12 };
  }
  if (month > 12) {
    return { year: year + 1, month: 1 };
  }
  return { year, month };
}

export default function AppDatePicker({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  mode = 'date',
  placeholder,
  disabled = false,
  openOnMount = false,
  hideField = false,
  onDismiss,
  theme = 'light',
}) {
  const initialParts = useMemo(
    () => (mode === 'month' ? parseMonthValue(value) : parseDateValue(value)),
    [mode, value]
  );
  const [visible, setVisible] = useState(false);
  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonth, setViewMonth] = useState(initialParts.month);
  const autoOpenedRef = useRef(false);
  const hasBeenVisibleRef = useRef(false);

  useEffect(() => {
    const nextParts = mode === 'month' ? parseMonthValue(value) : parseDateValue(value);
    setViewYear(nextParts.year);
    setViewMonth(nextParts.month);
  }, [mode, value]);

  useEffect(() => {
    if (openOnMount && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setVisible(true);
    }
  }, [openOnMount]);

  useEffect(() => {
    if (visible) {
      hasBeenVisibleRef.current = true;
      return;
    }
    if (autoOpenedRef.current && hasBeenVisibleRef.current && !visible) {
      onDismiss?.();
    }
  }, [onDismiss, visible]);

  const displayValue = mode === 'month' ? formatDisplayMonth(value) : formatDisplayDate(value);
  const fieldText = displayValue || placeholder || (mode === 'month' ? 'Select month' : 'Select date');
  const selectedDate = mode === 'month' ? '' : value || '';
  const selectedMonth = mode === 'month' ? value || '' : '';
  const todayDate = toDateKey(new Date());
  const calendarCells = useMemo(() => buildCalendarCells(viewYear, viewMonth), [viewYear, viewMonth]);

  const goMonth = (delta) => {
    const next = clampMonthYear(viewYear, viewMonth + delta);
    setViewYear(next.year);
    setViewMonth(next.month);
  };

  const onPickToday = () => {
    const today = new Date();
    const iso = toDateKey(today);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth() + 1);
    onChange?.(iso);
    setVisible(false);
  };

  const onPickTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = toDateKey(tomorrow);
    setViewYear(tomorrow.getFullYear());
    setViewMonth(tomorrow.getMonth() + 1);
    onChange?.(iso);
    setVisible(false);
  };

  const onClear = () => {
    onChange?.('');
    setVisible(false);
  };

  const pickMonth = (month) => {
    onChange?.(formatMonthParts(viewYear, month));
    setViewMonth(month);
    setVisible(false);
  };

  const pickDay = (day) => {
    const nextValue = formatDateParts(viewYear, viewMonth, day);
    if (minDate && compareIsoDate(nextValue, minDate) < 0) {
      return;
    }
    if (maxDate && compareIsoDate(nextValue, maxDate) > 0) {
      return;
    }
    onChange?.(nextValue);
    setVisible(false);
  };

  return (
    <View style={hideField ? null : styles.wrapper}>
      {hideField ? null : (
        <>
          {label ? <Text style={[styles.label, theme === 'dark' ? styles.labelDark : null]}>{label}</Text> : null}
          <Pressable
            style={[styles.field, theme === 'dark' ? styles.fieldDark : null, disabled ? styles.fieldDisabled : null]}
            onPress={() => {
              if (!disabled) {
                setVisible(true);
              }
            }}
          >
            <View>
              <Text
                style={[
                  styles.fieldValue,
                  theme === 'dark' ? styles.fieldValueDark : null,
                  !displayValue ? styles.fieldPlaceholder : null,
                ]}
              >
                {fieldText}
              </Text>
              <Text style={[styles.fieldHint, theme === 'dark' ? styles.fieldHintDark : null]}>
                {mode === 'month' ? 'Tap to open month picker' : 'Tap to open calendar'}
              </Text>
            </View>
            <Text style={[styles.fieldIcon, theme === 'dark' ? styles.fieldIconDark : null]}>{mode === 'month' ? 'MM' : 'CAL'}</Text>
          </Pressable>
        </>
      )}

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={[styles.overlay, theme === 'dark' ? styles.overlayDark : null]}>
          <View style={[styles.sheet, theme === 'dark' ? styles.sheetDark : null]}>
            <View style={[styles.handle, theme === 'dark' ? styles.handleDark : null]} />
            <View style={styles.headerRow}>
              <Text style={[styles.sheetTitle, theme === 'dark' ? styles.sheetTitleDark : null]}>{mode === 'month' ? 'Select Month' : 'Select Date'}</Text>
              <Pressable style={[styles.closeChip, theme === 'dark' ? styles.closeChipDark : null]} onPress={() => setVisible(false)}>
                <Text style={[styles.closeChipText, theme === 'dark' ? styles.closeChipTextDark : null]}>Close</Text>
              </Pressable>
            </View>

            <View style={styles.monthNav}>
              <Pressable style={[styles.monthNavButton, theme === 'dark' ? styles.monthNavButtonDark : null]} onPress={() => goMonth(-1)}>
                <Text style={[styles.monthNavButtonText, theme === 'dark' ? styles.monthNavButtonTextDark : null]}>{'<'}</Text>
              </Pressable>
              <Text style={[styles.monthNavTitle, theme === 'dark' ? styles.monthNavTitleDark : null]}>{monthLabel(viewYear, viewMonth)}</Text>
              <Pressable style={[styles.monthNavButton, theme === 'dark' ? styles.monthNavButtonDark : null]} onPress={() => goMonth(1)}>
                <Text style={[styles.monthNavButtonText, theme === 'dark' ? styles.monthNavButtonTextDark : null]}>{'>'}</Text>
              </Pressable>
            </View>

            {mode === 'month' ? (
              <View style={styles.monthGrid}>
                {MONTH_NAMES.map((monthNameLabel, index) => {
                  const month = index + 1;
                  const iso = formatMonthParts(viewYear, month);
                  const isSelected = iso === selectedMonth;
                  return (
                    <Pressable
                      key={monthNameLabel}
                      style={[styles.monthChip, theme === 'dark' ? styles.monthChipDark : null, isSelected ? styles.monthChipSelected : null]}
                      onPress={() => pickMonth(month)}
                    >
                      <Text
                        style={[
                          styles.monthChipText,
                          theme === 'dark' ? styles.monthChipTextDark : null,
                          isSelected ? styles.monthChipTextSelected : null,
                        ]}
                      >
                        {monthNameLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <>
                <View style={styles.quickActions}>
                  <Pressable style={[styles.quickChip, theme === 'dark' ? styles.quickChipDark : null]} onPress={onPickToday}>
                    <Text style={[styles.quickChipText, theme === 'dark' ? styles.quickChipTextDark : null]}>Today</Text>
                  </Pressable>
                  <Pressable style={[styles.quickChip, theme === 'dark' ? styles.quickChipDark : null]} onPress={onPickTomorrow}>
                    <Text style={[styles.quickChipText, theme === 'dark' ? styles.quickChipTextDark : null]}>Tomorrow</Text>
                  </Pressable>
                </View>

                <View style={styles.weekHeaderRow}>
                  {WEEK_NAMES.map((weekDay) => (
                    <Text key={weekDay} style={[styles.weekHeaderText, theme === 'dark' ? styles.weekHeaderTextDark : null]}>
                      {weekDay}
                    </Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {calendarCells.map((day, index) => {
                    if (!day) {
                      return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
                    }
                    const iso = formatDateParts(viewYear, viewMonth, day);
                    const disabledByRange =
                      (minDate && compareIsoDate(iso, minDate) < 0) ||
                      (maxDate && compareIsoDate(iso, maxDate) > 0);
                    const isSelected = iso === selectedDate;
                    const isToday = iso === todayDate;
                    return (
                      <Pressable
                        key={iso}
                        style={[
                          styles.dayCell,
                          theme === 'dark' ? styles.dayCellDark : null,
                          isToday ? styles.dayCellToday : null,
                          isSelected ? styles.dayCellSelected : null,
                          disabledByRange ? styles.dayCellDisabled : null,
                        ]}
                        onPress={() => {
                          if (!disabledByRange) {
                            pickDay(day);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            theme === 'dark' ? styles.dayTextDark : null,
                            isToday ? styles.dayTextToday : null,
                            isSelected ? styles.dayTextSelected : null,
                            disabledByRange ? styles.dayTextDisabled : null,
                          ]}
                        >
                          {day}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <View style={styles.footerRow}>
              <Pressable style={[styles.clearButton, theme === 'dark' ? styles.clearButtonDark : null]} onPress={onClear}>
                <Text style={[styles.clearButtonText, theme === 'dark' ? styles.clearButtonTextDark : null]}>Clear</Text>
              </Pressable>
              <Text style={[styles.footerValue, theme === 'dark' ? styles.footerValueDark : null]}>{displayValue || 'No selection yet'}</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 12 },
  label: { color: '#334155', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  labelDark: { color: 'rgba(148,163,184,0.72)' },
  field: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c8d7ee',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldDark: {
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(15,23,42,0.9)',
  },
  fieldDisabled: { opacity: 0.6 },
  fieldValue: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  fieldValueDark: { color: '#f8fafc' },
  fieldPlaceholder: { color: '#8aa0c1' },
  fieldHint: { marginTop: 3, color: '#64748b', fontSize: 11 },
  fieldHintDark: { color: 'rgba(148,163,184,0.48)' },
  fieldIcon: { color: '#2563eb', fontWeight: '900', fontSize: 11 },
  fieldIconDark: { color: '#60a5fa' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 17, 32, 0.45)',
    justifyContent: 'flex-end',
  },
  overlayDark: { backgroundColor: 'rgba(2,6,23,0.62)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#f8fbff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  sheetDark: { backgroundColor: '#090d16' },
  handle: {
    width: 52,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#c8d7ee',
    alignSelf: 'center',
    marginBottom: 12,
  },
  handleDark: { backgroundColor: 'rgba(148,163,184,0.22)' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: { color: '#0f172a', fontSize: 22, fontWeight: '900' },
  sheetTitleDark: { color: '#f8fafc' },
  closeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c8d7ee',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeChipDark: {
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(15,23,42,0.9)',
  },
  closeChipText: { color: '#475569', fontWeight: '700' },
  closeChipTextDark: { color: '#e2e8f0' },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthNavButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#d4e1f5',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavButtonDark: {
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(15,23,42,0.9)',
  },
  monthNavButtonText: { color: '#0f4c81', fontSize: 18, fontWeight: '800' },
  monthNavButtonTextDark: { color: '#f8fafc' },
  monthNavTitle: { color: '#203253', fontSize: 18, fontWeight: '800' },
  monthNavTitleDark: { color: '#f8fafc' },
  quickActions: { flexDirection: 'row', marginBottom: 12 },
  quickChip: {
    marginRight: 8,
    borderRadius: 999,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickChipDark: { backgroundColor: 'rgba(37,99,235,0.16)' },
  quickChipText: { color: '#075985', fontWeight: '800', fontSize: 12 },
  quickChipTextDark: { color: '#bfdbfe' },
  weekHeaderRow: { flexDirection: 'row', marginBottom: 8 },
  weekHeaderText: {
    width: '14.28%',
    textAlign: 'center',
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  weekHeaderTextDark: { color: 'rgba(148,163,184,0.58)' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCellEmpty: { width: '14.28%', height: 46 },
  dayCell: {
    width: '14.28%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    marginBottom: 6,
  },
  dayCellDark: { backgroundColor: 'rgba(15,23,42,0.58)' },
  dayCellToday: {
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.55)',
  },
  dayCellSelected: { backgroundColor: '#0f4c81' },
  dayCellDisabled: { opacity: 0.28 },
  dayText: { color: '#1e293b', fontWeight: '700' },
  dayTextDark: { color: '#e2e8f0' },
  dayTextToday: { color: '#60a5fa' },
  dayTextSelected: { color: '#ffffff' },
  dayTextDisabled: { color: '#94a3b8' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  monthChip: {
    width: '31%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d4e1f5',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  monthChipDark: {
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(15,23,42,0.9)',
  },
  monthChipSelected: { borderColor: '#0f4c81', backgroundColor: '#dbeafe' },
  monthChipText: { color: '#334155', fontWeight: '700' },
  monthChipTextDark: { color: '#e2e8f0' },
  monthChipTextSelected: { color: '#0f4c81' },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  clearButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4e1f5',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  clearButtonDark: {
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(15,23,42,0.9)',
  },
  clearButtonText: { color: '#475569', fontWeight: '800' },
  clearButtonTextDark: { color: '#e2e8f0' },
  footerValue: {
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
    color: '#475569',
    fontWeight: '600',
  },
  footerValueDark: { color: 'rgba(226,232,240,0.72)' },
});
