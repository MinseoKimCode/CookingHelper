import { LayoutScrollView } from './LayoutScrollView';
import React, { useEffect, useId, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, ui } from '../theme';
import { useSession } from '../state/AppProvider';
import { GuideCard } from './GuideCard';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * primary: filled green · secondary: light green · ghost: text only.
 * `large` is the 56px Toss-style call to action; `small` is for inline actions.
 */
export function Button({
  children,
  onPress,
  secondary = false,
  ghost = false,
  small = false,
  large = false,
  busy = false,
  disabled = false,
  icon,
}: {
  children: string;
  onPress: () => void;
  secondary?: boolean;
  ghost?: boolean;
  small?: boolean;
  large?: boolean;
  busy?: boolean;
  disabled?: boolean;
  icon?: IconName;
}) {
  const tone = ghost || secondary ? colors.green : 'white';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        large && s.large,
        small && s.small,
        secondary && s.secondary,
        ghost && s.ghost,
        { opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={tone} />
      ) : icon ? (
        <Ionicons name={icon} size={small ? 16 : 19} color={tone} />
      ) : null}
      <Text
        style={[
          s.buttonText,
          large && { fontSize: 17 },
          small && { fontSize: 14 },
          { color: tone },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

/** Pill choices. `scroll` keeps them on one swipeable line instead of wrapping. */
export function Choice<T extends string | number>({
  options,
  value,
  onChange,
  scroll = false,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  scroll?: boolean;
}) {
  const pills = options.map((option) => {
    const selected = value === option.value;
    return (
      <Pressable
        key={option.value}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onChange(option.value)}
        style={[s.choice, selected && s.selected]}
      >
        <Text
          style={{
            color: selected ? 'white' : colors.sub,
            fontSize: 14,
            fontWeight: selected ? '700' : '500',
          }}
        >
          {option.label}
        </Text>
      </Pressable>
    );
  });
  return scroll ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 8 }}
    >
      {pills}
    </ScrollView>
  ) : (
    <View style={ui.row}>{pills}</View>
  );
}

/** Segmented control: a grey track with a white thumb on the selected option. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: colors.line, borderRadius: 12, padding: 3 }}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 9,
              borderRadius: 10,
              backgroundColor: selected ? colors.surface : 'transparent',
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14,
                fontWeight: selected ? '700' : '500',
                color: selected ? colors.ink : colors.muted,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A white rounded block with its title inside — the basic unit of every screen. */
export function Section({
  title,
  detail,
  action,
  onAction,
  children,
  onLayout,
  flat = false,
}: {
  title?: string;
  detail?: string;
  action?: string;
  onAction?: () => void;
  children?: ReactNode;
  flat?: boolean;
  onLayout?: (event: { nativeEvent: { layout: { y: number } } }) => void;
}) {
  return (
    <View onLayout={onLayout} style={flat ? { gap: 12 } : ui.card}>
      {!!title && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text accessibilityRole="header" style={[ui.heading, { fontSize: 19 }]}>
              {title}
            </Text>
            {!!detail && <Text style={ui.muted}>{detail}</Text>}
          </View>
          {action && onAction && (
            <Pressable
              accessibilityRole="button"
              onPress={onAction}
              hitSlop={10}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Text style={{ color: colors.muted, fontSize: 14 }}>{action}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

/** Borderless list row: leading icon or image, title and caption, optional trailing text and chevron. */
export function ListRow({
  title,
  caption,
  image,
  icon,
  iconColor,
  trailing,
  onPress,
  chevron = true,
  badge,
}: {
  title: string;
  caption?: string;
  image?: string;
  icon?: IconName;
  iconColor?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  badge?: string;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={title}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: pressed ? colors.fill : 'transparent',
      })}
    >
      {image ? (
        <Image
          source={{ uri: image }}
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.thumb,
            backgroundColor: colors.fill,
          }}
        />
      ) : icon ? (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: iconColor ? iconColor + '22' : colors.light,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={20} color={iconColor || colors.green} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[ui.label, { fontSize: 16, flexShrink: 1 }]} numberOfLines={1}>
            {title}
          </Text>
          {!!badge && (
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: colors.green,
                backgroundColor: colors.light,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 2,
                overflow: 'hidden',
              }}
            >
              {badge}
            </Text>
          )}
        </View>
        {!!caption && (
          <Text style={[ui.muted, { fontSize: 13 }]} numberOfLines={1}>
            {caption}
          </Text>
        )}
      </View>
      {trailing}
      {chevron && onPress && <Ionicons name="chevron-forward" size={18} color={colors.line} />}
    </Pressable>
  );
}

