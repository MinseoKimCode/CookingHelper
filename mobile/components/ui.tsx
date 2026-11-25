import { LayoutScrollView } from './LayoutScrollView';
import React, { useEffect, useId, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, ui } from '../theme';
import { useApp } from '../state/AppProvider';
import { GuideCard } from './GuideCard';

export function Button({ children, onPress, secondary = false, busy = false, disabled = false, icon }: {
  children: string; onPress: () => void; secondary?: boolean; busy?: boolean; disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }}
    disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, { opacity: disabled || busy ? .5 : pressed ? .75 : 1 }]}>
    {busy ? <ActivityIndicator color={secondary ? colors.green : 'white'} /> : icon ? <Ionicons name={icon} size={19} color={secondary ? colors.green : 'white'} /> : null}
    <Text style={[s.buttonText, secondary && { color: colors.green }]}>{children}</Text>
  </Pressable>;
}
export function Choice<T extends string | number>({ options, value, onChange }: {
  options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void;
}) {
  return <View style={ui.row}>{options.map(option => <Pressable key={option.value} accessibilityRole="button"
    accessibilityState={{ selected: value === option.value }} onPress={() => onChange(option.value)}
    style={[s.choice, value === option.value && s.selected]}>
    <Text style={{ color: value === option.value ? colors.green : colors.muted, fontSize: 14, fontWeight: '600' }}>{option.label}</Text>
  </Pressable>)}</View>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted}
    {...props} style={[ui.input, props.multiline && { minHeight: 105, textAlignVertical: 'top' }, props.style]} /></View>;
}
export function Empty({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  return <View style={[ui.card, { paddingVertical: 36, alignItems: 'center' }]}><Ionicons name="leaf-outline" size={34} color={colors.green} />
    <Text style={ui.heading}>{title}</Text><Text style={[ui.muted, { textAlign: 'center' }]}>{message}</Text>{children}</View>;
}
export function Sheet({ visible, title, onClose, children, contentKey, focusEnd = false }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; contentKey?: string; focusEnd?: boolean }) {
  const { notice, setNotice, setGuideOverlay } = useApp();
  const overlayId = useId();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { setGuideOverlay(overlayId, visible); return () => setGuideOverlay(overlayId, false); }, [overlayId, visible, setGuideOverlay]);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => focusEnd ? scroll.current?.scrollToEnd({ animated: true }) : scroll.current?.scrollTo({ y: 0, animated: false }), 150);
    return () => clearTimeout(timer);
  }, [visible, contentKey, focusEnd]);
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={s.sheetHeader}><Text style={[ui.heading, { flex: 1 }]} numberOfLines={1}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} hitSlop={12}><Ionicons name="close" size={26} color={colors.ink} /></Pressable></View>
      {visible && <GuideCard navigationEnabled={false} />}
      <LayoutScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={ui.page}>{children}</LayoutScrollView>
      {!!notice && <Pressable accessibilityRole="alert" onPress={() => setNotice('')} style={{ backgroundColor: colors.ink, padding: 16 }}><Text style={{ color: 'white', fontSize: 14, lineHeight: 22 }}>{notice}</Text></Pressable>}
    </SafeAreaView>
  </Modal>;
}
const s = StyleSheet.create({
  button: { minHeight: 44, paddingVertical: 9, paddingHorizontal: 15, borderRadius: 13, backgroundColor: colors.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondary: { backgroundColor: colors.light }, buttonText: { fontSize: 15, fontWeight: '700', color: 'white' },
  choice: { paddingHorizontal: 15, paddingVertical: 11, backgroundColor: 'white', borderWidth: 1, borderColor: colors.line, borderRadius: 22 },
  selected: { backgroundColor: colors.light, borderColor: colors.green },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: 'white' },
});
