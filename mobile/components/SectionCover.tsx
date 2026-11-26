import React from 'react';
import { Text, View } from 'react-native';
import type Ionicons from '@expo/vector-icons/Ionicons';
import { ui } from '../theme';

/** Plain page title; screens no longer open with a boxed banner. `image` and `icon` are accepted for older call sites. */
export function SectionCover({ title, detail }: {
  title: string; detail: string; image?: boolean; icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return <View style={{ gap: 4, paddingTop: 4 }}>
    <Text accessibilityRole="header" style={ui.title}>{title}</Text>
    <Text style={ui.muted}>{detail}</Text>
  </View>;
}
