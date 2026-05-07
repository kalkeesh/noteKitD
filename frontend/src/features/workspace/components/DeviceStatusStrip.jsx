import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { styles } from '../styles';

function getCurrentTimeLabel() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DeviceStatusStrip() {
  const [timeLabel, setTimeLabel] = useState(getCurrentTimeLabel());
  const [batteryLabel, setBatteryLabel] = useState('--%');

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLabel(getCurrentTimeLabel());
    }, 30 * 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.getBattery) {
      return;
    }

    let mounted = true;
    let batteryManager = null;

    const updateBattery = () => {
      if (!mounted || !batteryManager) {
        return;
      }
      const percent = Math.round((batteryManager.level || 0) * 100);
      setBatteryLabel(`${percent}%${batteryManager.charging ? ' (chg)' : ''}`);
    };

    navigator.getBattery().then((battery) => {
      if (!mounted) {
        return;
      }
      batteryManager = battery;
      updateBattery();
      battery.addEventListener('levelchange', updateBattery);
      battery.addEventListener('chargingchange', updateBattery);
    });

    return () => {
      mounted = false;
      if (batteryManager) {
        batteryManager.removeEventListener('levelchange', updateBattery);
        batteryManager.removeEventListener('chargingchange', updateBattery);
      }
    };
  }, []);

  return (
    <View style={styles.deviceStatusWrap}>
      <Text style={styles.deviceStatusText}>{timeLabel}</Text>
      <Text style={styles.deviceStatusText}>Battery {batteryLabel}</Text>
    </View>
  );
}
