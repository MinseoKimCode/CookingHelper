import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Share, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LayoutScrollView } from '../components/LayoutScrollView';
import { SectionCover } from '../components/SectionCover';
import { Button, Choice, Field } from '../components/ui';
import { useApp } from '../state/AppProvider';
import { api } from '../services/api';
import { useGuideActivity } from '../hooks/useGuideActivity';
import { cookStats, localToday, shoppingText, storeSearchUrl } from '../recipeTools';
import { colors, ui } from '../theme';
import { dietOptions, type VideoAnalysis } from '../types';

function ShoppingList() {
  const app = useApp();
  const list = app.settings.shopping || [];
  const [draft, setDraft] = useState('');
  const [showText, setShowText] = useState(false);
  const open = list.filter(item => !item.checked);
  function update(next: typeof list) { app.updateSettings({ shopping: next }); }
  function toggle(name: string) { update(list.map(item => item.name === name ? { ...item, checked: !item.checked } : item)); }
  async function share() {
    try { await Share.share({ message: shoppingText(list) }); }
    catch { setShowText(true); }
  }
  return <View style={ui.card}>
    <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.heading}>장보기 리스트</Text><Text style={ui.muted}>남은 재료 {open.length}개</Text></View>
    <View style={[ui.row, { alignItems: 'stretch' }]}>
      <View style={{ flex: 1, minWidth: 160 }}><Field label="직접 추가" placeholder="예: 대파, 두부 1모" value={draft} onChangeText={setDraft} onSubmitEditing={() => { if (draft.trim()) { app.addShopping([{ name: draft.trim().slice(0, 40) }]); setDraft(''); } }} /></View>
    </View>
    <Button small secondary icon="add" disabled={!draft.trim()} onPress={() => { app.addShopping([{ name: draft.trim().slice(0, 40) }]); setDraft(''); }}>목록에 추가</Button>
    {!list.length && <Text style={ui.muted}>레시피의 부족한 재료나 유튜브 영상 재료를 담으면 여기에 모여요.</Text>}
    {list.map(item => <View key={item.name} style={[ui.row, { justifyContent: 'space-between', borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 8, flexWrap: 'nowrap' }]}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!item.checked }} accessibilityLabel={`${item.name} 구매 ${item.checked ? '완료' : '전'}`} onPress={() => toggle(item.name)} style={[ui.row, { flex: 1, flexWrap: 'nowrap' }]}>
        <Ionicons name={item.checked ? 'checkbox' : 'square-outline'} size={24} color={colors.green} />
        <View style={{ flex: 1 }}><Text style={[ui.text, item.checked && { textDecorationLine: 'line-through', color: colors.muted }]}>{item.name}{item.amount ? ` · ${item.amount}` : ''}</Text>
          {!!item.recipe && <Text style={[ui.muted, { fontSize: 12 }]} numberOfLines={1}>{item.recipe}</Text>}</View>
      </Pressable>
      <Pressable accessibilityRole="link" accessibilityLabel={`${item.name} 온라인에서 찾기`} hitSlop={6} onPress={() => void Linking.openURL(storeSearchUrl(item.name))} style={{ padding: 8 }}><Ionicons name="cart-outline" size={21} color={colors.green} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} 삭제`} hitSlop={6} onPress={() => update(list.filter(row => row.name !== item.name))} style={{ padding: 8 }}><Ionicons name="close" size={20} color={colors.muted} /></Pressable>
    </View>)}
    {list.length > 0 && <View style={ui.row}>
      <Button small secondary icon="share-outline" onPress={() => void share()}>공유하기</Button>
      <Button small ghost icon="checkmark-done-outline" disabled={list.length === open.length} onPress={() => update(open)}>산 재료 지우기</Button>
      <Button small ghost icon="leaf-outline" disabled={list.length === open.length} onPress={() => {
        const bought = list.filter(item => item.checked).map(item => item.name);
        app.updateSettings({ ingredients: [...new Set([...app.settings.ingredients, ...bought])].slice(0, 60), shopping: open });
        app.setNotice(`${bought.length}개 재료를 냉장고에 넣었어요.`);
      }}>산 재료 냉장고에 넣기</Button>
    </View>}
    {showText && <Text selectable style={[ui.muted, { backgroundColor: colors.background, padding: 12, borderRadius: 10 }]}>{shoppingText(list)}</Text>}
    <Text style={[ui.muted, { fontSize: 12 }]}>카트 아이콘은 쇼핑몰 검색 결과를 열어요. 가격과 상품은 쇼핑몰에서 직접 확인해주세요.</Text>
  </View>;
}

function VideoShopping() {
  const app = useApp();
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<VideoAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  useGuideActivity(busy ? { mood: 'scanning', title: '영상 속 재료를 살펴보고 있어요', message: '영상 설명에서 재료와 분량을 찾고 있어요.', priority: 90 } : null);
  const owned = new Set([...app.settings.ingredients, ...app.settings.pantry]);
  async function analyze() {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setBusy(true); setError('');
    try { const next = await api.analyzeVideo(url.trim(), notes.trim(), controller.signal); if (!controller.signal.aborted) setResult(next); }
    catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const missing = result?.ingredients.filter(item => !owned.has(item.name)) || [];
  return <View style={ui.card}>
    <Text style={ui.heading}>유튜브 레시피로 장보기</Text>
    <Text style={ui.muted}>영상 주소를 넣으면 영상 설명에서 재료를 찾아 내 냉장고와 비교해요.</Text>
    <Field label="유튜브 레시피 URL" placeholder="https://youtu.be/..." autoCapitalize="none" value={url} editable={!busy} onChangeText={text => { setUrl(text); setResult(null); }} />
    <Field label="영상 설명 또는 자막 (선택)" multiline maxLength={10000} editable={!busy} value={notes} onChangeText={setNotes} placeholder="설명에 재료가 없으면 재료 부분을 붙여넣어 주세요." />
    <Button icon="search-outline" busy={busy} disabled={!url.trim()} onPress={() => void analyze()}>재료 분석하기</Button>
    {!!error && <Text style={ui.error}>{error}</Text>}
    {result && <View style={{ gap: 8 }}>
      <Text style={ui.label}>{result.dish || result.title}</Text>
      <Text style={ui.muted}>📺 {result.author}{result.servings ? ` · ${result.servings}인분 기준` : ''} · {result.source === 'notes' ? '붙여넣은 설명 분석' : '영상 설명 분석'}</Text>
      <Button secondary icon="logo-youtube" onPress={() => void Linking.openURL(result.url)}>원본 영상 보기 · 조회수는 제작자에게</Button>
      {!result.found ? <Text style={ui.error}>{result.message}</Text> : <>
        {result.ingredients.map(item => <View key={item.name} style={[ui.row, { justifyContent: 'space-between' }]}>
          <Text style={[ui.text, { color: owned.has(item.name) ? colors.ink : colors.amber }]}>{owned.has(item.name) ? '✓' : '＋'} {item.name}</Text>
          <Text style={ui.muted}>{item.amount}{item.unit}{owned.has(item.name) ? ' · 보유' : ' · 필요'}</Text></View>)}
        <Button icon="basket-outline" disabled={!missing.length} onPress={() => {
          app.addShopping(missing.map(item => ({ name: item.name, amount: `${item.amount}${item.unit}`.trim() || undefined, recipe: result.dish || result.title })));
          app.setNotice(`없는 재료 ${missing.length}개를 장보기 리스트에 담았어요.`);
        }}>{missing.length ? `없는 재료 ${missing.length}개 장보기 리스트에 담기` : '모든 재료가 냉장고에 있어요'}</Button>
        {result.steps.length > 0 && <><Text style={ui.label}>조리 순서 요약</Text>{result.steps.map((step, index) => <Text key={index} style={ui.muted}>{index + 1}. {step}</Text>)}</>}
      </>}
    </View>}
  </View>;
}

function CookingLog() {
  const app = useApp();
  const today = localToday();
  const stats = cookStats(app.logs, today);
  const [all, setAll] = useState(false);
  return <View style={ui.card}>
    <Text style={ui.heading}>요리 기록</Text>
    <View style={[ui.row, { justifyContent: 'space-between' }]}>
      {[['이번 달', `${stats.month}번`], ['연속 요리', `${stats.streak}일`], ['평균 만족도', stats.average ? `★ ${stats.average}` : '-'], ['전체', `${stats.total}번`]].map(([label, value]) =>
        <View key={label} style={{ flex: 1, minWidth: 70, backgroundColor: colors.light, borderRadius: 12, padding: 10, alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.green }}>{value}</Text><Text style={[ui.muted, { fontSize: 12 }]}>{label}</Text></View>)}
    </View>
    {stats.favorite && <Text style={ui.muted}>가장 많이 만든 요리: {stats.favorite.name} ({stats.favorite.count}번){stats.calories ? ` · 이번 달 추정 ${stats.calories.toLocaleString()}kcal` : ''}</Text>}
    {!app.logs.length && <Text style={ui.muted}>레시피에서 요리를 완성하면 날짜와 만족도가 자동으로 기록돼요.</Text>}
    {(all ? app.logs : app.logs.slice(0, 5)).map(log => {
      const recipe = app.saved.find(r => r.id === log.recipeId);
      return <View key={log.id} style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 8, gap: 2 }}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.label}>{log.name}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`${log.name} 기록 삭제`} hitSlop={6} onPress={() => app.removeLog(log.id)}><Ionicons name="trash-outline" size={18} color={colors.muted} /></Pressable></View>
        <Text style={ui.muted}>{log.date} · {log.servings}인분{log.rating ? ` · ${'★'.repeat(log.rating)}${'☆'.repeat(5 - log.rating)}` : ''}{recipe ? ' · 저장한 레시피' : ''}</Text>
        {!!log.memo && <Text style={ui.text}>{log.memo}</Text>}
      </View>;
    })}
    {app.logs.length > 5 && <Button secondary onPress={() => setAll(value => !value)}>{all ? '최근 기록만 보기' : `기록 ${app.logs.length}개 모두 보기`}</Button>}
  </View>;
}

export function KitchenScreen() {
  const app = useApp();
  return <LayoutScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.page}>
    <SectionCover title="내 주방" detail="냉장고 관리부터 장보기, 요리 기록까지 한곳에서." icon="basket-outline" />
    <ShoppingList />
    <VideoShopping />
    <CookingLog />
    <View style={ui.card}>
      <Text style={ui.heading}>식단 설정</Text>
      <Text style={ui.muted}>추천과 메뉴 탐색에 반영돼요. 알레르기 재료는 내 냉장고의 요리 설정에서 제외해주세요.</Text>
      <Choice options={dietOptions} value={app.settings.diet || 'none'} onChange={diet => app.updateSettings({ diet })} />
      {app.settings.excluded.length > 0 ? <Text style={ui.muted}>제외 재료 · 알레르기: {app.settings.excluded.join(', ')}</Text> : null}
      <Button small ghost icon="options-outline" onPress={() => app.setTab('pantry')}>제외 재료 · 알레르기 설정하기</Button>
    </View>
  </LayoutScrollView>;
}
