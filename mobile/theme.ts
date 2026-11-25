import { StyleSheet } from 'react-native';
export const colors = {
  background: '#FAFAFB', surface: '#FFFFFF', ink: '#182233', muted: '#606C7D',
  green: '#BD410B', light: '#FFF2E9', line: '#E6E8EC', amber: '#9B5D1B', danger: '#AA3838',
};
export const ui = StyleSheet.create({
  page: { padding: 14, gap: 12, paddingBottom: 36, width: '100%', maxWidth: 1280, alignSelf: 'center' },
  masthead: {backgroundColor:'#FFFFFF',borderRadius:12,overflow:'hidden',flexDirection:'row',alignItems:'stretch'},
  mastheadCopy: {flex:1,justifyContent:'center',padding:18,gap:4},
  title: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -1 },
  heading: { fontSize: 19, fontWeight: '700', color: colors.ink },
  text: { fontSize: 16, color: colors.ink, lineHeight: 25 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 22 },
  label: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 2 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.line, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: colors.ink, minHeight: 48 },
  error: { fontSize: 14, lineHeight: 22, color: colors.danger },
});
