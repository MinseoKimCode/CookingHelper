import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Choice, Field, ListRow, Section, Sheet } from '../components/ui';
import { useApp } from '../state/AppProvider';
import { api, assetUrl } from '../services/api';
import { useGuideActivity } from '../hooks/useGuideActivity';
import { Consumption, Rescue } from '../components/CookingTools';
import { TutorialTarget } from '../components/TutorialTarget';
import { compactCount, convertUnit, duration, formatAmount, recipeFaq, scaleAmount, storeSearchUrl, videoSearchUrl } from '../recipeTools';
import { colors, ui } from '../theme';
import { cuisineOptions, levelLabels, type Ingredient, type Recipe, type Review } from '../types';

const open = (url: string) => void Linking.openURL(url).catch(() => undefined);
function amountText(item: Ingredient, metric: boolean) {
  const value = metric ? convertUnit(item.amount, item.unit) : { amount: item.amount, unit: item.unit };
  return `${formatAmount(value.amount)}${value.unit}`;
}
const tagStyle = { fontSize: 12, color: colors.green, backgroundColor: colors.light, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, fontWeight: '600' as const, overflow: 'hidden' as const };

function IngredientRow({ item, missing, metric, swaps, last }: { item: Ingredient; missing?: boolean; metric: boolean; swaps: Recipe['swaps']; last?: boolean }) {
  const [showSwap, setShowSwap] = useState(false);
  return <View style={{ borderBottomWidth: last ? 0 : 1, borderColor: colors.line, paddingVertical: 10, gap: 6 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={[ui.text, { flex: 1 }]}>{item.name}{missing ? <Text style={{ color: colors.amber, fontSize: 12, fontWeight: '600' }}>  필요</Text> : null}</Text>
      {swaps.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} 대체 재료 보기`} accessibilityState={{ expanded: showSwap }} onPress={() => setShowSwap(v => !v)} hitSlop={6}>
        <Text style={{ fontSize: 12, color: colors.green, fontWeight: '700' }}>대체 {swaps.length}</Text></Pressable>}
      <Text style={[ui.text, { color: colors.muted, minWidth: 56, textAlign: 'right' }]}>{amountText(item, metric)}</Text>
      {missing && <Pressable accessibilityRole="link" accessibilityLabel={`${item.name} 온라인에서 찾기`} hitSlop={8} onPress={() => open(storeSearchUrl(item.name))}>
        <Ionicons name="cart-outline" size={18} color={colors.green} /></Pressable>}
    </View>
    {showSwap && swaps.map((swap, index) => <View key={index} style={{ backgroundColor: colors.tint, borderRadius: 8, padding: 10, gap: 2 }}>
      <Text style={ui.label}>{swap.name}{swap.amount ? ` ${formatAmount(swap.amount)}${swap.unit || ''}` : ''}로 바꾸기</Text><Text style={ui.muted}>{swap.note}</Text></View>)}
  </View>;
}

function Stars({ value, onChange, size = 24 }: { value: number; onChange?: (value: number) => void; size?: number }) {
  return <View style={{ flexDirection: 'row', gap: 2 }}>{[1, 2, 3, 4, 5].map(star => <Pressable key={star} disabled={!onChange} accessibilityRole={onChange ? 'button' : undefined} accessibilityLabel={onChange ? `별점 ${star}점` : undefined} onPress={() => onChange?.(star)} hitSlop={4}>
    <Ionicons name={star <= value ? 'star' : 'star-outline'} size={size} color={colors.amber} /></Pressable>)}</View>;
}

function Reviews({ recipe }: { recipe: Recipe }) {
  const app = useApp();
  const [data, setData] = useState<{ reviews: Review[]; rating: number; reviewCount: number } | null>(null);
  const [error, setError] = useState('');
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(5);
  const [author, setAuthor] = useState(app.nickname);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const tracked = /^ai-/.test(recipe.id);
  useEffect(() => {
    if (!tracked) return;
    const controller = new AbortController();
    api.reviews(recipe.id, controller.signal).then(setData).catch(e => { if (!controller.signal.aborted) setError((e as Error).message); });
    return () => controller.abort();
  }, [recipe.id]);
  async function submit() {
    setBusy(true); setError('');
    try { setData(await api.review(recipe.id, { viewer: app.viewer, author: author.trim(), rating, content: content.trim() })); app.setNickname(author.trim()); setWriting(false); setContent(''); app.setNotice('후기를 남겼어요. 고마워요!'); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  if (!tracked) return <Text style={ui.muted}>이 레시피는 예전 버전에서 저장돼 후기를 남길 수 없어요.</Text>;
  return <View style={{ gap: 12 }}>
    {data && data.reviewCount > 0 ? <View style={[ui.row, { gap: 8 }]}><Stars value={Math.round(data.rating)} size={18} /><Text style={ui.label}>{data.rating} · {data.reviewCount}개</Text></View>
      : <Text style={ui.muted}>아직 후기가 없어요. 만들어 보셨다면 첫 후기를 남겨주세요.</Text>}
    {data?.reviews.slice(0, 10).map(review => <View key={review.id} style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 10, gap: 4 }}>
      <View style={[ui.row, { gap: 6 }]}><Text style={ui.label}>{review.author}</Text><Stars value={review.rating} size={12} /><Text style={ui.muted}>{review.createdAt.slice(0, 10)}</Text></View>
      {!!review.content && <Text style={ui.text}>{review.content}</Text>}</View>)}
    {writing ? <View style={{ gap: 12, borderTopWidth: 1, borderColor: colors.line, paddingTop: 12 }}>
      <Stars value={rating} onChange={setRating} />
      <Field label="닉네임" maxLength={24} value={author} onChangeText={setAuthor} />
      <Field label="후기 (선택)" multiline maxLength={400} value={content} onChangeText={setContent} placeholder="맛, 분량, 바꿔본 재료를 알려주세요." />
      <View style={ui.row}><Button small busy={busy} disabled={!author.trim()} onPress={() => void submit()}>후기 등록</Button><Button small ghost onPress={() => setWriting(false)}>취소</Button></View>
    </View> : <Button small secondary icon="create-outline" onPress={() => setWriting(true)}>만들어 봤어요 · 후기 쓰기</Button>}
    {!!error && <Text style={ui.error}>{error}</Text>}
  </View>;
}

const reportReasons = ['분량이 이상해요', '조리 순서가 이상해요', '알레르기 표기가 틀려요', '사진이 요리와 달라요', '기타'] as const;
function Report({ recipe }: { recipe: Recipe }) {
  const app = useApp();
  const [openForm, setOpenForm] = useState(false);
  const [reason, setReason] = useState<string>(reportReasons[0]);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  if (!/^ai-/.test(recipe.id)) return null;
  if (!openForm) return <Pressable accessibilityRole="button" onPress={() => setOpenForm(true)} style={{ alignSelf: 'center', padding: 8 }}><Text style={[ui.muted, { textDecorationLine: 'underline' }]}>이 레시피에 문제가 있나요?</Text></Pressable>;
  return <Section title="문제 알리기">
    <Choice options={reportReasons.map(value => ({ value, label: value }))} value={reason} onChange={setReason} />
    <Field label="자세한 내용 (선택)" multiline maxLength={400} value={detail} onChangeText={setDetail} />
    <View style={ui.row}><Button small busy={busy} onPress={() => {
      setBusy(true);
      api.report(recipe.id, { viewer: app.viewer, reason, detail: detail.trim() }).then(() => { app.setNotice('알려주셔서 고마워요. 확인해볼게요.'); setOpenForm(false); setDetail(''); })
        .catch(e => app.setNotice((e as Error).message)).finally(() => setBusy(false));
    }}>보내기</Button><Button small ghost onPress={() => setOpenForm(false)}>취소</Button></View></Section>;
}

function Finish({ recipe, onDone }: { recipe: Recipe; onDone: (rating: number, memo: string) => void }) {
  const [rating, setRating] = useState(0);
  const [memo, setMemo] = useState('');
  return <Section title="한 끼 완성! 기록을 남겨요" detail={`${recipe.name} · ${recipe.servings}인분 — 내 주방의 요리 기록에 저장돼요.`}>
    <Text style={ui.label}>만족도</Text><Stars value={rating} onChange={setRating} />
    <Field label="메모 (선택)" multiline maxLength={300} value={memo} onChangeText={setMemo} placeholder="다음에 바꿔볼 점, 같이 먹은 사람 등" />
    <Button icon="checkmark-outline" onPress={() => onDone(rating, memo)}>기록하고 완료</Button></Section>;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <View style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 2, paddingVertical: 12 }}>
    <Text style={ui.muted}>{label}</Text><Text style={[ui.label, { fontSize: 15 }]} numberOfLines={1}>{value}</Text>{!!sub && <Text style={[ui.muted, { fontSize: 11 }]}>{sub}</Text>}</View>;
}

type SectionKey = 'ingredients' | 'steps' | 'video' | 'reviews' | 'faq';
const jumps: { value: SectionKey; label: string }[] = [{ value: 'ingredients', label: '재료' }, { value: 'steps', label: '조리' }, { value: 'video', label: '영상' }, { value: 'reviews', label: '후기' }, { value: 'faq', label: 'FAQ' }];

export function RecipeDetail({ recipe: original, onClose }: { recipe: Recipe; onClose: () => void }) {
  const app = useApp();
  const [servings, setServings] = useState(original.servings);
  const [metric, setMetric] = useState(false);
  // Every amount on this screen, the shopping list and the stock deduction follow the chosen servings.
  const recipe = useMemo<Recipe>(() => servings === original.servings ? original : {
    ...original, servings,
    ingredients: original.ingredients.map(item => ({ ...item, amount: scaleAmount(item.amount, original.servings, servings) })),
    seasonings: original.seasonings.map(item => ({ ...item, amount: scaleAmount(item.amount, original.servings, servings) })),
    swaps: original.swaps.map(swap => ({ ...swap, amount: swap.amount && scaleAmount(swap.amount, original.servings, servings) })),
  }, [original, servings]);
  const [cooking, setCooking] = useState(false);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'cooking' | 'consume' | 'log'>('cooking');
  const [instructions, setInstructions] = useState<Record<number, string>>({});
  const current = recipe.steps[step];
  const [remaining, setRemaining] = useState((current?.minutes || 0) * 60);
  const [running, setRunning] = useState(false);
  const deadline = useRef(0);
  const [explanation, setExplanation] = useState(recipe.reason);
  const [explaining, setExplaining] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retry, setRetry] = useState(0);
  const offsets = useRef<Partial<Record<SectionKey, number>>>({});
  const [scrollTarget, setScrollTarget] = useState<{ y: number } | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  useEffect(() => { app.recordView(original); }, [original.id]);
  useEffect(() => { app.setGuideRecipe({ recipe, step: cooking ? step : null, running }); return () => app.setGuideRecipe(null); }, [recipe, cooking, step, running, app.setGuideRecipe]);
  useGuideActivity(explaining ? { mood: 'thinking', title: '추천 이유를 더 쉽게 풀어볼게요', message: '레시피에 담긴 재료와 조리법을 바탕으로 설명을 준비하고 있어요.', priority: 85 } : cooking ? {
    mood: remaining === 0 ? 'happy' : 'cooking', title: remaining === 0 ? '시간이 됐어요! 익힘 상태를 확인해봐요' : `함께 요리해요 · ${step + 1}/${recipe.steps.length}단계`,
    message: remaining === 0 ? '시간은 참고용이에요. 음식이 충분히 익었는지 확인한 뒤 다음 단계로 넘어가요.' : current?.passive ? `${current.title}는 자리를 비워도 되는 단계예요. 타이머를 켜두고 다른 준비를 해도 좋아요.` : running ? `${current?.title || '현재 단계'}를 진행하고 있어요. 타이머를 보며 실제 익힘 상태도 살펴봐요.` : `${current?.title || '현재 단계'}부터 해볼까요? 준비되면 타이머를 시작해주세요.`, priority: 60,
  } : { mood: 'listening', title: `${recipe.name}, 함께 만들어볼까요?`, message: recipe.missing.length || recipe.missingSeasonings?.length ? '추가로 필요한 재료부터 확인해요. 준비가 끝나면 요리 시작하기를 눌러주세요.' : '재료와 조리 순서를 살펴보고 요리 시작하기를 눌러주세요. 한 단계씩 안내할게요.', priority: 40 });
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
  const mark = (key: SectionKey) => (event: { nativeEvent: { layout: { y: number } } }) => { offsets.current[key] = event.nativeEvent.layout.y; };
  const saved = app.saved.some(r => r.id === recipe.id);
  const excludedAllergens = (recipe.allergens || []).filter(name => app.settings.excluded.includes(name));
  const missingItems = [...recipe.ingredients.filter(item => recipe.missing.includes(item.name)), ...recipe.seasonings.filter(item => recipe.missingSeasonings?.includes(item.name))];
  const cookTime = Math.max(0, recipe.time - (recipe.prepTime || 0));
  const startCooking = () => { setStep(0); setPhase('cooking'); setRemaining((recipe.steps[0]?.minutes || 0) * 60); setCooking(true); };
  const header = <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
    <View style={{ flex: 1, gap: 4 }}><Text accessibilityRole="header" style={ui.title}>{recipe.name}</Text>{!!recipe.subtitle && <Text style={[ui.muted, { fontSize: 15 }]}>{recipe.subtitle}</Text>}</View>
    <Pressable accessibilityRole="button" accessibilityLabel={saved ? '저장 취소' : '저장'} accessibilityState={{ selected: saved }} onPress={() => app.toggleSaved(original)} hitSlop={8}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: saved ? colors.light : colors.fill }}>
      <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? colors.green : colors.sub} /></Pressable>
  </View>;

  if (phase === 'log') return <Sheet visible title="요리 완성" onClose={onClose} contentKey="log"><Finish recipe={recipe} onDone={(rating, memo) => {
    app.addLog(recipe, rating, memo, servings); app.tutorialEvent("cookingCompleted");
    app.reactGuide({ mood: "happy", title: "한 끼 완성!", message: "내 주방에 요리 기록을 남겼어요. 냉장고에서 남은 재료도 확인해보세요." }); onClose();
  }} /></Sheet>;
  if (phase === 'consume') return <Sheet visible title="사용한 재료 확인" onClose={onClose} contentKey="consume"><Consumption recipe={recipe} finish={() => setPhase('log')} /></Sheet>;

  if (cooking && current) {
    const last = step === recipe.steps.length - 1;
    return <Sheet visible title={`${step + 1} / ${recipe.steps.length}단계`} onClose={onClose} contentKey={`cook-${step}`}
      footer={<View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Button large secondary disabled={step === 0} onPress={() => setStep(step - 1)}>이전</Button></View>
        <View style={{ flex: 2 }}><Button large onPress={() => { setRunning(false); if (last) setPhase('consume'); else setStep(step + 1); }}>{last ? '요리 완성' : '다음 단계'}</Button></View>
      </View>}>
      <View style={{ height: 4, backgroundColor: colors.line, borderRadius: 4 }}><View style={{ height: 4, backgroundColor: colors.green, borderRadius: 4, width: `${(step + 1) / recipe.steps.length * 100}%` }} /></View>
      <View style={ui.card}>
        <Text style={{ fontSize: 14, color: colors.green, fontWeight: '700' }}>STEP {step + 1}{current.passive ? '  ·  ☕ 자리를 비워도 돼요' : ''}</Text>
        <Text accessibilityRole="header" style={ui.title}>{current.title}</Text>
        <Text style={[ui.text, { fontSize: 19, lineHeight: 30 }]}>{instructions[step] || current.text}</Text>
        <Text style={ui.muted}>약 {current.minutes}분 · {current.heat}</Text>
      </View>
      <View style={[ui.card, { alignItems: 'center' }]}>
        <Text accessibilityRole="timer" style={{ fontSize: 52, fontVariant: ['tabular-nums'], fontWeight: '300', color: colors.ink }}>{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</Text>
        <Button secondary icon={running ? 'pause' : 'play'} onPress={toggleTimer}>{running ? '일시 정지' : remaining ? '타이머 시작' : '다시 시작'}</Button>
        <Text style={[ui.muted, { fontSize: 12, textAlign: 'center' }]}>다른 화면에서는 알림이 울리지 않아요. 돌아오면 남은 시간을 갱신해요.</Text></View>
      <Rescue key={step} recipe={recipe} step={step} instruction={instructions[step] || current.text} apply={text => setInstructions(previous => ({ ...previous, [step]: text }))} />
      <Section title={`재료 · ${recipe.servings}인분`}>
        {[...recipe.ingredients, ...recipe.seasonings].map((item, index) => <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={ui.text}>{item.name}</Text><Text style={[ui.text, { color: colors.muted }]}>{amountText(item, metric)}</Text></View>)}
      </Section>
      <Button ghost icon="list" onPress={() => { setRunning(false); setCooking(false); }}>레시피 전체 보기</Button>
    </Sheet>;
  }

  const divider = <View style={{ width: 1, backgroundColor: colors.line, marginVertical: 12 }} />;
  return <Sheet visible title="레시피" onClose={onClose} contentKey="detail" focusEnd={app.tutorial?.id === 'cooking'} scrollTarget={scrollTarget}
    footer={<TutorialTarget target="cooking"><Button large icon="restaurant" onPress={startCooking}>요리 시작하기</Button></TutorialTarget>}>
    {recipe.photo && <View style={{ gap: 6 }}>
      <Image key={retry} source={{ uri: `${assetUrl(recipe.photo.url)}${retry ? `?retry=${retry}` : ''}` }} style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: 20, backgroundColor: colors.fill }} resizeMode="cover" onError={() => setImageError(true)} />
      <View style={[ui.row, { justifyContent: 'space-between', paddingHorizontal: 4 }]}>
        <Text style={[ui.muted, { fontSize: 12 }]}>{recipe.video ? `영상 썸네일 · ${recipe.video.channel}` : recipe.photo.generated ? '조리 예시 · AI 생성 이미지' : `조리 예시 · ${recipe.photo.author || ''} · ${recipe.photo.license || ''}`}</Text>
        {imageError && <Pressable onPress={() => { setImageError(false); setRetry(Date.now()); }}><Text style={{ color: colors.green, fontSize: 12, fontWeight: '700' }}>사진 다시 불러오기</Text></Pressable>}
      </View>
    </View>}

    <View style={ui.card}>
      {header}
      <View style={{ flexDirection: 'row', backgroundColor: colors.fill, borderRadius: 16 }}>
        <Stat label="조리 시간" value={`${recipe.time}분`} sub={recipe.prepTime ? `준비 ${recipe.prepTime} · 조리 ${cookTime}${recipe.restTime ? ` · 대기 ${recipe.restTime}` : ''}` : undefined} />
        {divider}<Stat label="난이도" value={levelLabels[recipe.level]} sub={'★'.repeat(recipe.level + 1) + '☆'.repeat(2 - recipe.level)} />
        {!!recipe.calories && <>{divider}<Stat label="1인분" value={`${recipe.calories}kcal`} sub="추정" /></>}
        {!!recipe.cost && <>{divider}<Stat label="재료비" value={`${recipe.cost.toLocaleString()}원`} sub="1인분 추정" /></>}
      </View>
      <View style={[ui.row, { gap: 6 }]}>{[cuisineOptions.find(c => c.value === recipe.cuisine)?.label, ...(recipe.diet || [])].filter(Boolean).map(tag => <Text key={tag} style={tagStyle}>{tag}</Text>)}</View>
      {recipe.allergens && <View style={{ gap: 4 }}>
        <Text style={[ui.muted, excludedAllergens.length > 0 && { color: colors.danger, fontWeight: '600' }]}>
          알레르기 성분 · {recipe.allergens.length ? recipe.allergens.join(', ') : '표시된 성분 없음'}{excludedAllergens.length ? `  (내 제외 설정 ${excludedAllergens.join(', ')}와 겹쳐요)` : ''}</Text>
        <Pressable accessibilityRole="button" onPress={() => { onClose(); app.setTab('kitchen'); }} style={{ alignSelf: 'flex-start' }}><Text style={{ color: colors.green, fontSize: 14, fontWeight: '600' }}>식단 설정 등록하기 ›</Text></Pressable>
      </View>}
    </View>

    {recipe.video && <Section title="원본 영상" detail="이 레시피는 아래 영상을 AI로 분석해 정리했어요. 조회수는 제작자에게 가요.">
      <ListRow image={recipe.video.thumbnail || recipe.photo?.url} title={recipe.video.title} caption={`${recipe.video.channel}${recipe.video.views ? ` · 조회수 ${compactCount(recipe.video.views)}회` : ''}${recipe.video.seconds ? ` · ${duration(recipe.video.seconds)}` : ''}`}
        onPress={() => open(recipe.video!.url)} />
      <Button secondary icon="logo-youtube" onPress={() => open(recipe.video!.url)}>원본 영상 보기</Button>
    </Section>}

    <View style={[ui.card, { backgroundColor: colors.light, gap: 8 }]}>
      <Text style={[ui.label, { color: colors.green }]}>한끼 AI의 한마디</Text>
      <Text style={ui.text}>{explanation}</Text>
      {!!recipe.pair && <Text style={[ui.muted, { color: colors.sub }]}>{recipe.pair}</Text>}
      {app.aiEnabled && recipe.source !== 'ai' && !recipe.video && <Button small ghost busy={explaining} onPress={() => void explain()}>AI에게 자세히 물어보기</Button>}
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{jumps.map(item => <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={`${item.label} 섹션으로 이동`}
      onPress={() => { const y = offsets.current[item.value]; if (y !== undefined) setScrollTarget({ y }); }}
      style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18, backgroundColor: colors.surface }}><Text style={{ fontSize: 14, fontWeight: '600', color: colors.sub }}>{item.label}</Text></Pressable>)}</ScrollView>

    <Section title="재료" detail={`${recipe.swaps.length ? `대체 가능한 재료 ${recipe.swaps.length}가지` : '“필요” 표시는 냉장고에 없는 재료예요'}`} onLayout={mark('ingredients')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={[ui.row, { gap: 4, backgroundColor: colors.fill, borderRadius: 14, padding: 4 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="1인분 줄이기" disabled={servings <= 1} onPress={() => setServings(servings - 1)} style={[stepper, servings <= 1 && { opacity: .4 }]}><Ionicons name="remove" size={18} color={colors.ink} /></Pressable>
          <Text style={[ui.label, { minWidth: 52, textAlign: 'center' }]}>{servings}인분</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="1인분 늘리기" disabled={servings >= 12} onPress={() => setServings(servings + 1)} style={[stepper, servings >= 12 && { opacity: .4 }]}><Ionicons name="add" size={18} color={colors.ink} /></Pressable>
        </View>
        <Choice options={[{ value: 'spoon', label: '큰술' }, { value: 'ml', label: 'ml' }]} value={metric ? 'ml' : 'spoon'} onChange={value => setMetric(value === 'ml')} />
      </View>
      <View>
        {recipe.ingredients.map((item, index) => <IngredientRow key={index} item={item} metric={metric} missing={recipe.missing.includes(item.name)} swaps={recipe.swaps.filter(s => s.original === item.name)} last={index === recipe.ingredients.length - 1 && !recipe.seasonings.length} />)}
        {recipe.seasonings.length > 0 && <Text style={[ui.muted, { paddingTop: 14, fontWeight: '600' }]}>양념</Text>}
        {recipe.seasonings.map((item, index) => <IngredientRow key={`s${index}`} item={item} metric={metric} missing={recipe.missingSeasonings?.includes(item.name)} swaps={recipe.swaps.filter(s => s.original === item.name)} last={index === recipe.seasonings.length - 1} />)}
      </View>
      {metric && <Text style={[ui.muted, { fontSize: 12 }]}>1큰술 15ml · 1작은술 5ml · 1컵 200ml 기준</Text>}
      {missingItems.length > 0 && <Button secondary icon="basket" onPress={() => {
        app.addShopping(missingItems.map(item => ({ name: item.name, amount: amountText(item, false), recipe: recipe.name })));
        app.setNotice('내 주방의 장보기 리스트에 담았어요.');
      }}>{`없는 재료 ${missingItems.length}개 장보기에 담기`}</Button>}
      {!!recipe.tools?.length && <Text style={ui.muted}>필요 도구 · {recipe.tools.filter(t => t.required).map(t => t.name).join(', ') || '없음'}{recipe.tools.some(t => !t.required) ? `  (있으면 좋아요: ${recipe.tools.filter(t => !t.required).map(t => t.name).join(', ')})` : ''}</Text>}
    </Section>

    <Section title="조리 과정" detail={`${recipe.steps.length}단계 · 약 ${recipe.time}분`} onLayout={mark('steps')}>
      <View>{recipe.steps.map((item, index) => <View key={index} style={{ flexDirection: 'row', gap: 14, paddingVertical: 12 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 14, fontWeight: '800', color: 'white' }}>{index + 1}</Text></View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[ui.label, { fontSize: 16 }]}>{item.title}</Text>
          <Text style={ui.text}>{item.text}</Text>
          <Text style={ui.muted}>{item.minutes}분 · {item.heat}{item.passive ? '  ·  ☕ 자리를 비워도 돼요' : ''}</Text>
        </View></View>)}</View>
      {!!recipe.tips && <View style={{ backgroundColor: colors.fill, borderRadius: 14, padding: 16, gap: 6 }}><Text style={ui.label}>💡 요리 포인트</Text><Text style={ui.text}>{recipe.tips}</Text></View>}
      <Text style={[ui.muted, { fontSize: 12 }]}>팬 크기와 인분에 따라 나누어 조리하고 실제 익힘 상태를 확인해주세요.</Text>
    </Section>

    {!recipe.video && <Section title="영상으로 보기" detail="같은 요리를 만드는 제작자들의 영상이에요." onLayout={mark('video')}>
      <Button secondary icon="logo-youtube" onPress={() => open(videoSearchUrl(recipe.name))}>{`유튜브에서 '${recipe.name}' 찾기`}</Button>
    </Section>}

    <Section title="후기" onLayout={mark('reviews')}><Reviews recipe={recipe} /></Section>

    <Section title="자주 묻는 질문" onLayout={mark('faq')}>
      <View>{recipeFaq(recipe).map((row, index) => <Pressable key={row.q} accessibilityRole="button" accessibilityState={{ expanded: faqOpen === index }} onPress={() => setFaqOpen(faqOpen === index ? null : index)}
        style={{ paddingVertical: 14, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={[ui.label, { flex: 1 }]}>{row.q}</Text><Ionicons name={faqOpen === index ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} /></View>
        {faqOpen === index && <Text style={[ui.text, { color: colors.sub }]}>{row.a}</Text>}</Pressable>)}</View>
    </Section>
    <Report recipe={recipe} />
  </Sheet>;
}
const stepper = { width: 34, height: 34, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.surface };
