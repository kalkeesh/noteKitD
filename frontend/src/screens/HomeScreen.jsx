import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  FlatList,
  ImageBackground,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const APPS = [
  {
    id: 1,
    name: 'My Portfolio',
    image: require('../../assets/app_images/1.jpeg'),
    url: 'https://kalkeesh.github.io/',
  },
  {
    id: 2,
    name: 'Geo Spatial Insights',
    image: require('../../assets/app_images/2.jpeg'),
    url: 'https://nourway.streamlit.app/',
  },
  {
    id: 3,
    name: 'Night Owl Chat Room',
    image: require('../../assets/app_images/3.jpeg'),
    url: 'https://nightowlchat.onrender.com/',
  },
  {
    id: 4,
    name: 'Student Management System',
    image: require('../../assets/app_images/4.jpeg'),
    url: 'https://sms-7g7p.onrender.com/',
  },
  {
    id: 5,
    name: 'Teacher Comments Analysis',
    image: require('../../assets/app_images/5.jpeg'),
    url: 'https://teachvibe.streamlit.app/',
  },
  {
    id: 6,
    name: 'QR Code Maker',
    image: require('../../assets/app_images/6.jpeg'),
    url: 'https://qrblend.streamlit.app/',
  },
];

function AnimatedTitle() {
  const rise = useRef(new Animated.Value(16)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(rise, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, rise]);

  return (
    <Animated.View style={[styles.titleWrap, { opacity: fade, transform: [{ translateY: rise }] }]}>
      <Text style={styles.title}>
        <Text style={styles.titleBlue}>Note</Text>
        <Text style={styles.titlePurple}>Kit</Text>
      </Text>
    </Animated.View>
  );
}

function AppCard({ item, cardWidth, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value) => {
    Animated.spring(scale, {
      toValue: value,
      speed: 28,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={() => onPress(item.url)}
      onPressIn={() => animateTo(0.97)}
      onPressOut={() => animateTo(1)}
      style={[styles.cardPressable, { width: cardWidth }]}
    >
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <ImageBackground source={item.image} style={styles.cardImage} imageStyle={styles.cardImageStyle} resizeMode="cover">
          <View style={styles.cardShade} />
          <View style={styles.cardFooter}>
            <Text style={styles.cardLabel}>{item.name}</Text>
          </View>
        </ImageBackground>
      </Animated.View>
    </Pressable>
  );
}

function ActionButton({ label, variant = 'ghost', onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value) => {
    Animated.spring(scale, {
      toValue: value,
      speed: 28,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(0.97)}
      onPressOut={() => animateTo(1)}
      style={styles.buttonPressable}
    >
      <Animated.View
        style={[
          styles.actionButton,
          variant === 'primary' ? styles.actionButtonPrimary : styles.actionButtonGhost,
          { transform: [{ scale }] },
        ]}
      >
        {variant === 'primary' ? (
          <>
            <View style={styles.primaryGradientStart} />
            <View style={styles.primaryGradientEnd} />
          </>
        ) : null}
        <Text style={[styles.actionButtonText, variant === 'primary' ? styles.actionButtonTextPrimary : null]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const gridWidth = Math.min(width - 40, 560);
  const cardWidth = (gridWidth - 12) / 2;
  const openExternalApp = (url) => {
    Linking.openURL(url);
  };

  const renderAppCard = useMemo(
    () => ({ item }) => <AppCard item={item} cardWidth={cardWidth} onPress={openExternalApp} />,
    [cardWidth]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backgroundLayer}>
        <View style={styles.orbTop} />
        <View style={styles.orbBottom} />
        <View style={styles.gridGlow} />
      </View>

      <View style={styles.content}>
        <View style={styles.topSection}>
          <AnimatedTitle />
          <Text style={styles.subtitle}>Open your other apps from one place.</Text>
        </View>

        <View style={styles.middleSection}>
          <FlatList
            data={APPS}
            numColumns={2}
            renderItem={renderAppCard}
            keyExtractor={(item) => String(item.id)}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <View style={styles.bottomSection}>
          <ActionButton label="Login" onPress={() => navigation.navigate('Login')} />
          <ActionButton label="Sign Up" variant="primary" onPress={() => navigation.navigate('Register')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#090d16',
  },
  orbTop: {
    position: 'absolute',
    top: -70,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
  },
  orbBottom: {
    position: 'absolute',
    right: -80,
    bottom: -30,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
  },
  gridGlow: {
    position: 'absolute',
    top: '28%',
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  topSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 18,
    paddingBottom: 18,
  },
  titleWrap: {
    alignItems: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(96, 165, 250, 0.18)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  titleBlue: {
    color: '#bfdbfe',
  },
  titlePurple: {
    color: '#c4b5fd',
  },
  subtitle: {
    marginTop: 10,
    color: 'rgba(226, 232, 240, 0.72)',
    fontSize: 14,
    textAlign: 'center',
  },
  middleSection: {
    flex: 1,
  },
  gridContent: {
    alignSelf: 'center',
    paddingBottom: 8,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardPressable: {
    marginBottom: 0,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
    backgroundColor: '#101623',
    shadowColor: '#020617',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  cardImage: {
    height: 172,
    justifyContent: 'flex-end',
  },
  cardImageStyle: {
    borderRadius: 20,
  },
  cardShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.24)',
  },
  cardFooter: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  cardLabel: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  buttonPressable: {
    width: '48.3%',
  },
  actionButton: {
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actionButtonGhost: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.42)',
    backgroundColor: 'rgba(15, 23, 42, 0.46)',
  },
  actionButtonPrimary: {
    backgroundColor: '#2563eb',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.34,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  primaryGradientStart: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#2563eb',
    opacity: 0.96,
  },
  primaryGradientEnd: {
    position: 'absolute',
    right: -18,
    top: -4,
    bottom: -4,
    width: '62%',
    borderRadius: 999,
    backgroundColor: '#8b5cf6',
    opacity: 0.94,
  },
  actionButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  actionButtonTextPrimary: {
    color: '#ffffff',
  },
});
