import { ErrorBoundary } from './mobile/components/ErrorBoundary';
import { BrandLogo } from './mobile/components/BrandLogo';
import { DesktopLayout } from './mobile/components/LayoutScrollView';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppProvider, useApp } from './mobile/state/AppProvider';
import { PantryScreen } from './mobile/screens/PantryScreen';
import { RecipesScreen } from './mobile/screens/RecipesScreen';
import { RecipeDetail } from './mobile/screens/RecipeDetail';
import { CommunityScreen } from './mobile/screens/CommunityScreen';
import { KitchenScreen } from './mobile/screens/KitchenScreen';
import { Button } from './mobile/components/ui';
import { GuideCard } from './mobile/components/GuideCard';
import { colors, ui } from './mobile/theme';
import type { Recipe, Tab } from './mobile/types';

const tabs: { value: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'recipes', label: '홈', icon: 'home-outline' },
  { value: 'pantry', label: '내 냉장고', icon: 'leaf-outline' },
  { value: 'saved', label: '저장', icon: 'bookmark-outline' },
  { value: 'kitchen', label: '내 주방', icon: 'basket-outline' },
  { value: 'community', label: '커뮤니티', icon: 'people-outline' },
];
const modeLabels = { auto: '자동', mobile: '모바일', pc: 'PC' } as const;
const nextMode = { auto: 'mobile', mobile: 'pc', pc: 'auto' } as const;
function Main() {
  const app = useApp();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<'auto' | 'mobile' | 'pc'>('auto');
  const wide = mode === 'pc' || (mode === 'auto' && width >= 850);
  const compactRail = wide && width < 850;
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const grid = wide && width >= 960;
  const openShopping = (app.settings.shopping || []).filter((item) => !item.checked).length;
  if (!app.ready)
    return (
      <SafeAreaView style={[s.root, { justifyContent: 'center', padding: 30, gap: 20 }]}>
        {app.storageError ? (
          <>
            <Text style={ui.error}>{app.storageError}</Text>
            <Button onPress={() => void app.hydrate()}>다시 읽기</Button>
          </>
        ) : (
          <ActivityIndicator color={colors.green} size="large" />
        )}
      </SafeAreaView>
    );
  const navigation = (
    <View
      accessibilityRole="tablist"
      style={
        grid
          ? s.topNav
          : wide
            ? [s.rail, compactRail && { width: 64, paddingHorizontal: 6 }]
            : s.bottom
      }
    >
      {tabs.map((tab) => (
        <Pressable
          key={tab.value}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: app.tab === tab.value }}
          onPress={() => app.setTab(tab.value)}
          style={[
            s.navItem,
            wide && !compactRail && s.navWide,
            compactRail && { flex: 0 },
            app.tab === tab.value && s.navSelected,
          ]}
        >
          <Ionicons
            name={tab.icon}
            size={22}
            color={app.tab === tab.value ? colors.green : colors.muted}
          />
          {!compactRail && (
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 0,
                fontSize: 12,
                color: app.tab === tab.value ? colors.green : colors.muted,
                fontWeight: app.tab === tab.value ? '700' : '400',
              }}
            >
              {tab.label}
              {tab.value === 'saved' && app.saved.length ? ` ${app.saved.length}` : ''}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
  return (
    <DesktopLayout.Provider value={wide}>
      <SafeAreaView
        style={[s.root, mode === 'mobile' && { width: '100%', maxWidth: 480, alignSelf: 'center' }]}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <StatusBar style="dark" />
        <View style={s.header}>
          <BrandLogo />
          {grid && navigation}
          {grid && (
            <TextInput
              accessibilityLabel="재료나 메뉴로 검색"
              placeholder="재료나 메뉴로 검색"
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => {
                setSubmitted(search.trim());
                app.setTab('recipes');
              }}
              style={[
                ui.input,
                {
                  flex: 1,
                  maxWidth: 420,
                  minHeight: 40,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                },
              ]}
            />
          )}
          {!grid && <View style={{ flex: 1 }} />}
          {!grid && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="레시피 검색"
              accessibilityState={{ expanded: searchOpen }}
              onPress={() => setSearchOpen((value) => !value)}
              style={{
                minHeight: 40,
                minWidth: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
              }}
            >
              <Ionicons name={searchOpen ? 'close' : 'search'} size={20} color={colors.ink} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`장보기 리스트${openShopping ? ` ${openShopping}개` : ''}`}
            onPress={() => app.setTab('kitchen')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              minHeight: 40,
              paddingHorizontal: 10,
              borderRadius: 10,
            }}
          >
            <Ionicons name="bag-handle-outline" size={20} color={colors.ink} />
            {grid && <Text style={{ fontSize: 14, color: colors.ink }}>장보기</Text>}
            {openShopping > 0 && (
              <View
                style={{
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: colors.green,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>
                  {openShopping}
                </Text>
              </View>
            )}
          </Pressable>
          {/* Layout mode is a rarely used preference, so it is one small button that cycles 자동 → 모바일 → PC. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`화면 모드: ${modeLabels[mode]}. 눌러서 바꾸기`}
            onPress={() => setMode(nextMode[mode])}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              minHeight: 40,
              paddingHorizontal: 8,
              borderRadius: 10,
            }}
          >
            <Ionicons
              name={
                mode === 'mobile'
                  ? 'phone-portrait-outline'
                  : mode === 'pc'
                    ? 'desktop-outline'
                    : 'contract-outline'
              }
              size={18}
              color={colors.muted}
            />
            <Text style={{ fontSize: 12, color: colors.muted }}>{modeLabels[mode]}</Text>
          </Pressable>
        </View>
        {searchOpen && !grid && (
          <View
            style={{ backgroundColor: colors.background, paddingHorizontal: 16, paddingBottom: 6 }}
          >
            <TextInput
              autoFocus
              accessibilityLabel="재료나 메뉴로 검색"
              placeholder="재료나 메뉴로 검색 (예: 김치, 파스타)"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => {
                if (!search.trim()) return;
                setSubmitted(search.trim());
                app.setTab('recipes');
                setSearchOpen(false);
              }}
              style={[
                ui.input,
                { backgroundColor: colors.surface, minHeight: 44, paddingVertical: 10 },
              ]}
            />
          </View>
        )}
        {!app.guideModalOpen && !grid && <GuideCard />}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
            {wide && !grid && navigation}
            <View style={{ flex: 1, minWidth: 0 }}>
              {app.tab === 'pantry' && <PantryScreen />}
              {app.tab === 'recipes' && (
                <RecipesScreen
                  initialQuery={submitted}
                  wide={grid}
                  onOpen={(value) => {
                    app.tutorialEvent('recipeOpened');
                    setRecipe(value);
                  }}
                />
              )}
              {app.tab === 'saved' && (
                <RecipesScreen
                  wide={grid}
                  savedOnly
                  onOpen={(value) => {
                    app.tutorialEvent('recipeOpened');
                    setRecipe(value);
                  }}
                />
              )}
              {app.tab === 'kitchen' && <KitchenScreen />}
              {app.tab === 'community' && <CommunityScreen />}
            </View>
            {grid && !app.guideModalOpen && (
              <View style={{ width: '26%', maxWidth: 340, paddingTop: 16, paddingRight: 16 }}>
                <GuideCard variant="panel" />
              </View>
            )}
            {!wide && navigation}
          </View>
        </KeyboardAvoidingView>
        {!!app.notice && (
          <Pressable accessibilityRole="alert" onPress={() => app.setNotice('')} style={s.notice}>
            <Text style={{ color: 'white', fontSize: 14, lineHeight: 22 }}>{app.notice}</Text>
          </Pressable>
        )}
        {recipe && <RecipeDetail recipe={recipe} onClose={() => setRecipe(null)} />}
      </SafeAreaView>
    </DesktopLayout.Provider>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppProvider>
          <Main />
        </AppProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.background,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 2,
  },
  topNav: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  // Vertical menu for medium widths where the header has no room for tabs.
  rail: { width: 148, paddingHorizontal: 10, paddingTop: 12, gap: 2 },
  navItem: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 10,
  },
  navWide: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 10,
    gap: 6,
  },
  // Selection is shown by colour and weight alone; no filled pill behind the active tab.
  navSelected: {},
  notice: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 88,
    borderRadius: 14,
    backgroundColor: colors.ink,
    padding: 16,
    maxWidth: 600,
    alignSelf: 'center',
  },
});
