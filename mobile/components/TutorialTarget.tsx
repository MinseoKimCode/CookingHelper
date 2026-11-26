import React, { type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { useApp } from '../state/AppProvider';
import { type TutorialTarget as Target } from '../tutorial';
import { colors } from '../theme';

export function TutorialTarget({
  target,
  children,
  onLayout,
}: {
  target: Target;
  children: ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const { tutorial } = useApp();
  const highlighted = tutorial?.id === target;
  return (
    <View
      testID={`tutorial-target-${target}`}
      onLayout={onLayout}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: highlighted ? colors.green : 'transparent',
        paddingLeft: 10,
      }}
    >
      {children}
    </View>
  );
}
