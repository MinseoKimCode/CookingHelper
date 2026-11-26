import { LayoutScrollView } from '../components/LayoutScrollView';
import { SectionCover } from '../components/SectionCover';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Choice, Empty, Field, PageHeader, Section } from '../components/ui';
import { RecipeCard } from '../components/RecipeCard';
import { CategoryRow, ChannelList, HomeHero, RankingView, SituationGrid, TodayLineup, VideoCard } from '../components/Discover';
import { useApp } from '../state/AppProvider';
import { api } from '../services/api';
import { useGuideActivity } from '../hooks/useGuideActivity';
import { personalize } from '../recipeTools';
import { colors, ui } from '../theme';
import { cuisineOptions, filterOptions, missingCount, type Cuisine, type Filter, type Recipe, type Theme, type Video } from '../types';

type View_ = 'home' | 'explore' | 'ranking' | 'videos' | 'personal';
type CatalogSort = 'latest' | 'popular' | 'rating' | 'time' | 'calories' | 'name';
const sorts: { value: CatalogSort; label: string }[] = [
  { value: 'latest', label: '최신순' }, { value: 'popular', label: '인기순' }, { value: 'rating', label: '별점순' },
  { value: 'time', label: '조리시간순' }, { value: 'calories', label: '칼로리 낮은순' }, { value: 'name', label: '이름순' },
];
const themeTitles: Record<Exclude<Theme, ''>, string> = { taste: '취향 기반 추천', seasonal: '제철 레시피', budget: '만원의 식탁' };
// Server-side catalog filters for each situation; "바로 가능" depends on this user's fridge and is checked on the device.
const filterQuery = (filter: Filter) => ({ ten: { maxTime: 10 }, quick: { maxTime: 20 }, thirty: { maxTime: 30 }, easy: { level: 0 }, light: { caloriesMax: 500 } } as Record<string, object>)[filter] || {};

