import React, { type ReactNode } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { useApp } from '../state/AppProvider';
import { stepLabels, type TutorialTarget as Target } from '../tutorial';
import { colors } from '../theme';

export function TutorialTarget({ target, children, onLayout }: { target: Target; children: ReactNode; onLayout?: (event: LayoutChangeEvent) => void }) {
  const { tutorial } = useApp();
  const highlighted = tutorial?.id === target;
  return <View testID={`tutorial-target-${target}`} onLayout={onLayout} style={{ borderWidth: 2, borderColor: highlighted ? colors.green : 'transparent', borderRadius: 22, backgroundColor: highlighted ? colors.light : undefined, padding: highlighted ? 6 : 0, gap: 6 }}>
    {highlighted && <Text style={{ color: colors.green, fontSize: 13, fontWeight: '700', paddingHorizontal: 10 }}>지금 할 일 · {stepLabels[target]}</Text>}
    {children}
  </View>;
}
