import React, { createContext, useContext } from 'react';
import { ScrollView } from 'react-native';

export const DesktopLayout = createContext(true);

export function LayoutScrollView(props: React.ComponentPropsWithRef<typeof ScrollView>) {
  const desktop = useContext(DesktopLayout);
  return <ScrollView {...props} showsVerticalScrollIndicator={desktop} showsHorizontalScrollIndicator={desktop} />;
}