/** In-screen page header with a back button, used when a tab pushes a sub-page. */
export function PageHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="뒤로"
        onPress={onBack}
        hitSlop={10}
        style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="chevron-back" size={24} color={colors.ink} />
      </Pressable>
      <Text accessibilityRole="header" style={[ui.heading, { flex: 1 }]} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[ui.muted, { fontWeight: '600', color: colors.sub }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          ui.input,
          props.multiline && { minHeight: 100, textAlignVertical: 'top' },
          props.style,
        ]}
      />
    </View>
  );
}
export function Empty({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <View style={{ paddingVertical: 28, alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.light,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="leaf" size={26} color={colors.green} />
      </View>
      <Text style={[ui.label, { fontSize: 17 }]}>{title}</Text>
      <Text style={[ui.muted, { textAlign: 'center', maxWidth: 300 }]}>{message}</Text>
      {children}
    </View>
  );
}
export function Sheet({
  visible,
  title,
  onClose,
  children,
  contentKey,
  focusEnd = false,
  scrollTarget,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  contentKey?: string;
  focusEnd?: boolean;
  scrollTarget?: { y: number } | null;
  footer?: ReactNode;
}) {
  const { notice, setNotice, setGuideOverlay } = useSession();
  const overlayId = useId();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    setGuideOverlay(overlayId, visible);
    return () => setGuideOverlay(overlayId, false);
  }, [overlayId, visible, setGuideOverlay]);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(
      () =>
        focusEnd
          ? scroll.current?.scrollToEnd({ animated: true })
          : scroll.current?.scrollTo({ y: 0, animated: false }),
      150,
    );
    return () => clearTimeout(timer);
  }, [visible, contentKey, focusEnd]);
  useEffect(() => {
    if (scrollTarget)
      scroll.current?.scrollTo({ y: Math.max(0, scrollTarget.y - 8), animated: true });
  }, [scrollTarget]);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={s.sheetHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={onClose}
            hitSlop={12}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-down" size={24} color={colors.ink} />
          </Pressable>
          <Text
            style={[ui.label, { flex: 1, fontSize: 17, textAlign: 'center' }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <View style={{ width: 36 }} />
        </View>
        {visible && <GuideCard navigationEnabled={false} />}
        <LayoutScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[ui.page, { maxWidth: 680 }]}
        >
          {children}
        </LayoutScrollView>
        {footer && (
          <View style={s.footer}>
            <View style={{ width: '100%', maxWidth: 680, alignSelf: 'center' }}>{footer}</View>
          </View>
        )}
        {!!notice && (
          <Pressable
            accessibilityRole="alert"
            onPress={() => setNotice('')}
            style={[s.toast, { bottom: footer ? 96 : 24 }]}
          >
            <Text style={{ color: 'white', fontSize: 15, lineHeight: 22 }}>{notice}</Text>
          </Pressable>
        )}
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.button,
    backgroundColor: colors.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  large: { minHeight: 56, borderRadius: 16 },
  small: { minHeight: 36, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10 },
  secondary: { backgroundColor: colors.light },
  ghost: { backgroundColor: 'transparent', paddingHorizontal: 6 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  choice: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.fill,
    borderRadius: radius.chip,
  },
  selected: { backgroundColor: colors.green },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: colors.background,
  },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 90,
    borderRadius: 16,
    backgroundColor: 'rgba(25,31,40,0.94)',
    padding: 16,
    maxWidth: 560,
    alignSelf: 'center',
  },
});
