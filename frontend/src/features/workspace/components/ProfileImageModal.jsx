import React from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { getProfileImageUrl } from '../../../config/profileImages';
import { styles } from '../styles';

function ProfileOption({ keyName, selected, onSelect }) {
  return (
    <Pressable
      style={[styles.profileOptionCard, selected ? styles.profileOptionCardActive : null]}
      onPress={() => onSelect(keyName)}
    >
      <View style={styles.profileOptionGlow} />
      <Image source={{ uri: getProfileImageUrl(keyName) }} style={styles.profileOptionImage} />
      {selected ? (
        <View style={styles.profileOptionBadge}>
          <Feather name="check" size={12} color="#ffffff" />
        </View>
      ) : null}
      <Text style={[styles.profileOptionText, selected ? styles.profileOptionTextActive : null]}>
        {keyName}
      </Text>
    </Pressable>
  );
}

export default function ProfileImageModal({
  visible,
  options,
  selectedKey,
  saving,
  onClose,
  onSelect,
  onSave,
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCardTall}>
          <Text style={styles.modalTitle}>Choose Profile Image</Text>
          <Text style={styles.profileModalHint}>Options are loaded dynamically from server images.</Text>

          <ScrollView contentContainerStyle={styles.profileGrid}>
            {(options || []).map((keyName) => (
              <ProfileOption
                key={keyName}
                keyName={keyName}
                selected={selectedKey === keyName}
                onSelect={onSelect}
              />
            ))}
            {(!options || options.length === 0) ? (
              <Text style={styles.emptyText}>No profile images found on server.</Text>
            ) : null}
          </ScrollView>

      <View style={styles.modalActions}>
        <Pressable style={styles.secondaryBtn} onPress={onClose} disabled={saving}>
          <Feather name="x" size={15} color="#dbeafe" />
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={onSave} disabled={saving}>
          <Feather name={saving ? 'loader' : 'check'} size={15} color="#ffffff" />
        </Pressable>
      </View>
        </View>
      </View>
    </Modal>
  );
}
