import { StyleSheet } from 'react-native';
/*
 * Toss-style system in green: grey canvas, white rounded blocks, large bold headings, borderless lists, big bottom buttons.
 * Contrast: white on `green` 5.0:1, `muted` on white 4.6:1.
 */
export const colors = {
  background: '#F2F4F6',
  surface: '#FFFFFF',
  ink: '#191F28',
  sub: '#4E5968',
  muted: '#6B7684',
  green: '#15803D',
  bright: '#22C55E',
  light: '#E8F7EE',
  line: '#E5E8EB',
  fill: '#F2F4F6',
  amber: '#B45309',
  danger: '#D92D20',
  hot: '#C2410C',
  // Kept for older call sites.
  tint: '#E8F7EE',
  fresh: '#15803D',
  hero: '#F2F4F6',
};
export const radius = { card: 20, button: 14, chip: 18, thumb: 12 };
export const ui = StyleSheet.create({
  page: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  masthead: { gap: 4 },
  mastheadCopy: { gap: 4 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  text: { fontSize: 16, color: colors.ink, lineHeight: 24 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  label: { fontSize: 15, fontWeight: '600', color: colors.ink, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 20, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  input: {
    borderRadius: radius.button,
    backgroundColor: colors.fill,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.ink,
    minHeight: 52,
  },
  error: { fontSize: 14, lineHeight: 20, color: colors.danger },
  divider: { height: 1, backgroundColor: colors.line },
});