export function RecipesScreen({ initialQuery = "", wide, savedOnly = false, onOpen }: { initialQuery?: string; wide: boolean; savedOnly?: boolean; onOpen: (recipe: Recipe) => void }) {
  const app = useApp();
  const [view, setView] = useState<View_>(initialQuery ? 'explore' : 'home');
  const [query, setQuery] = useState(initialQuery);
  const [cuisine, setCuisine] = useState<Cuisine>('all');
  const [filter, setFilter] = useState<Filter>('all');
  const [theme, setTheme] = useState<Theme>('');
  const [sort, setSort] = useState<CatalogSort>('latest');
  const [rows, setRows] = useState<Recipe[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [featured, setFeatured] = useState<Recipe[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [videoQuery, setVideoQuery] = useState('');
  const [videoError, setVideoError] = useState('');
  const [making, setMaking] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoNotes, setVideoNotes] = useState('');
  const [needNotes, setNeedNotes] = useState(false);
  const [pendingRecommend, setPendingRecommend] = useState(false);
  const active = useRef<AbortController | null>(null);
  const owned = app.settings.ingredients, pantry = app.settings.pantry;
  // Catalog, ranking and video recipes were made for another fridge: re-check what this user is missing.
  const mine = (recipe: Recipe) => recipe.source === 'ai' && app.results.some(r => r.id === recipe.id) ? recipe : personalize(recipe, owned, pantry);
  const open = (recipe: Recipe) => onOpen(mine(recipe));
  useEffect(() => { if (initialQuery && !savedOnly) { setQuery(initialQuery); setTheme(''); setView('explore'); } }, [initialQuery]);
  useEffect(() => { if (pendingRecommend) { setPendingRecommend(false); void app.recommend(); } }, [app.settings.ingredients]);
  // New personal recommendations open their list as soon as they arrive.
  const firstResult = app.results[0]?.id;
  const seen = useRef(firstResult);
  useEffect(() => { if (firstResult && firstResult !== seen.current && !savedOnly) setView('personal'); seen.current = firstResult; }, [firstResult]);
  useGuideActivity(generating ? { mood: 'thinking', title: '새 레시피를 만들고 있어요', message: '한끼 AI가 조건에 맞는 메뉴를 만들고 따로 검토하는 중이에요.', priority: 85 } :
    making ? { mood: 'scanning', title: '영상 속 레시피를 정리하고 있어요', message: '영상 설명과 자막에서 재료와 순서를 찾는 중이에요.', priority: 90 } : null);

  async function loadCatalog(next = 0) {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setBusy(true); setError('');
    try {
      const result = await api.catalog({ q: query.trim(), cuisine, sort, page: next, size: 20, ...filterQuery(filter) }, controller.signal);
      if (controller.signal.aborted) return;
      const list = result.recipes.map(row => row.recipe);
      app.setViews(current => ({ ...current, ...Object.fromEntries(result.recipes.map(row => [row.recipe.id, row.views])) }));
      setRows(current => next ? [...current, ...list.filter(r => !current.some(old => old.id === r.id))] : list);
      setPage(next); setHasMore(result.hasMore); setTotal(result.total);
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  /** Paid: asks the AI for new recipes with the current conditions. They join the shared catalog. */
  async function generate() {
    setGenerating(true); setError('');
    try {
      const tastes = [...new Set([...app.saved.map(r => r.name), ...app.logs.map(l => l.name)])].slice(0, 20);
      const result = await api.recommend(app.settings, { mode: 'catalog', cuisine, filter, theme, query: query.trim(), tastes: theme === 'taste' ? tastes : [], more: rows.length > 0, recentMenus: rows.map(r => r.name).slice(0, 120), previousKeys: rows.flatMap(r => r.menuKey ? [r.menuKey] : []) });
      setRows(current => [...result.recipes, ...current.filter(r => !result.recipes.some(n => n.id === r.id))]);
      if (!result.recipes.length) app.setNotice(result.message || '조건에 맞는 새 메뉴를 만들지 못했어요.');
    } catch (e) { setError((e as Error).message); }
    finally { setGenerating(false); }
  }
  useEffect(() => { if (view === 'explore' && !theme) void loadCatalog(0); return () => active.current?.abort(); }, [view, cuisine, filter, sort, theme]);
  useEffect(() => { if (view === 'explore' && theme) { setRows([]); void generate(); } }, [view, theme]);
  useEffect(() => {
    if (view !== 'home' || savedOnly) return;
    const controller = new AbortController();
    api.catalog({ sort: 'popular', size: 10 }, controller.signal).then(result => setFeatured(result.recipes.map(row => row.recipe))).catch(() => undefined);
    if (app.youtubeEnabled) api.youtubeVideos('집밥', 'viewCount', controller.signal).then(result => setVideos(result.videos)).catch(e => setVideoError((e as Error).message));
    return () => controller.abort();
  }, [view, app.youtubeEnabled]);

  async function searchVideos() {
    if (!videoQuery.trim()) return;
    setVideoError(''); setBusy(true);
    try { setVideos((await api.youtubeVideos(videoQuery.trim())).videos); } catch (e) { setVideoError((e as Error).message); } finally { setBusy(false); }
  }
  async function makeRecipe(url: string, notes = '') {
    setMaking(url); setVideoError(''); setNeedNotes(false);
    try {
      const result = await api.videoRecipe(url, notes);
      app.setNotice(result.reused ? '이미 정리된 레시피를 열었어요.' : '영상을 레시피로 정리했어요.');
      open(result.recipe);
    } catch (e) { setVideoError((e as Error).message); setVideoUrl(url); setNeedNotes(true); }
    finally { setMaking(''); }
  }
  // Videos without ingredients in their description need the user to paste them; others go straight to the AI.
  function pick(video: Video) {
    if (video.recipeReady !== false) { void makeRecipe(video.url); return; }
    setVideoUrl(video.url); setNeedNotes(true); setVideoError('이 영상은 설명에 재료가 없어요. 영상에서 본 재료와 순서를 붙여넣어 주세요.'); setView('videos');
  }
  function explore(change: { cuisine?: Cuisine; filter?: Filter; theme?: Theme; query?: string }) {
    setCuisine(change.cuisine ?? 'all'); setFilter(change.filter ?? 'all'); setTheme(change.theme ?? ''); setQuery(change.query ?? ''); setSort('latest'); setRows([]); setView('explore');
  }
  const back = () => setView('home');
  const carousel = (list: Recipe[]) => <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
    {list.map(recipe => <RecipeCard key={recipe.id} width={wide ? 200 : 164} recipe={mine(recipe)} saved={app.saved.some(r => r.id === recipe.id)} onOpen={() => open(recipe)} onSave={() => app.toggleSaved(recipe)} />)}</ScrollView>;
  const listRows = (list: Recipe[]) => <View>{list.map(recipe => <RecipeCard list key={recipe.id} recipe={mine(recipe)} saved={app.saved.some(r => r.id === recipe.id)} onOpen={() => open(recipe)} onSave={() => app.toggleSaved(recipe)} />)}</View>;

  if (savedOnly) {
    const shown = app.saved.filter(recipe => !query.trim() || [recipe.name, ...recipe.ingredients.map(i => i.name)].some(name => name.includes(query.trim())));
    return <LayoutScrollView contentContainerStyle={ui.page} keyboardShouldPersistTaps="handled">
      <SectionCover title="저장한 레시피" detail={`${app.saved.length}개를 모아뒀어요`} />
      <Section>
        {app.saved.length > 0 && <TextInput accessibilityLabel="저장한 레시피 검색" placeholder="요리명이나 재료로 찾기" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={ui.input} />}
        {shown.length ? listRows(shown) : <Empty title={app.saved.length ? '검색 결과가 없어요' : '아직 저장한 레시피가 없어요'} message={app.saved.length ? '다른 요리명이나 재료로 찾아보세요.' : '마음에 드는 레시피의 북마크를 눌러 모아보세요.'} />}
      </Section>
    </LayoutScrollView>;
  }

  if (view === 'ranking') return <LayoutScrollView contentContainerStyle={ui.page}><PageHeader title="레시피 랭킹" onBack={back} /><RankingView onOpen={open} /></LayoutScrollView>;

  if (view === 'personal') return <LayoutScrollView contentContainerStyle={ui.page}>
    <PageHeader title="내 재료 맞춤 추천" onBack={back} />
    <Section detail={app.results.length ? `냉장고 재료로 한끼 AI가 고르고 검토했어요 · ${app.resultSettings.servings}인분` : undefined}>
      {app.searching && <View style={ui.row}><ActivityIndicator color={colors.green} /><Text style={ui.muted}>메뉴를 만들고 검토하고 있어요…</Text></View>}
      {app.results.length ? listRows(app.results) : !app.searching && <Empty title="아직 추천받은 메뉴가 없어요" message={app.resultMessage || '홈에서 냉장고 재료를 입력하고 맞춤 레시피를 찾아보세요.'} />}
    </Section>
    {app.results.length > 0 && <Button large secondary busy={app.searching} onPress={() => void app.recommend(true)}>새 메뉴 더 추천받기</Button>}
  </LayoutScrollView>;

  if (view === 'videos') return <LayoutScrollView contentContainerStyle={ui.page} keyboardShouldPersistTaps="handled">
    <PageHeader title="유튜브 레시피" onBack={back} />
    <Section title="영상 주소로 레시피 만들기" detail="영상 설명과 자막을 읽어 재료·순서를 정리하고, 조회수는 원작자에게 돌아가요">
      <TextInput accessibilityLabel="유튜브 영상 주소" placeholder="https://youtu.be/..." placeholderTextColor={colors.muted} autoCapitalize="none" value={videoUrl} onChangeText={text => { setVideoUrl(text); setNeedNotes(false); }} style={ui.input} />
      {needNotes && <Field label="영상 설명이나 자막에서 재료 부분을 붙여넣어 주세요" multiline maxLength={10000} value={videoNotes} onChangeText={setVideoNotes} />}
      {!!videoError && <Text style={ui.error}>{videoError}</Text>}
      <Button large busy={!!making && making === videoUrl} disabled={!videoUrl.trim()} onPress={() => void makeRecipe(videoUrl.trim(), needNotes ? videoNotes.trim() : '')}>레시피로 정리하기</Button>
    </Section>
    {app.youtubeEnabled ? <Section title="영상 찾기">
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput accessibilityLabel="유튜브 요리 영상 검색" placeholder="김치찌개, 자취 요리" placeholderTextColor={colors.muted} returnKeyType="search" value={videoQuery} onChangeText={setVideoQuery} onSubmitEditing={() => void searchVideos()} style={[ui.input, { flex: 1 }]} />
        <Button busy={busy} onPress={() => void searchVideos()}>검색</Button></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{videos.map(video => <View key={video.id} style={{ width: wide ? '31.5%' : '47.5%' }}>
        <VideoCard video={video} busy={making === video.url} onRecipe={() => pick(video)} /></View>)}</View>
    </Section> : <Section title="영상 찾기"><Text style={ui.muted}>서버에 YouTube API 키(YOUTUBE_API_KEY)를 설정하면 영상 검색, 조회수, 채널 구독자 수가 표시돼요. 지금도 영상 주소를 붙여넣으면 레시피로 정리할 수 있어요.</Text></Section>}
    <ChannelList />
  </LayoutScrollView>;

  if (view === 'explore') {
    const shown = rows.filter(recipe => filter !== 'ready' || missingCount(mine(recipe)) === 0);
    return <LayoutScrollView contentContainerStyle={ui.page} keyboardShouldPersistTaps="handled">
      <PageHeader title={theme ? themeTitles[theme] : query ? `'${query}' 레시피` : '레시피 둘러보기'} onBack={back} />
      <Section>
        {!theme && <TextInput accessibilityLabel="재료나 메뉴로 검색" placeholder="재료나 메뉴로 검색" placeholderTextColor={colors.muted} returnKeyType="search" value={query} onChangeText={setQuery} onSubmitEditing={() => void loadCatalog(0)} style={ui.input} />}
        <Choice scroll options={cuisineOptions} value={cuisine} onChange={setCuisine} />
        <Choice scroll options={filterOptions} value={filter} onChange={setFilter} />
        {!theme && <Choice scroll options={sorts} value={sort} onChange={setSort} />}
      </Section>
      <Section detail={theme ? '한끼 AI가 오늘 조건에 맞춰 만든 레시피예요' : busy && !rows.length ? undefined : `레시피 ${total}개`}>
        {(busy || generating) && <View style={[ui.row, { paddingVertical: 6 }]}><ActivityIndicator color={colors.green} /><Text style={ui.muted}>{generating ? '한끼 AI가 새 레시피를 만들고 검토하고 있어요…' : '불러오는 중…'}</Text></View>}
        {!!error && <Text style={ui.error}>{error}</Text>}
        {shown.length > 0 && listRows(shown)}
        {!shown.length && !busy && !generating && !error && <Empty title="조건에 맞는 레시피가 아직 없어요" message="아래 버튼으로 한끼 AI에게 새 레시피를 만들어 달라고 해보세요." />}
        {hasMore && !theme && <Button secondary busy={busy} onPress={() => void loadCatalog(page + 1)}>더 보기</Button>}
      </Section>
      <Button large icon="sparkles" busy={generating} disabled={app.aiEnabled === false} onPress={() => void generate()}>{theme ? '새 메뉴 더 만들기' : '이 조건으로 AI 레시피 만들기'}</Button>
    </LayoutScrollView>;
  }

  return <LayoutScrollView contentContainerStyle={ui.page} keyboardShouldPersistTaps="handled">
    <HomeHero onSearch={names => { const next = [...new Set([...app.settings.ingredients, ...names])].slice(0, 60); setPendingRecommend(true); app.updateSettings({ ingredients: next }); }} />
    {app.searching && <Section><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><ActivityIndicator color={colors.green} /><Text style={[ui.muted, { flex: 1 }]}>냉장고 재료로 맞춤 메뉴를 만들고 있어요</Text><Button small ghost onPress={app.cancelSearch}>취소</Button></View></Section>}
    {app.results.length > 0 && <Section title="내 재료 맞춤 추천" action="전체" onAction={() => setView('personal')}>{carousel(app.results.slice(0, 8))}</Section>}
    <SituationGrid onPick={value => value === 'popular' ? setView('ranking') : explore({ filter: value })} />
    <Section title="많이 본 레시피" action="전체" onAction={() => explore({})}>
      {featured.length ? carousel(featured) : <Empty title="아직 레시피가 없어요" message="맞춤 추천이나 AI 레시피를 만들면 여기에 모여요." />}
    </Section>
    <CategoryRow value="all" onChange={value => explore({ cuisine: value })} />
    <TodayLineup onPick={value => explore({ theme: value })} />
    <RankingView compact onOpen={open} onMore={() => setView('ranking')} />
    <Section title="유튜브 인기 요리" action="전체" onAction={() => setView('videos')}
      detail={app.youtubeEnabled ? '영상을 레시피로 정리해 바로 따라 할 수 있어요' : '영상 주소를 붙여넣으면 레시피로 정리해드려요'}>
      {app.youtubeEnabled && videos.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {videos.slice(0, 8).map(video => <VideoCard key={video.id} width={wide ? 240 : 220} video={video} busy={making === video.url} onRecipe={() => pick(video)} />)}</ScrollView>
        : <Button secondary icon="logo-youtube" onPress={() => setView('videos')}>유튜브 영상으로 레시피 만들기</Button>}
      {!!videoError && view === 'home' && <Text style={ui.error}>{videoError}</Text>}
    </Section>
  </LayoutScrollView>;
}
