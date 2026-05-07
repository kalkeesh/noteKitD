import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

function getFallbackLabel(domain) {
  const value = (domain || '?').trim();
  return value.charAt(0).toUpperCase() || '?';
}

export default function LinkPreviewCard({ preview }) {
  if (!preview?.url) {
    return null;
  }

  const onOpen = async () => {
    try {
      const supported = await Linking.canOpenURL(preview.url);
      if (!supported) {
        return;
      }
      await Linking.openURL(preview.url);
    } catch {}
  };

  return (
    <Pressable style={styles.card} onPress={onOpen}>
      {preview.image ? (
        <Image source={{ uri: preview.image }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>{getFallbackLabel(preview.domain)}</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {preview.title || preview.domain || preview.url}
        </Text>
        {preview.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {preview.description}
          </Text>
        ) : null}
        <Text style={styles.domain} numberOfLines={1}>
          {preview.domain || preview.url}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
    backgroundColor: 'rgba(15, 23, 42, 0.76)',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#020617',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  image: {
    width: 84,
    height: 84,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
  },
  placeholder: {
    width: 84,
    height: 84,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#bfdbfe',
    fontSize: 28,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  description: {
    color: 'rgba(226, 232, 240, 0.72)',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  domain: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
});
