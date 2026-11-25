import { LayoutScrollView } from '../components/LayoutScrollView';
import { SectionCover } from '../components/SectionCover';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Choice, Field } from '../components/ui';
import { useApp } from '../state/AppProvider';
import { api } from '../services/api';
import { pickPhoto } from '../services/photos';
import { useGuideActivity } from '../hooks/useGuideActivity';
import { Inventory } from '../components/Inventory';
import { TutorialTarget } from '../components/TutorialTarget';
import { colors, ui } from '../theme';
import { cuisineOptions, levelLabels, parseIngredients, type Level } from '../types';

export function PantryScreen() {
  const { settings, updateSettings, searching, recommend, cancelSearch, setNotice, aiEnabled, reactGuide, tutorial, tutorialEvent } = useApp();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const targetOffsets = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!tutorial) return;
    const timer = setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, (targetOffsets.current[tutorial.id] || 0) - 12), animated: true }), 200);
    return () => clearTimeout(timer);
  }, [tutorial?.id]);
  const [showPreferences, setShowPreferences] = useState(false);
  const preferencesOpen = showPreferences || tutorial?.id === 'preferences';
  const [draft, setDraft] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [recognized, setRecognized] = useState('');
  const [pantryDraft, setPantryDraft] = useState(settings.pantry.join(', '));
  const [excludedDraft, setExcludedDraft] = useState(settings.excluded.join(', '));
  const [listening, setListening] = useState(false);
  useGuideActivity(photoBusy ? { mood: 'scanning', title: '사진 속 재료를 살펴보고 있어요', message: '어떤 재료가 보이는지 찾아볼게요. 잠시만 기다려주세요.', priority: 100 } :
    photo ? { mood: 'listening', title: '제가 찾은 재료가 맞나요?', message: '아래 인식 결과에서 잘못 읽은 이름을 고치고, 재료에 추가해주세요.', priority: 70 } :
    listening ? { mood: 'listening', title: '어떤 재료인지 듣고 있어요', message: '쉼표로 나눠 적고 추가를 눌러주세요. 재료를 다 넣으면 함께 메뉴를 골라봐요.', priority: 30 } : null);
  function add() {
    const names = parseIngredients(draft);
    if (names.some(x => x.length > 40) || new Set([...settings.ingredients, ...names]).size > 60) { setNotice('재료는 60개까지, 이름은 40자 이내로 입력해주세요.'); return; }
    if (!names.length) return;
    updateSettings({ ingredients: [...new Set([...settings.ingredients, ...names])] }); setDraft('');
    tutorialEvent('ingredientsAdded');
    reactGuide({ mood: 'happy', title: '재료를 기억했어요!', message: `${names.join(', ')}${names.length > 1 ? ' 등을' : '를'} 추가했어요. 더 있는 재료나 양념도 알려주세요.` });
  }
  async function recognize(camera: boolean) {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const image = await pickPhoto(camera);
      if (!image) return;
      const result = await api.recognize(image);
      setPhoto(image); setRecognized(result.ingredients.join(', '));
    } catch (error) { setNotice((error as Error).message); reactGuide({ mood: 'puzzled', title: '사진을 읽다가 잠깐 멈췄어요', message: `${(error as Error).message} 재료를 직접 적어도 괜찮아요.` }); }
    finally { setPhotoBusy(false); }
  }
  function confirmPhoto() {
    const names = parseIngredients(recognized);
    if (!names.length || names.length > 60 || names.some(x => x.length > 40)) { setNotice('인식된 재료 이름을 확인해주세요.'); return; }
    updateSettings({ ingredients: [...new Set([...settings.ingredients, ...names])].slice(0, 60) }); setPhoto(null);
    tutorialEvent('ingredientsAdded');
    reactGuide({ mood: 'happy', title: '사진 속 재료를 함께 확인했어요!', message: '이제 양념과 제외할 재료를 확인하고 요리를 찾아볼까요?', action: 'recommend', actionLabel: '요리 찾아보기' });
  }
  return <LayoutScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={ui.page}>
    <View style={{paddingHorizontal:8,paddingTop:18,gap:5}}><Text style={[ui.label,{color:colors.green}]}>오늘의 한 끼</Text><Text style={[ui.title,{fontSize:30}]}>오늘 뭘 <Text style={{color:colors.green}}>해먹을까요?</Text></Text><Text style={ui.muted}>냉장고 재료를 입력하고 만들 수 있는 요리를 찾아보세요.</Text></View>
    <TutorialTarget target="ingredients" onLayout={event => { targetOffsets.current.ingredients = event.nativeEvent.layout.y; }}><View style={ui.card}>
      <Text style={ui.heading}>재료 담기</Text>
      <Text style={ui.muted}>쉼표로 나눠 입력하거나 사진에서 재료를 찾아보세요.</Text>
      <View style={[ui.row, { alignItems: 'stretch' }]}><TextInput style={[ui.input, { flex: 1, minWidth: 160 }]} accessibilityLabel="재료 입력" placeholder="예: 달걀, 토마토, 대파" placeholderTextColor={colors.muted} value={draft} onChangeText={setDraft} onSubmitEditing={add} onFocus={() => setListening(true)} onBlur={() => setListening(false)} returnKeyType="done" />
        <Button onPress={add} icon="add">추가</Button></View>
      <View style={ui.row}>{settings.ingredients.map(name => <Pressable key={name} accessibilityRole="button" accessibilityLabel={`${name} 삭제`}
        onPress={() => updateSettings({ ingredients: settings.ingredients.filter(x => x !== name) })} style={{ padding: 12, backgroundColor: colors.light, borderRadius: 12 }}><Text style={{ color: colors.green }}>{name}  ×</Text></Pressable>)}</View>
      <View style={ui.row}><Button secondary icon="camera-outline" busy={photoBusy} onPress={() => void recognize(true)}>촬영하기</Button>
        <Button secondary icon="images-outline" disabled={photoBusy} onPress={() => void recognize(false)}>사진 선택</Button></View>
      {photo && <View style={{ gap: 14 }}><Image source={{ uri: photo }} style={{ width: '100%', height: 180, borderRadius: 14 }} resizeMode="cover" />
        <Field label="인식 결과를 확인하고 수정해주세요" value={recognized} onChangeText={setRecognized} multiline />
        <View style={ui.row}><Button onPress={confirmPhoto}>재료에 추가</Button><Button secondary onPress={() => setPhoto(null)}>취소</Button></View></View>}
    </View></TutorialTarget>
    <TutorialTarget target="recommend" onLayout={event => { targetOffsets.current.recommend = event.nativeEvent.layout.y; }}><Button icon="sparkles-outline" busy={searching} onPress={() => {
      if (draft.trim()) { setNotice('입력 중인 재료를 먼저 추가해주세요.'); return; }
      void recommend();
    }}>이 재료로 요리 찾기</Button></TutorialTarget>
    {searching && <><Text style={ui.muted}>메뉴를 만들고 재료와 조리 단계를 검토하고 있어요. 잠시만 기다려주세요.</Text><Button secondary onPress={cancelSearch}>요청 취소</Button></>}
    <View style={[ui.card,{borderWidth:0}]}><Text style={ui.heading}>요리 카테고리</Text><Choice options={cuisineOptions} value={settings.cuisine} onChange={cuisine=>updateSettings({cuisine})}/></View>
    {(settings.ingredients.length > 0 || !!settings.undoStock?.length) && <Inventory />}
    {!!settings.shopping?.length && <View style={ui.card}><Text style={ui.heading}>장보기 목록</Text><Text style={ui.muted}>구매한 재료를 눌러 목록에서 지워주세요.</Text><View style={ui.row}>{settings.shopping.map(name => <Button secondary key={name} icon="checkmark-outline" onPress={() => updateSettings({shopping: settings.shopping?.filter(item => item !== name)})}>{name}</Button>)}</View></View>}
    <TutorialTarget target="preferences" onLayout={event => { targetOffsets.current.preferences = event.nativeEvent.layout.y; }}><View style={ui.card}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: preferencesOpen }} onPress={() => setShowPreferences(value => !value)}><Text style={ui.heading}>요리 설정 {preferencesOpen ? "−" : "＋"}</Text><Text style={ui.muted}>{settings.servings}인분 · 추가 재료 {settings.maxExtraIngredients}개까지 · 추천 {settings.resultCount}개</Text></Pressable>
      {preferencesOpen && <>

      <Text style={ui.label}>요리 숙련도</Text><Choice options={levelLabels.map((label, value) => ({ value: value as Level, label }))} value={settings.level} onChange={level => updateSettings({ level })} />
      <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.label}>몇 인분을 만들까요?</Text><View style={ui.row}>
        <Button secondary disabled={settings.servings <= 1} onPress={() => updateSettings({ servings: settings.servings - 1 })}>−</Button><Text style={ui.text}>{settings.servings}인분</Text>
        <Button secondary disabled={settings.servings >= 6} onPress={() => updateSettings({ servings: settings.servings + 1 })}>＋</Button></View></View>
      <Field label="보유 양념" placeholder="예: 소금, 식용유, 간장" value={pantryDraft} onChangeText={text => { setPantryDraft(text); updateSettings({ pantry: parseIngredients(text) }); }} />
      <Field label="제외 재료 · 알레르기" placeholder="예: 우유, 밀" value={excludedDraft} onChangeText={text => { setExcludedDraft(text); updateSettings({ excluded: parseIngredients(text) }); }} />
      <Text style={ui.label}>추가로 준비할 수 있는 재료 수</Text><Choice options={[{ value: 0, label: '추가 구매 없이' }, { value: 2, label: '2개까지' }, { value: 5, label: '5개까지' }, { value: 10, label: '10개까지' }]} value={settings.maxExtraIngredients} onChange={maxExtraIngredients => updateSettings({ maxExtraIngredients })} />
      <Text style={ui.label}>한 번에 추천받을 메뉴 수</Text><Choice options={[{ value: 3, label: '3개' }, { value: 6, label: '6개' }, { value: 12, label: '12개' }]} value={settings.resultCount} onChange={resultCount => updateSettings({ resultCount })} />
      <Text style={ui.muted}>복합 식품의 모든 성분을 판별하지는 못해요. 알레르기가 있다면 실제 제품의 원재료도 확인해주세요.</Text></>}
    </View></TutorialTarget>
    {aiEnabled === false && <Text style={ui.muted}>메뉴 추천·사진 인식·AI 질문에는 서버의 OpenAI API 연결이 필요해요. 저장한 요리와 기본 사용 안내는 계속 볼 수 있어요.</Text>}
  </LayoutScrollView>;
}
