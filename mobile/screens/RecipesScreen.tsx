import { LayoutScrollView } from '../components/LayoutScrollView';
import { VideoRecipes } from './VideoRecipes';
import { SectionCover } from '../components/SectionCover';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { Button, Choice, Empty } from '../components/ui';
import { RecipeCard } from '../components/RecipeCard';
import { useApp } from '../state/AppProvider';
import { api } from '../services/api';
import { useGuideActivity } from '../hooks/useGuideActivity';
import { colors, ui } from '../theme';
import { cuisineOptions, filterOptions, missingCount, type Cuisine, type Filter, type Recipe } from '../types';

export function RecipesScreen({ initialQuery = "", wide, savedOnly = false, onOpen }: { initialQuery?: string; wide: boolean; savedOnly?: boolean; onOpen: (recipe: Recipe) => void }) {
  const app = useApp();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  useEffect(()=>setQuery(initialQuery),[initialQuery]);
  const [source, setSource] = useState<'personal' | 'catalog' | 'video'>(app.results.length ? 'personal' : 'catalog');
  const [cuisine, setCuisine] = useState<Cuisine>('all');
  const [filter, setFilter] = useState<Filter>('all');
  const [catalog, setCatalog] = useState<Recipe[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useGuideActivity(!savedOnly && source === 'catalog' && busy ? { mood: 'thinking', title: '함께 둘러볼 메뉴를 찾고 있어요', message: '선택한 요리 종류와 필터에 맞는 메뉴를 찾는 중이에요.', priority: 80 } :
    error ? { mood: 'puzzled', title: '목록을 불러오지 못했어요', message: '아래 다시 불러오기를 눌러주세요. 재료와 설정은 그대로 두었어요.', priority: 65 } : null);
  const requestVersion = useRef(0);
  const active = useRef<AbortController | null>(null);
  const settingsKey = JSON.stringify(app.settings);
  async function load(more = false) {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    const version = ++requestVersion.current; setBusy(true); setError('');
    try {
      const result = await api.recommend(app.settings, { mode: 'catalog', cuisine, filter, more,
        recentMenus: more ? catalog.map(r => r.name).slice(0, 120) : [], previousKeys: more ? catalog.flatMap(r => r.menuKey ? [r.menuKey] : []) : [] }, controller.signal);
      if (version !== requestVersion.current) return;
      setCatalog(current => more ? [...current, ...result.recipes.filter(r => !current.some(old => old.name === r.name))] : result.recipes);
      setMessage(result.message || '');
      if (more && !result.recipes.length) app.setNotice(result.message || '추가 메뉴가 없어요.');
    } catch (e) { if (version === requestVersion.current && !controller.signal.aborted) setError((e as Error).message); }
    finally { if (version === requestVersion.current) setBusy(false); }
  }
  useEffect(() => {
    if (!savedOnly && source === 'catalog') { setCatalog([]); void load(); }
    return () => { requestVersion.current++; active.current?.abort(); };
  }, [source, cuisine, filter, settingsKey, savedOnly]);
  const [minutes, setMinutes] = useState(0);
  const rows = (savedOnly ? app.saved : source === 'personal' ? app.results : catalog).filter(recipe => (!minutes || recipe.time <= minutes) && [recipe.name, ...(recipe.ingredients || []).map(item => item.name)].some(name => name.includes(query.trim()))).filter(recipe => savedOnly ||
    (cuisine === 'all' || recipe.cuisine === cuisine) && (filter === 'all' || filter === 'ready' && missingCount(recipe) === 0 || filter === 'quick' && recipe.time <= 20 || filter === 'easy' && recipe.level === 0));
  const sourcePicker = <Choice value={source} options={[{value:'personal',label:'내 재료 맞춤'},{value:'catalog',label:'AI 메뉴 탐색'},{value:'video',label:'영상 레시피'}]} onChange={setSource}/>;
  if (!savedOnly && source === 'video') return <LayoutScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.page}><SectionCover title="영상 레시피" detail="제작자의 영상과 설명으로 요리를 살펴보세요." icon="videocam-outline"/>{sourcePicker}<VideoRecipes/></LayoutScrollView>;
  return <LayoutScrollView contentContainerStyle={ui.page} keyboardShouldPersistTaps="handled">
    <SectionCover title={savedOnly ? "내 레시피북" : "오늘의 레시피"} detail={savedOnly ? `저장한 요리 ${app.saved.length}개` : "재료와 취향에 맞는 한 끼를 골라보세요."} icon={savedOnly ? "book-outline" : "restaurant-outline"} />
    {(!savedOnly || app.saved.length > 0) && <TextInput accessibilityLabel="목록에서 레시피 검색" placeholder="요리명이나 재료로 검색" value={query} onChangeText={setQuery} style={ui.input} />}
    {!savedOnly && sourcePicker}
    <Button secondary icon="options-outline" onPress={()=>setFiltersOpen(value=>!value)}>{filtersOpen ? "검색 조건 접기" : "검색 조건 · 요리 종류와 시간"}</Button>
    {filtersOpen && !savedOnly && <>
      <Choice options={cuisineOptions} value={cuisine} onChange={setCuisine} /><Choice options={filterOptions} value={filter} onChange={setFilter} />
      {source === 'personal' && app.results.length > 0 && <Text style={ui.muted}>AI가 생성하고 검토한 추천 · {app.resultSettings.servings}인분 기준</Text>}</>}
    {busy && <View style={ui.row}><ActivityIndicator color={colors.green} /><Text style={ui.muted}>요리를 찾고 있어요…</Text></View>}
    {error && <View style={ui.card}><Text style={ui.error}>{error}</Text><Button secondary onPress={() => void load()}>다시 불러오기</Button></View>}
    {filtersOpen && <Choice value={minutes} options={[0,10,15,30].map(value => ({value,label:value ? value+"분 이내" : "시간 전체"}))} onChange={setMinutes} />}

    <View style={{ flexDirection: wide ? "row" : "column", flexWrap: "wrap", gap: 12 }}>{rows.map(recipe => <View key={recipe.id} style={wide ? { width: "49%" } : { width: "100%" }}><RecipeCard recipe={recipe} saved={app.saved.some(r => r.id === recipe.id)} onOpen={() => onOpen(recipe)} onSave={() => app.toggleSaved(recipe)} /></View>)}</View>
    {!rows.length && !busy && !error && <Empty title={savedOnly ? (app.saved.length ? '검색 결과가 없어요' : '아직 저장한 레시피가 없어요') : '조건에 맞는 요리가 없어요'} message={savedOnly ? (app.saved.length ? '다른 요리명이나 재료를 입력해주세요.' : '레시피의 북마크를 눌러 모아보세요.') : source === 'personal' ? app.resultMessage || '재료를 입력해 추천받거나 필터를 바꿔보세요.' : message || '요리 종류나 필터를 바꿔보세요.'}>
      {source === 'personal' && !savedOnly && <Button onPress={() => app.setTab('pantry')}>재료 입력하기</Button>}</Empty>}
    {!savedOnly && rows.length > 0 && <Button secondary busy={busy || app.searching} onPress={() => source === 'personal' ? void app.recommend(true) : void load(true)}>새 메뉴 더 찾기</Button>}
  </LayoutScrollView>;
}
