import React, { useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, Text, View } from 'react-native';
import { Button, Sheet } from '../components/ui';
import { useApp } from '../state/AppProvider';
import { api, assetUrl } from '../services/api';
import { useGuideActivity } from '../hooks/useGuideActivity';
import { Consumption, Rescue } from '../components/CookingTools';
import { TutorialTarget } from '../components/TutorialTarget';
import { colors, ui } from '../theme';
import { levelLabels, type Ingredient, type Recipe } from '../types';

function IngredientRow({ item, missing }: { item: Ingredient; missing?: boolean }) {
  return <View style={[ui.row, { justifyContent: 'space-between', borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 10 }]}>
    <Text style={[ui.text, { color: missing ? colors.amber : colors.ink }]}>{missing ? '＋' : '✓'} {item.name}</Text><Text style={ui.muted}>{item.amount}{item.unit}{missing ? ' · 추가 필요' : ''}</Text></View>;
}
export function RecipeDetail({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const app = useApp();
  const [cooking, setCooking] = useState(false);
  const [step, setStep] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [instructions, setInstructions] = useState<Record<number,string>>({});
  const current = recipe.steps[step];
  const [remaining, setRemaining] = useState((current?.minutes || 0) * 60);
  const [running, setRunning] = useState(false);
  const deadline = useRef(0);
  const [explanation, setExplanation] = useState(recipe.reason);
  const [explaining, setExplaining] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => { app.setGuideRecipe({ recipe, step: cooking ? step : null, running }); return () => app.setGuideRecipe(null); }, [recipe, cooking, step, running, app.setGuideRecipe]);
  useGuideActivity(explaining ? { mood: 'thinking', title: '추천 이유를 더 쉽게 풀어볼게요', message: '레시피에 담긴 재료와 조리법을 바탕으로 설명을 준비하고 있어요.', priority: 85 } : cooking ? {
    mood: remaining === 0 ? 'happy' : 'cooking', title: remaining === 0 ? '시간이 됐어요! 익힘 상태를 확인해봐요' : `함께 요리해요 · ${step + 1}/${recipe.steps.length}단계`,
    message: remaining === 0 ? '시간은 참고용이에요. 음식이 충분히 익었는지 확인한 뒤 다음 단계로 넘어가요.' : running ? `${current?.title || '현재 단계'}를 진행하고 있어요. 타이머를 보며 실제 익힘 상태도 살펴봐요.` : `${current?.title || '현재 단계'}부터 해볼까요? 준비되면 타이머를 시작해주세요.`, priority: 60,
  } : { mood: 'listening', title: `${recipe.name}, 함께 만들어볼까요?`, message: recipe.missing.length || recipe.missingSeasonings?.length ? '추가로 필요한 재료부터 확인해요. 준비가 끝나면 아래 요리 시작하기를 눌러주세요.' : '재료와 조리 순서를 살펴보고 아래 요리 시작하기를 눌러주세요. 한 단계씩 안내할게요.', priority: 40 });
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  useEffect(() => { setRunning(false); setRemaining((current?.minutes || 0) * 60); }, [step]);
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)); setRemaining(left);
      if (!left) { setRunning(false); app.setNotice('타이머가 끝났어요. 음식의 익힘 상태를 확인해주세요.'); }
    };
    tick(); const timer = setInterval(tick, 250);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') tick(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [running]);
  async function explain() {
    setExplaining(true);
    try { const result = await api.explain(recipe.name, recipe.reason); if (mounted.current) setExplanation(result.explanation); }
    catch (error) { app.setNotice((error as Error).message); }
    finally { if (mounted.current) setExplaining(false); }
  }
  function toggleTimer() {
    if (running) { setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))); setRunning(false); }
    else { const seconds = remaining || (current?.minutes || 0) * 60; setRemaining(seconds); deadline.current = Date.now() + seconds * 1000; setRunning(true); }
  }
  const saved = app.saved.some(r => r.id === recipe.id);
  return <Sheet visible title={cooking ? '단계별 조리' : '레시피 상세'} onClose={onClose} contentKey={cooking ? `cook-${step}` : 'detail'} focusEnd={app.tutorial?.id === 'cooking' && !cooking}>
    <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={[ui.title, { flex: 1 }]}>{recipe.name}</Text><Button secondary onPress={() => app.toggleSaved(recipe)} icon={saved ? 'bookmark' : 'bookmark-outline'}>{saved ? '저장됨' : '저장'}</Button></View>
    <Text style={ui.muted}>{recipe.time}분 · {levelLabels[recipe.level]} · {recipe.servings}인분</Text>
    {confirming ? <Consumption recipe={recipe} finish={() => { app.tutorialEvent("cookingCompleted"); app.reactGuide({mood:"happy", title:"한 끼 완성!", message:"냉장고에서 남은 재료를 확인해보세요."}); onClose(); }} /> : cooking && current ? <>
      <View style={{ height: 6, backgroundColor: colors.line, borderRadius: 5 }}><View style={{ height: 6, backgroundColor: colors.green, borderRadius: 5, width: `${(step + 1) / recipe.steps.length * 100}%` }} /></View>
      <Text style={{ fontSize: 14, color: colors.green, fontWeight: '700' }}>STEP {step + 1} / {recipe.steps.length}</Text>
      <Text style={ui.title}>{current.title}</Text><Text style={ui.muted}>약 {current.minutes}분 · {current.heat}</Text><Text style={[ui.text, { fontSize: 18, lineHeight: 29 }]}>{instructions[step] || current.text}</Text>
      <Rescue key={step} recipe={recipe} step={step} instruction={instructions[step] || current.text} apply={text => setInstructions(previous => ({...previous,[step]:text}))}/>
      <View style={[ui.card, { alignItems: 'center', padding: 18 }]}><Text accessibilityRole="timer" style={{ fontSize: 44, fontVariant: ['tabular-nums'], fontWeight: '300', color: colors.ink }}>{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</Text>
        <Button secondary icon={running ? 'pause-outline' : 'play-outline'} onPress={toggleTimer}>{running ? '일시 정지' : remaining ? '타이머 시작' : '다시 시작'}</Button><Text style={ui.muted}>다른 화면에서는 알림이 울리지 않아요. 돌아오면 남은 시간을 갱신해요.</Text></View>
      <View style={[ui.row, { justifyContent: 'space-between' }]}><Button secondary disabled={step === 0} onPress={() => setStep(step - 1)}>이전 단계</Button>
        <Button onPress={() => { setRunning(false); if (step === recipe.steps.length - 1) { setConfirming(true); } else setStep(step + 1); }}>{step === recipe.steps.length - 1 ? '요리 완성' : '다음 단계'}</Button></View>
      <Button secondary onPress={() => { setRunning(false); setCooking(false); }}>레시피 전체 보기</Button>
      <Text style={ui.heading}>재료 분량 다시 보기</Text>{[...recipe.ingredients, ...recipe.seasonings].map((item, index) => <Text key={index} style={ui.muted}>{item.name} {item.amount}{item.unit}</Text>)}
    </> : <>
      {recipe.photo && <View style={{ gap: 8 }}>
        <Image key={retry} source={{ uri: `${assetUrl(recipe.photo.url)}${retry ? `?retry=${retry}` : ''}` }} style={{ height: 240, width: '100%', borderRadius: 20, backgroundColor: colors.light }} resizeMode="cover" onError={() => setImageError(true)} />
        {imageError ? <Button secondary onPress={() => { setImageError(false); setRetry(Date.now()); }}>사진 다시 불러오기</Button> : null}
        <Text style={ui.muted}>{recipe.photo.generated ? '조리 예시 · AI 생성 이미지' : `조리 예시 · ${recipe.photo.author || ''} · ${recipe.photo.license || ''}`}</Text>
        {recipe.photo.sourceUrl && <Button secondary onPress={() => void Linking.openURL(recipe.photo!.sourceUrl!)}>사진 출처 보기</Button>}
        {recipe.photo.licenseUrl && <Button secondary onPress={() => void Linking.openURL(recipe.photo!.licenseUrl!)}>사진 이용 조건</Button>}
      </View>}
      <View style={[ui.card, { backgroundColor: colors.light }]}><Text style={ui.heading}>이 요리를 추천한 이유</Text><Text style={ui.text}>{explanation}</Text>
        {app.aiEnabled && recipe.source !== 'ai' && <Button secondary busy={explaining} onPress={() => void explain()}>AI에게 자세히 물어보기</Button>}</View>
      <View style={ui.card}><Text style={ui.heading}>준비할 재료</Text>{recipe.ingredients.map((item, index) => <IngredientRow key={index} item={item} missing={recipe.missing.includes(item.name)} />)}
        <Text style={ui.label}>양념</Text>{recipe.seasonings.length ? recipe.seasonings.map((item, index) => <IngredientRow key={index} item={item} missing={recipe.missingSeasonings?.includes(item.name)} />) : <Text style={ui.muted}>없음</Text>}</View>
      {(recipe.missing.length > 0 || !!recipe.missingSeasonings?.length) && <Button secondary icon="basket-outline" onPress={() => {
        const shopping = [...new Set([...(app.settings.shopping || []), ...recipe.missing, ...(recipe.missingSeasonings || [])])];
        app.updateSettings({ shopping }); app.setNotice('내 냉장고의 장보기 목록에 담았어요.');
      }}>부족한 재료 장보기 목록에 담기</Button>}
      {recipe.swaps.length > 0 && <View style={ui.card}><Text style={ui.heading}>재료 대체 방법</Text>{recipe.swaps.map((swap, index) => <View key={index}><Text style={ui.text}>{swap.original} → {swap.name}{swap.amount ? ` ${swap.amount}${swap.unit || ''}` : ''}</Text><Text style={ui.muted}>{swap.note}</Text></View>)}</View>}
      <View style={ui.card}><Text style={ui.heading}>재료가 어울리는 이유</Text><Text style={ui.text}>{recipe.pair}</Text></View>
      <Text style={ui.heading}>조리 순서</Text>{recipe.steps.map((item, index) => <View key={index} style={ui.card}><Text style={ui.heading}>{index + 1}. {item.title}</Text><Text style={ui.text}>{item.text}</Text><Text style={ui.muted}>{item.minutes}분 · {item.heat}</Text></View>)}
      <Text style={ui.muted}>분량은 {recipe.servings}인분 기준이에요. 팬 크기와 인분에 따라 나누어 조리하고 실제 익힘 상태를 확인해주세요.</Text>
      <TutorialTarget target="cooking"><Button icon="restaurant-outline" onPress={() => { setStep(0); setRemaining((recipe.steps[0]?.minutes || 0) * 60); setCooking(true); }}>요리 시작하기</Button></TutorialTarget>
    </>}
  </Sheet>;
}
