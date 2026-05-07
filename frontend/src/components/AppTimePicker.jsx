import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDisplayTime, formatTimeParts, pad, parseTimeValue } from '../utils/dateTime';

const ITEM_HEIGHT = 42;
const VISIBLE_ROWS = 5;
const LOOP_REPEATS = 7;

function createLoopedValues(total, shouldLoop) {
  if (!shouldLoop) {
    return Array.from({ length: total }, (_, index) => index);
  }
  return Array.from({ length: total * LOOP_REPEATS }, (_, index) => index % total);
}

function to12HourParts(hour24) {
  const period = hour24 >= 12 ? 1 : 0;
  const hour12 = hour24 % 12 || 12;
  return { hour12, period };
}

function to24Hour(hour12, period) {
  if (period === 1) {
    return hour12 === 12 ? 12 : hour12 + 12;
  }
  return hour12 === 12 ? 0 : hour12;
}

function WheelColumn({ label, values, selectedValue, onChange, theme, loop = true }) {
  const listRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const total = values.length;
  const loopedValues = useMemo(() => createLoopedValues(total, loop), [loop, total]);

  const scrollToSelected = useCallback(
    (selected, animated) => {
      const targetIndex = loop ? Math.floor(LOOP_REPEATS / 2) * total + selected : selected;
      listRef.current?.scrollToOffset({ offset: targetIndex * ITEM_HEIGHT, animated });
    },
    [loop, total]
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      scrollToSelected(selectedValue, false);
    });
    return () => cancelAnimationFrame(id);
  }, [scrollToSelected, selectedValue]);

  const handleMomentumEnd = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const rawIndex = Math.round(offsetY / ITEM_HEIGHT);
    const nextValue = loop ? ((rawIndex % total) + total) % total : Math.max(0, Math.min(total - 1, rawIndex));
    const normalizedIndex = loop ? Math.floor(LOOP_REPEATS / 2) * total + nextValue : nextValue;
    if (nextValue !== selectedValue) {
      onChange(nextValue);
    }
    if (rawIndex !== normalizedIndex) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({
          offset: normalizedIndex * ITEM_HEIGHT,
          animated: false,
        });
      });
    }
  };

  return (
    <View style={styles.column}>
      <Text style={[styles.columnLabel, theme === 'dark' ? styles.columnLabelDark : null]}>{label}</Text>
      <View style={styles.wheelFrame}>
        <Animated.FlatList
          ref={listRef}
          data={loopedValues}
          keyExtractor={(_, index) => `${label}-${index}`}
          showsVerticalScrollIndicator={false}
          bounces={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          contentContainerStyle={styles.wheelContent}
          onMomentumScrollEnd={handleMomentumEnd}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: true,
          })}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => {
            const inputRange = [
              (index - 2) * ITEM_HEIGHT,
              (index - 1) * ITEM_HEIGHT,
              index * ITEM_HEIGHT,
              (index + 1) * ITEM_HEIGHT,
              (index + 2) * ITEM_HEIGHT,
            ];
            const opacity = scrollY.interpolate({
              inputRange,
              outputRange: [0.18, 0.42, 1, 0.42, 0.18],
              extrapolate: 'clamp',
            });
            const scale = scrollY.interpolate({
              inputRange,
              outputRange: [0.92, 0.96, 1.04, 0.96, 0.92],
              extrapolate: 'clamp',
            });
            return (
              <View style={styles.wheelItem}>
                <Animated.Text
                  style={[
                    styles.wheelText,
                    theme === 'dark' ? styles.wheelTextDark : null,
                    { opacity, transform: [{ scale }] },
                  ]}
                >
                  {values[item]}
                </Animated.Text>
              </View>
            );
          }}
        />
        <View style={[styles.centerHighlight, theme === 'dark' ? styles.centerHighlightDark : null]} pointerEvents="none" />
      </View>
    </View>
  );
}

