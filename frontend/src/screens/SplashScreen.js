import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');
const APP_NAME = 'noteKit';
const PARTICLE_GLYPHS = ['0', '1', '2', '3', '5', '7', '8', 'A', 'C', 'D', 'E', 'K', 'N', 'T', 'X', 'Y'];

const PARTICLES = Array.from({ length: 20 }, (_, index) => ({
  id: `particle-${index}`,
  glyph: PARTICLE_GLYPHS[index % PARTICLE_GLYPHS.length],
  left: (index * 53) % width,
  top: (index * 71) % height,
  size: 12 + (index % 4) * 3,
  duration: 12000 + (index % 5) * 1600,
  delay: index * 180,
  driftX: index % 2 === 0 ? 18 : -16,
}));

const FLOW_LINES = Array.from({ length: 5 }, (_, index) => ({
  id: `line-${index}`,
  top: 100 + index * 110,
  width: width * (0.46 + index * 0.08),
  duration: 8500 + index * 1200,
  delay: index * 260,
  rotate: `${-18 + index * 9}deg`,
}));

function FloatingParticle({ item }) {
  const drift = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(item.delay),
        Animated.timing(drift, {
          toValue: 1,
          duration: item.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: item.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 0.28,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0.1,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [drift, item.delay, item.duration, shimmer]);

  return (
    <Animated.Text
      style={[
        styles.particle,
        {
          left: item.left,
          top: item.top,
          fontSize: item.size,
          opacity: shimmer,
          transform: [
            {
              translateY: drift.interpolate({
                inputRange: [0, 1],
                outputRange: [18, -24],
              }),
            },
            {
              translateX: drift.interpolate({
                inputRange: [0, 1],
                outputRange: [0, item.driftX],
              }),
            },
          ],
        },
      ]}
    >
      {item.glyph}
    </Animated.Text>
  );
}

function FlowLine({ item }) {
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(item.delay),
        Animated.timing(sweep, {
          toValue: 1,
          duration: item.duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: item.duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [item.delay, item.duration, sweep]);

  return (
    <Animated.View
      style={[
        styles.flowLine,
        {
          top: item.top,
          width: item.width,
          opacity: sweep.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.06, 0.2, 0.08],
          }),
          transform: [
            { rotate: item.rotate },
            {
              translateX: sweep.interpolate({
                inputRange: [0, 1],
                outputRange: [-44, 44],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function Letter({ letter, index, pulse }) {
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: 480,
      delay: 250 + index * 110,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, reveal]);

  return (
    <Animated.Text
      style={[
        styles.brandLetter,
        {
          opacity: reveal,
          transform: [
            {
              translateY: reveal.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 0],
              }),
            },
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.02],
              }),
            },
          ],
        },
      ]}
    >
      {letter}
    </Animated.Text>
  );
}

export default function SplashScreen({ visible = true, onFadeComplete }) {
  const fade = useRef(new Animated.Value(1)).current;
  const corePulse = useRef(new Animated.Value(0)).current;
  const textPulse = useRef(new Animated.Value(0)).current;
  const visibleRef = useRef(visible);
  const letters = useMemo(() => APP_NAME.split(''), []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(corePulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(corePulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(textPulse, {
          toValue: 1,
          duration: 1800,
          delay: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(textPulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [corePulse, textPulse]);

  useEffect(() => {
    if (visibleRef.current && !visible) {
      Animated.timing(fade, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && onFadeComplete) {
          onFadeComplete();
        }
      });
    }
    visibleRef.current = visible;
  }, [fade, onFadeComplete, visible]);

  return (
    <Animated.View pointerEvents="none" style={[styles.container, { opacity: fade }]}>
      <View style={styles.background}>
        <View style={styles.baseLayer} />
        <View style={styles.gradientLayerTop} />
        <View style={styles.gradientLayerBottom} />
        <Animated.View
          style={[
            styles.coreGlow,
            {
              transform: [
                {
                  scale: corePulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1.08],
                  }),
                },
              ],
              opacity: corePulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.16, 0.3],
              }),
            },
          ]}
        />
        <View style={styles.secondaryGlow} />
      </View>

      {FLOW_LINES.map((item) => (
        <FlowLine key={item.id} item={item} />
      ))}
      {PARTICLES.map((item) => (
        <FloatingParticle key={item.id} item={item} />
      ))}

      <View style={styles.centerWrap}>
        <Image source={require('../theme/notekit_icon.jpeg')} style={styles.logo} resizeMode="cover" />
        <View style={styles.wordmarkRow}>
          {letters.map((letter, index) => (
            <Letter key={`${letter}-${index}`} letter={letter} index={index} pulse={textPulse} />
          ))}
        </View>
        <Text style={styles.tagline}>Initializing your intelligent productivity workspace</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: '#0b0f1a',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  baseLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b0f1a',
  },
  gradientLayerTop: {
    position: 'absolute',
    top: -height * 0.18,
    left: -width * 0.18,
    width: width * 0.95,
    height: height * 0.5,
    borderRadius: 240,
    backgroundColor: '#111827',
    opacity: 0.92,
  },
  gradientLayerBottom: {
    position: 'absolute',
    right: -width * 0.28,
    bottom: -height * 0.1,
    width: width * 1.08,
    height: height * 0.52,
    borderRadius: 280,
    backgroundColor: '#1a1f2e',
    opacity: 0.96,
  },
  coreGlow: {
    position: 'absolute',
    alignSelf: 'center',
    top: '34%',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#3b82f6',
    opacity: 0.18,
  },
  secondaryGlow: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: '#1d4ed8',
    opacity: 0.08,
  },
  flowLine: {
    position: 'absolute',
    height: 1,
    borderRadius: 999,
    backgroundColor: '#7dd3fc',
    shadowColor: '#93c5fd',
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  particle: {
    position: 'absolute',
    color: '#dbeafe',
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logo: {
    width: 92,
    height: 92,
    borderRadius: 28,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(191, 219, 254, 0.18)',
    shadowColor: '#60a5fa',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: {
    color: '#f8fafc',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(125, 211, 252, 0.36)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  tagline: {
    marginTop: 12,
    color: 'rgba(226, 232, 240, 0.72)',
    fontSize: 13,
    letterSpacing: 0.7,
    textAlign: 'center',
  },
});
