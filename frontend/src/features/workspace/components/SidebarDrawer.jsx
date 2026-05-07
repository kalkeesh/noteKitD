import React from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { getProfileImageUrl } from '../../../config/profileImages';
import { TAB_BUDGETIFY, TAB_CALENDAR, TAB_NOTES, TAB_TODOS } from '../constants';
import { styles } from '../styles';

function DrawerItem({ icon, label, active, onPress, danger = false, showDot = false }) {
  return (
    <Pressable
      style={[
        styles.drawerItem,
        active ? styles.drawerItemActive : null,
        danger ? styles.drawerItemDanger : null,
      ]}
      onPress={onPress}
    >
      <Feather
        name={icon}
        size={18}
        color={
          danger
            ? 'rgba(248,113,113,0.8)'
            : active
              ? '#93c5fd'
              : 'rgba(148,163,184,0.7)'
        }
      />
      <Text
        style={[
          styles.drawerItemText,
          active ? styles.drawerItemTextActive : null,
          danger ? styles.drawerItemTextDanger : null,
        ]}
      >
        {label}
      </Text>
      {showDot ? <View style={styles.drawerItemDot} /> : null}
    </Pressable>
  );
}

export default function SidebarDrawer({
  open,
  activeTab,
  onClose,
  onTabChange,
  onSupportDev,
  onProfile,
  onBudgetify,
  onSettings,
  onRefresh,
  onLogout,
  drawerAnim,
  name,
  email,
  profileImageKey,
}) {
  if (!open) {
    return null;
  }

  const backdropOpacity = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const drawerTranslate = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [260, 0],
  });
  const imageUrl = getProfileImageUrl(profileImageKey);
  const initials = String(name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';

  return (
    <View style={styles.drawerLayer}>
      <Animated.View style={[styles.drawerBackdrop, { opacity: backdropOpacity }]}>
        <Pressable style={styles.drawerBackdropTouch} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.drawerPanel, { transform: [{ translateX: drawerTranslate }] }]}>
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerBrand}>
            <Text style={styles.drawerBrandBlue}>Note</Text>
            <Text style={styles.drawerBrandPurple}>Kit</Text>
          </Text>

          <View style={styles.drawerUser}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.drawerAvatarImage} />
            ) : (
              <View style={styles.drawerAvatar}>
                <Text style={styles.drawerAvatarText}>{initials}</Text>
              </View>
            )}
            <View style={styles.drawerUserInfo}>
              <Text style={styles.drawerUserName} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.drawerUserEmail} numberOfLines={1}>
                {email}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.drawerNav}>
          <Text style={styles.drawerSectionLabel}>Workspace</Text>
          <DrawerItem
            icon="file-text"
            label="Notes"
            active={activeTab === TAB_NOTES}
            onPress={() => onTabChange(TAB_NOTES)}
            showDot={activeTab === TAB_NOTES}
          />
          <DrawerItem icon="check-square" label="Todo List" active={activeTab === TAB_TODOS} onPress={() => onTabChange(TAB_TODOS)} />
          <DrawerItem icon="calendar" label="Calendar" active={activeTab === TAB_CALENDAR} onPress={() => onTabChange(TAB_CALENDAR)} />
          <DrawerItem icon="dollar-sign" label="Budgetify" active={activeTab === TAB_BUDGETIFY} onPress={onBudgetify} />

          <Text style={styles.drawerSectionLabel}>Account</Text>
          <DrawerItem icon="user" label="Profile" active={false} onPress={onProfile} />
          <DrawerItem icon="settings" label="Settings" active={false} onPress={onSettings} />
          <DrawerItem icon="refresh-cw" label="Refresh Workspace" active={false} onPress={onRefresh} />
          <DrawerItem icon="heart" label="Support Dev" active={false} onPress={onSupportDev} />
          <DrawerItem icon="log-out" label="Logout" active={false} onPress={onLogout} danger />
        </View>
      </Animated.View>
    </View>
  );
}