export default function AppTimePicker({
  label,
  value,
  onChange,
  placeholder = 'Select time',
  disabled = false,
  format = '24h',
  openOnMount = false,
  hideField = false,
  onDismiss,
  theme = 'light',
}) {
  const parsed = useMemo(() => parseTimeValue(value), [value]);
  const initial12h = useMemo(() => to12HourParts(parsed.hour), [parsed.hour]);
  const [visible, setVisible] = useState(false);
  const [hour, setHour] = useState(format === '12h' ? initial12h.hour12 - 1 : parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState(initial12h.period);
  const autoOpenedRef = useRef(false);
  const hasBeenVisibleRef = useRef(false);

  useEffect(() => {
    const next12h = to12HourParts(parsed.hour);
    setHour(format === '12h' ? next12h.hour12 - 1 : parsed.hour);
    setMinute(parsed.minute);
    setPeriod(next12h.period);
  }, [format, parsed.hour, parsed.minute]);

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

  const displayValue = value ? formatDisplayTime(value, format) : '';
  const hours = useMemo(
    () =>
      format === '12h'
        ? Array.from({ length: 12 }, (_, index) => pad(index + 1))
        : Array.from({ length: 24 }, (_, index) => pad(index)),
    [format]
  );
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, index) => pad(index)), []);
  const periods = useMemo(() => ['AM', 'PM'], []);

  const onSave = () => {
    const savedHour = format === '12h' ? to24Hour(hour + 1, period) : hour;
    onChange?.(formatTimeParts(savedHour, minute));
    setVisible(false);
  };

  const onClear = () => {
    onChange?.('');
    setVisible(false);
  };

  return (
    <View style={hideField ? null : styles.wrapper}>
      {hideField ? null : (
        <>
          {label ? <Text style={[styles.inputLabel, theme === 'dark' ? styles.inputLabelDark : null]}>{label}</Text> : null}
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
                {displayValue || placeholder}
              </Text>
              <Text style={[styles.fieldHint, theme === 'dark' ? styles.fieldHintDark : null]}>Tap to open time wheel</Text>
            </View>
            <Text style={[styles.fieldIcon, theme === 'dark' ? styles.fieldIconDark : null]}>TIME</Text>
          </Pressable>
        </>
      )}

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={[styles.overlay, theme === 'dark' ? styles.overlayDark : null]}>
          <View style={[styles.sheet, theme === 'dark' ? styles.sheetDark : null]}>
            <View style={[styles.handle, theme === 'dark' ? styles.handleDark : null]} />
            <View style={styles.headerRow}>
              <Text style={[styles.sheetTitle, theme === 'dark' ? styles.sheetTitleDark : null]}>Select Time</Text>
              <Pressable style={[styles.closeChip, theme === 'dark' ? styles.closeChipDark : null]} onPress={() => setVisible(false)}>
                <Text style={[styles.closeChipText, theme === 'dark' ? styles.closeChipTextDark : null]}>Close</Text>
              </Pressable>
            </View>

            <View style={styles.columnsRow}>
              <WheelColumn label="Hour" values={hours} selectedValue={hour} onChange={setHour} theme={theme} />
              <Text style={[styles.timeSeparator, theme === 'dark' ? styles.timeSeparatorDark : null]}>:</Text>
              <WheelColumn label="Minute" values={minutes} selectedValue={minute} onChange={setMinute} theme={theme} />
              {format === '12h' ? (
                <WheelColumn label="Period" values={periods} selectedValue={period} onChange={setPeriod} theme={theme} loop={false} />
              ) : null}
            </View>

            <Text style={[styles.previewText, theme === 'dark' ? styles.previewTextDark : null]}>
              {format === '12h'
                ? formatDisplayTime(formatTimeParts(to24Hour(hour + 1, period), minute), '12h')
                : formatTimeParts(hour, minute)}
            </Text>

            <View style={styles.actionsRow}>
              <Pressable style={[styles.clearButton, theme === 'dark' ? styles.clearButtonDark : null]} onPress={onClear}>
                <Text style={[styles.clearButtonText, theme === 'dark' ? styles.clearButtonTextDark : null]}>Clear</Text>
              </Pressable>
              <Pressable style={[styles.saveButton, theme === 'dark' ? styles.saveButtonDark : null]} onPress={onSave}>
                <Text style={styles.saveButtonText}>Save Time</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 12 },
  inputLabel: { color: '#334155', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  inputLabelDark: { color: 'rgba(148,163,184,0.72)' },
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
  fieldIcon: { color: '#0f4c81', fontSize: 11, fontWeight: '900' },
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
    marginBottom: 10,
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
  columnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginTop: 8,
  },
  column: { width: '28%', alignItems: 'center' },
  columnLabel: { color: '#334155', fontWeight: '700', marginBottom: 8 },
  columnLabelDark: { color: 'rgba(148,163,184,0.7)' },
  timeSeparator: { fontSize: 32, fontWeight: '300', color: '#1e293b', marginHorizontal: -4 },
  timeSeparatorDark: { color: '#f8fafc' },
  wheelFrame: {
    width: '100%',
    height: ITEM_HEIGHT * VISIBLE_ROWS,
    position: 'relative',
    overflow: 'hidden',
  },
  wheelContent: { paddingVertical: ITEM_HEIGHT * 2 },
  wheelItem: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  wheelText: { color: '#1e293b', fontSize: 24, fontWeight: '800', letterSpacing: 0.3 },
  wheelTextDark: { color: '#f8fafc' },
  centerHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_HEIGHT * 2,
    height: ITEM_HEIGHT,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: 'rgba(219, 234, 254, 0.7)',
  },
  centerHighlightDark: {
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(36,45,66,0.82)',
  },
  previewText: {
    textAlign: 'center',
    color: '#0f4c81',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 16,
  },
  previewTextDark: { color: '#bfdbfe' },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  clearButton: {
    width: '34%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e1f5',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearButtonDark: {
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(15,23,42,0.9)',
  },
  clearButtonText: { color: '#475569', fontWeight: '800' },
  clearButtonTextDark: { color: '#e2e8f0' },
  saveButton: {
    width: '62%',
    borderRadius: 14,
    backgroundColor: '#0f4c81',
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonDark: { backgroundColor: '#2563eb' },
  saveButtonText: { color: '#ffffff', fontWeight: '800' },
});
