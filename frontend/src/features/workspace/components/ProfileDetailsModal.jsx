import React from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { getProfileImageUrl } from '../../../config/profileImages';
import { styles } from '../styles';

export default function ProfileDetailsModal({
  visible,
  name,
  email,
  profileImageKey,
  onClose,
  onEditImage,
}) {
  const imageUrl = getProfileImageUrl(profileImageKey);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdropCentered}>
        <View style={styles.profileDetailsCard}>
          <Pressable style={styles.profileCloseBtn} onPress={onClose}>
            <Feather name="x" size={16} color="#e2e8f0" />
          </Pressable>

          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.profileHeroImage} />
          ) : (
            <View style={[styles.profileHeroImage, styles.headerAvatarFallback]}>
              <Text style={styles.headerAvatarFallbackText}>U</Text>
            </View>
          )}

          <Text style={styles.profileName}>{name || 'User'}</Text>
          <Text style={styles.profileEmail}>{email || ''}</Text>

          <Pressable style={styles.editImageBtn} onPress={onEditImage}>
            <Feather name="edit-3" size={15} color="#dbeafe" />
            <Text style={styles.editImageBtnText}>Change Photo</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
