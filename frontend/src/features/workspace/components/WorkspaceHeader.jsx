import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { getProfileImageUrl } from '../../../config/profileImages';
import { styles } from '../styles';

export default function WorkspaceHeader({
  name,
  profileImageKey,
  onProfilePress,
  onMenuPress,
}) {
  const imageUrl = getProfileImageUrl(profileImageKey);
  const initials = String(name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';
  const hour = Number(
    new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }).format(new Date())
  );
  const greeting = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

  return (
    <View style={styles.topBar}>
      <View style={styles.headerLeft}>
        <Pressable onPress={onProfilePress}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <View style={styles.headerAvatarGradientA} />
              <View style={styles.headerAvatarGradientB} />
              <Text style={styles.headerAvatarFallbackText}>{initials}</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.headerGreeting}>
          <Text style={styles.subtitle}>{greeting}</Text>
          <Text style={styles.appTitle} numberOfLines={1}>
            {name}
          </Text>
        </View>
      </View>
      <View style={styles.headerActionRow}>
        <Pressable style={styles.iconBtn} onPress={onMenuPress} accessibilityRole="button">
          <Feather name="menu" size={20} color="rgba(148,163,184,0.7)" />
        </Pressable>
      </View>
    </View>
  );
}
