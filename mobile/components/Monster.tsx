import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Image,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { MonsterMood } from '../guide';

const body = require('../../assets/mascot/body.png');
const chef = require('../../assets/mascot/chef.png');
const driver = Platform.OS !== 'web';

// Reuse the original character's textured body/hat/hands; animate the rig, not a flat PNG.
export function Monster({
  mood = 'idle',
  size = 108,
  active = true,
  replay = 0,
}: {
  mood?: MonsterMood;
  size?: number;
  active?: boolean;
  replay?: number;
}) {
  const breath = useRef(new Animated.Value(0)).current;
  const motion = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const [reducedMotion, setReducedMotion] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReducedMotion(value);
      })
      .catch(() => {
        /* Keep static if unavailable. */
      });
    const reduce = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const visibility = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => {
      alive = false;
      reduce?.remove();
      visibility.remove();
    };
  }, []);
  useEffect(() => {
    breath.setValue(0);
    motion.setValue(0);
    blink.setValue(1);
    if (!active || reducedMotion || !foreground) return;
    const timing = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, {
        toValue,
        duration,
        useNativeDriver: driver,
        isInteraction: false,
        easing: Easing.inOut(Easing.sin),
      });
    const duration = {
      idle: 1800,
      listening: 800,
      thinking: 550,
      scanning: 1200,
      cooking: 650,
      happy: 340,
      puzzled: 1000,
    }[mood];
    const breathing = Animated.loop(
      Animated.sequence([timing(breath, 1, 1600), timing(breath, 0, 1600)]),
    );
    const action = Animated.loop(
      Animated.sequence([timing(motion, 1, duration), timing(motion, 0, duration)]),
    );
    const blinking = Animated.loop(
      Animated.sequence([
        Animated.delay(3300),
        timing(blink, 0.07, 85),
        timing(blink, 1, 130),
        Animated.delay(1500),
      ]),
    );
    breathing.start();
    action.start();
    blinking.start();
    return () => {
      breathing.stop();
      action.stop();
      blinking.stop();
      breath.setValue(0);
      motion.setValue(0);
      blink.setValue(1);
    };
  }, [mood, active, reducedMotion, foreground, replay, breath, motion, blink]);
  const tween = (a: number, b: number) =>
    motion.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  const rotate = (a: number, b: number) =>
    motion.interpolate({ inputRange: [0, 1], outputRange: [`${a}deg`, `${b}deg`] });
  const happy = mood === 'happy',
    puzzled = mood === 'puzzled';
  const handRotation =
    mood === 'idle'
      ? '0deg'
      : mood === 'listening'
        ? rotate(-20, -43)
        : happy
          ? rotate(-30, 25)
          : mood === 'thinking'
            ? rotate(-8, 8)
            : rotate(-4, 10);
  return (
    <View
      testID={`monster-${mood}`}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: size, height: size, overflow: 'visible' }}
    >
      <View
        style={{
          position: 'absolute',
          width: 200,
          height: 200,
          left: (size - 200) / 2,
          top: (size - 200) / 2,
          transform: [{ scale: size / 200 }],
        }}
      >
        <Animated.View
          style={[
            s.shadow,
            {
              opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.13, 0.09] }),
              transform: [
                { scaleX: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            s.rig,
            {
              transform: [
                {
                  translateY: happy
                    ? tween(-2, -10)
                    : breath.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }),
                },
                { rotate: mood === 'idle' ? '0deg' : puzzled ? rotate(-4, 4) : rotate(-0.7, 0.7) },
              ],
            },
          ]}
        >
          <Image source={body} style={s.full} />
          <Animated.View style={[s.hat, { transform: [{ rotate: rotate(-2, 2) }] }]}>
            <Image source={chef} style={[s.full, { left: -52 }]} />
          </Animated.View>
          {[64, 114].map((left, index) => (
            <Animated.View
              key={left}
              style={[
                s.eye,
                { left, transform: [{ scaleY: blink }, { rotate: `${index ? -9 : 9}deg` }] },
              ]}
            >
              <Animated.View
                style={[
                  s.pupil,
                  {
                    transform: [
                      {
                        translateX:
                          mood === 'thinking' || mood === 'scanning'
                            ? tween(-2, 2)
                            : tween(-0.4, 0.7),
                      },
                      { translateY: mood === 'cooking' ? 2 : 0 },
                    ],
                  },
                ]}
              >
                <View style={s.glint} />
                <View style={s.glintSmall} />
              </Animated.View>
            </Animated.View>
          ))}
          <View style={[s.mouth, happy && s.happyMouth, puzzled && s.puzzledMouth]} />
          {[32, 132].map((left, index) => (
            <Animated.View
              key={left}
              style={[
                s.hand,
                {
                  left,
                  transform: [
                    {
                      translateY: happy
                        ? tween(-6, -15)
                        : mood === 'thinking'
                          ? tween(index ? 3 : 0, index ? 0 : 3)
                          : mood === 'listening' && index === 0
                            ? -9
                            : 0,
                    },
                    { rotate: index && mood === 'cooking' ? rotate(-25, 20) : handRotation },
                  ],
                },
              ]}
            >
              <Image source={chef} style={[s.full, { left: -left, top: -116 }]} />
            </Animated.View>
          ))}
          {mood === 'thinking' && (
            <View style={s.laptop}>
              {[0, 1, 2].map((index) => (
                <Animated.View
                  key={index}
                  style={{
                    height: 3,
                    width: index === 1 ? 36 : 55,
                    borderRadius: 2,
                    backgroundColor: '#5A926C',
                    opacity: tween(0.35, 1),
                  }}
                />
              ))}
              <View style={s.laptopBase} />
            </View>
          )}
          {mood === 'scanning' && (
            <Animated.View
              style={[
                s.lens,
                { transform: [{ translateX: tween(2, -8) }, { translateY: tween(-5, 8) }] },
              ]}
            >
              <View style={s.lensHandle} />
            </Animated.View>
          )}
          {mood === 'cooking' && (
            <>
              <Animated.View
                style={[
                  s.spoon,
                  { transform: [{ rotate: rotate(-25, 15) }, { translateX: tween(-4, 5) }] },
                ]}
              >
                <View style={s.spoonHead} />
              </Animated.View>
              <View style={s.pot}>
                <View style={s.potLeft} />
                <View style={s.potRight} />
              </View>
              {[67, 88, 109].map((left, index) => (
                <Animated.View
                  key={left}
                  style={[
                    s.steam,
                    {
                      left,
                      opacity: tween(index === 1 ? 0.8 : 0.15, index === 1 ? 0.15 : 0.8),
                      transform: [{ translateY: tween(0, -12) }],
                    },
                  ]}
                />
              ))}
            </>
          )}
          {happy && (
            <Animated.View
              style={[
                s.sparkles,
                { opacity: tween(0.35, 1), transform: [{ scale: tween(0.85, 1.15) }] },
              ]}
            >
              <Ionicons name="sparkles" size={28} color="#DCA45D" />
            </Animated.View>
          )}
          {puzzled && (
            <View style={s.question}>
              <Ionicons name="help" size={25} color="#507E60" />
            </View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  rig: { width: 200, height: 200, position: 'absolute' },
  full: { position: 'absolute', width: 200, height: 200, top: 0, left: 0 },
  shadow: {
    position: 'absolute',
    left: 38,
    top: 190,
    width: 124,
    height: 9,
    backgroundColor: '#236448',
    borderRadius: 80,
  },
  hat: { position: 'absolute', left: 52, top: 0, width: 96, height: 58, overflow: 'hidden' },
  eye: {
    position: 'absolute',
    top: 82,
    width: 22,
    height: 25,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#FFF3DF',
  },
  pupil: {
    position: 'absolute',
    left: 2,
    top: 0,
    width: 20,
    height: 25,
    borderRadius: 12,
    backgroundColor: '#39232C',
  },
  glint: {
    position: 'absolute',
    left: 4,
    top: 3,
    width: 6,
    height: 6,
    borderRadius: 5,
    backgroundColor: 'white',
  },
  glintSmall: {
    position: 'absolute',
    right: 3,
    top: 10,
    width: 2,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'white',
  },
  mouth: {
    position: 'absolute',
    left: 90,
    top: 99,
    width: 20,
    height: 8,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: '#8E4454',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  happyMouth: { height: 13, backgroundColor: '#914756' },
  puzzledMouth: {
    left: 95,
    width: 9,
    height: 9,
    borderRadius: 6,
    borderTopWidth: 2,
    backgroundColor: 'transparent',
  },
  hand: {
    position: 'absolute',
    top: 116,
    width: 36,
    height: 32,
    overflow: 'hidden',
    borderRadius: 22,
  },
  laptop: {
    position: 'absolute',
    left: 50,
    top: 134,
    width: 100,
    height: 48,
    borderWidth: 3,
    borderColor: '#87B596',
    borderRadius: 7,
    backgroundColor: '#D4EBDC',
    padding: 8,
    gap: 5,
  },
  laptopBase: {
    position: 'absolute',
    left: -8,
    bottom: -5,
    height: 5,
    width: 110,
    borderRadius: 6,
    backgroundColor: '#61876E',
  },
  lens: {
    position: 'absolute',
    left: 142,
    top: 99,
    width: 42,
    height: 42,
    borderRadius: 24,
    borderWidth: 5,
    borderColor: '#7CAF8C',
    backgroundColor: '#E8FFF155',
  },
  lensHandle: {
    position: 'absolute',
    left: 30,
    top: 29,
    width: 7,
    height: 23,
    borderRadius: 5,
    backgroundColor: '#528462',
    transform: [{ rotate: '-35deg' }],
  },
  pot: {
    position: 'absolute',
    left: 60,
    top: 146,
    width: 80,
    height: 35,
    backgroundColor: '#477453',
    borderTopWidth: 5,
    borderColor: '#A3C9AF',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  potLeft: {
    position: 'absolute',
    left: -12,
    top: 2,
    width: 13,
    height: 12,
    borderWidth: 4,
    borderColor: '#507E60',
    borderRadius: 5,
  },
  potRight: {
    position: 'absolute',
    right: -12,
    top: 2,
    width: 13,
    height: 12,
    borderWidth: 4,
    borderColor: '#507E60',
    borderRadius: 5,
  },
  spoon: {
    position: 'absolute',
    left: 124,
    top: 119,
    width: 6,
    height: 39,
    backgroundColor: '#B38452',
    borderRadius: 4,
  },
  spoonHead: {
    position: 'absolute',
    top: -7,
    left: -4,
    width: 14,
    height: 17,
    borderRadius: 10,
    backgroundColor: '#D5AA73',
  },
  steam: {
    position: 'absolute',
    top: 124,
    height: 17,
    width: 5,
    borderLeftWidth: 2,
    borderColor: '#92B69D',
    borderRadius: 7,
  },
  sparkles: { position: 'absolute', left: 6, top: 35 },
  question: { position: 'absolute', right: 8, top: 50 },
});
