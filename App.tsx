import { DesktopLayout } from './mobile/components/LayoutScrollView';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppProvider, useApp } from './mobile/state/AppProvider';
import { PantryScreen } from './mobile/screens/PantryScreen';
import { RecipesScreen } from './mobile/screens/RecipesScreen';
import { RecipeDetail } from './mobile/screens/RecipeDetail';
import { CommunityScreen } from './mobile/screens/CommunityScreen';
import { Button } from './mobile/components/ui';
import { GuideCard } from './mobile/components/GuideCard';
import { colors, ui } from './mobile/theme';
import type { Recipe, Tab } from './mobile/types';

const tabs: { value: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'pantry', label: '내 냉장고', icon: 'leaf-outline' }, { value: 'recipes', label: '레시피', icon: 'restaurant-outline' },
  { value: 'saved', label: '저장', icon: 'bookmark-outline' }, { value: 'community', label: '커뮤니티', icon: 'people-outline' },
];
function Main() {
  const app = useApp();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<'auto' | 'mobile' | 'pc'>('auto');
  const wide = mode === 'pc' || (mode === 'auto' && width >= 850);
  const compactRail = wide && width < 850;
  const [search,setSearch] = useState('');
  const [submitted,setSubmitted] = useState('');
  const grid = wide && width >= 960;
  if (!app.ready) return <SafeAreaView style={[s.root, { justifyContent: 'center', padding: 30, gap: 20 }]}>
    {app.storageError ? <><Text style={ui.error}>{app.storageError}</Text><Button onPress={() => void app.hydrate()}>다시 읽기</Button></> : <ActivityIndicator color={colors.green} size="large" />}
  </SafeAreaView>;
  const navigation = <View accessibilityRole="tablist" style={wide ? [s.topNav, compactRail && { width: 58, padding: 4 }] : s.bottom}>{tabs.map(tab => <Pressable key={tab.value} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: app.tab === tab.value }}
    onPress={() => app.setTab(tab.value)} style={[s.navItem, wide && !compactRail && s.navWide, compactRail && { flex: 0 }, app.tab === tab.value && s.navSelected]}>
    <Ionicons name={tab.icon} size={22} color={app.tab === tab.value ? colors.green : colors.muted} />{!compactRail && <Text style={{ fontSize: 12, color: app.tab === tab.value ? colors.green : colors.muted, fontWeight: app.tab === tab.value ? '700' : '400' }}>{tab.label}{tab.value === 'saved' && app.saved.length ? ` ${app.saved.length}` : ''}</Text>}
  </Pressable>)}</View>;
  return <DesktopLayout.Provider value={wide}><SafeAreaView style={[s.root, mode === "mobile" && { width: "100%", maxWidth: 480, alignSelf: "center" }]} edges={['top', 'left', 'right', 'bottom']}>
    <StatusBar style="dark" />
    <View style={s.header}><View style={ui.row}><Text style={{ fontSize: 24, fontWeight: '800', color: colors.green, letterSpacing: -1 }}>한끼</Text></View>
      {grid && navigation}
      {grid && <TextInput accessibilityLabel="재료나 메뉴로 검색" placeholder="재료나 메뉴로 검색" value={search} onChangeText={setSearch} onSubmitEditing={()=>{setSubmitted(search.trim());app.setTab('recipes');}} style={[ui.input,{flex:1,maxWidth:480,minHeight:38,paddingVertical:6,borderRadius:24,backgroundColor:'#F8F9FA'}]}/>}
      <View style={{flexDirection:'row', gap:2,backgroundColor:colors.surface,borderRadius:10,padding:2}}>{([['auto','자동'],['mobile','모바일'],['pc','PC']] as const).map(([value,label]) =>
        <Pressable key={value} accessibilityRole="button" accessibilityLabel={label + ' 화면'} accessibilityState={{selected:mode === value}} onPress={() => setMode(value)}
          style={{minHeight:44, justifyContent:'center', paddingHorizontal:10, borderRadius:10, backgroundColor:mode === value ? colors.light : colors.surface}}>
          <Text style={{color:mode === value ? colors.green : colors.muted, fontWeight:mode === value ? '700' : '400'}}>{label}</Text>
        </Pressable>)}</View></View>
    {!app.guideModalOpen && !grid && <GuideCard />}
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
        {wide && !grid && navigation}
        <View style={{ flex: 1, minWidth: 0 }}>
          {app.tab === 'pantry' && <PantryScreen />}
          {app.tab === 'recipes' && <RecipesScreen initialQuery={submitted} wide={grid} key={`recipes-${app.results.length ? 'personal' : 'catalog'}`} onOpen={value => { app.tutorialEvent('recipeOpened'); setRecipe(value); }} />}
          {app.tab === 'saved' && <RecipesScreen wide={grid} savedOnly onOpen={value => { app.tutorialEvent('recipeOpened'); setRecipe(value); }} />}
          {app.tab === 'community' && <CommunityScreen />}
        </View>
        {grid && !app.guideModalOpen && <View style={{width:'28%',maxWidth:370,paddingTop:24,paddingRight:20}}><GuideCard/></View>}
        {!wide && navigation}
      </View>
    </KeyboardAvoidingView>
    {!!app.notice && <Pressable accessibilityRole="alert" onPress={() => app.setNotice('')} style={s.notice}><Text style={{ color: 'white', fontSize: 14, lineHeight: 22 }}>{app.notice}</Text></Pressable>}
    {recipe && <RecipeDetail recipe={recipe} onClose={() => setRecipe(null)} />}
  </SafeAreaView></DesktopLayout.Provider>;
}
export default function App() { return <SafeAreaProvider><AppProvider><Main /></AppProvider></SafeAreaProvider>; }
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 6, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  logo: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  bottom: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line, backgroundColor: 'white', padding: 4, gap: 4 },
  topNav: {flexDirection:"row", alignItems:"center"},
  rail: { width: 152, backgroundColor: 'white', borderRightWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  navItem: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12 },
  navWide: { flex: 0, flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 14, gap: 12 },
  navSelected: { backgroundColor: colors.light },
  notice: { position: 'absolute', left: 20, right: 20, bottom: 88, borderRadius: 14, backgroundColor: colors.ink, padding: 16, maxWidth: 600, alignSelf: 'center' },
});
