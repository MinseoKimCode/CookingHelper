import { LayoutScrollView } from './LayoutScrollView';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Monster } from './Monster';
import { useApp } from '../state/AppProvider';
import { colors } from '../theme';
import type { GuideAction, MonsterMood } from '../guide';
import type { Tab } from '../types';
import { stepLabels, tutorialSteps } from '../tutorial';

const moodLabels: Record<MonsterMood, string> = { idle: '함께 있어요', listening: '듣고 있어요', thinking: '고민 중이에요', scanning: '살펴보고 있어요', cooking: '요리 중이에요', happy: '신나요!', puzzled: '같이 해결해봐요' };
const destinations: { action: GuideAction; label: string }[] = [
  { action: 'pantry', label: '재료 입력' }, { action: 'recipes', label: '요리 고르기' }, { action: 'saved', label: '저장한 요리' }, { action: 'community', label: '요리 이야기' },
];
export function GuideCard({ navigationEnabled = true }: { navigationEnabled?: boolean }) {
  const { guide, tab, setTab, recommend, searching, tutorial, tutorialStep, tutorialCompleted, startTutorial, nextTutorial, stopTutorial,
    aiGuideAnswer, aiGuideBusy, aiGuideError, askGuide } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [greeting, setGreeting] = useState(false);
  const [question, setQuestion] = useState('');
  useEffect(() => { if (!greeting) return; const timer = setTimeout(() => setGreeting(false), 1800); return () => clearTimeout(timer); }, [greeting]);
  const mood = aiGuideBusy ? 'thinking' : greeting && (guide.mood === 'idle' || guide.mood === 'happy') ? 'listening' : guide.mood;
  function act(action: GuideAction) { if (action === 'recommend') void recommend(); else setTab(action); }
  return <View style={s.card} testID="monster-guide">
    {tutorial && <View style={s.progress}>
      <View style={[s.row,{justifyContent:'space-between'}]}><Text style={s.kicker}>사용 안내 · {Math.max(1,tutorialStep ?? 1)} / {tutorialSteps.length - 1}   {stepLabels[tutorial.id]}</Text>
        <Pressable accessibilityRole="button" onPress={stopTutorial} hitSlop={8}><Text style={s.actionText}>안내 종료</Text></Pressable></View>
      <View accessibilityRole="progressbar" accessibilityLabel="사용 안내 진행" accessibilityValue={{min:0,max:tutorialSteps.length-1,now:tutorialStep ?? 0}} style={s.track}><View style={{height:4,backgroundColor:colors.green,width: `${(tutorialStep ?? 0)/(tutorialSteps.length-1)*100}%`}} /></View>
    </View>}
    <View style={s.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="한끼 길라잡이 안내 펼치기" accessibilityState={{ expanded }} onPress={() => { setGreeting(true); setExpanded(!expanded); }} style={s.avatar}>
        <Monster mood={mood} size={64} />
      </Pressable>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.kicker}>한끼 · {moodLabels[guide.mood]}</Text>
        <Text style={s.title} accessibilityLiveRegion="polite">{guide.title}</Text>
        <Text style={s.message} numberOfLines={expanded || tutorial ? undefined : 2}>{guide.message}</Text>
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:4}}>
        {!tutorial && guide.action && navigationEnabled && <Pressable accessibilityRole="button" disabled={guide.action === 'recommend' && searching} onPress={() => act(guide.action!)} style={s.action}><Text style={s.actionText}>{guide.actionLabel}</Text></Pressable>}
        {tutorial?.event === 'continue' && <Pressable accessibilityRole="button" onPress={nextTutorial} style={s.action}><Text style={s.actionText}>{tutorial.id === 'welcome' ? '함께 시작하기' : tutorial.id === 'complete' ? '안내 마치기' : '설정 확인했어요'}</Text></Pressable>}
        {tutorial?.event !== 'continue' && tutorial?.action && tutorial.action !== tab && navigationEnabled && <Pressable accessibilityRole="button" disabled={searching} onPress={() => act(tutorial.action!)} style={s.action}><Text style={s.actionText}>{tutorial.actionLabel}</Text></Pressable>}
        {!tutorial && !tutorialCompleted && navigationEnabled && <Pressable accessibilityRole="button" onPress={startTutorial} style={s.action}><Text style={s.actionText}>몬스터와 사용법 배우기</Text></Pressable>}
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={expanded ? '안내 접기' : '길라잡이 더 보기'} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} hitSlop={10}><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.green} /></Pressable>
    </View>
    {expanded && <LayoutScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled contentContainerStyle={s.destinations}>
      <Text style={s.message}>지금 보고 있는 화면과 재료를 바탕으로 AI에게 물어보세요.</Text>
      <TextInput accessibilityLabel="한끼에게 질문" value={question} onChangeText={setQuestion} maxLength={600} placeholder="예: 이 단계에서 불을 얼마나 줄여야 해?" placeholderTextColor={colors.muted} style={s.input} multiline />
      <Pressable accessibilityRole="button" disabled={aiGuideBusy || !question.trim()} onPress={() => { void askGuide(question.trim()); setQuestion(''); }} style={s.shortcut}><Text style={s.actionText}>{aiGuideBusy ? '한끼가 생각하고 있어요…' : 'AI 한끼에게 물어보기'}</Text></Pressable>
      {aiGuideBusy && <ActivityIndicator color={colors.green} />}
      {aiGuideError ? <Text style={{ color: colors.danger, fontSize: 14, lineHeight: 22 }}>{aiGuideError}</Text> : null}
      {aiGuideAnswer && <View style={{ gap: 4 }}><Text style={s.kicker}>AI 답변</Text><Text style={s.title}>{aiGuideAnswer.title}</Text><Text selectable style={s.message}>{aiGuideAnswer.message}</Text></View>}
      {navigationEnabled && <><View style={[s.row, { flexWrap: 'wrap' }]}>{destinations.map(item => <Pressable key={item.action} accessibilityRole="button" onPress={() => { setTab(item.action as Tab); setExpanded(false); }} style={s.shortcut}><Text style={s.actionText}>{item.label}</Text></Pressable>)}</View>
        {!tutorial && <Pressable accessibilityRole="button" onPress={() => { startTutorial(); setExpanded(false); }} style={s.shortcut}><Text style={s.actionText}>사용법 다시 배우기</Text></Pressable>}</>}
    </LayoutScrollView>}
  </View>;
}
const s = StyleSheet.create({
  progress: {maxWidth:1000,width:'100%',alignSelf:'center',gap:8,marginBottom:10},
  track: {height:4,backgroundColor:colors.line,borderRadius:4,overflow:'hidden'},
  card: { backgroundColor: 'white', borderRadius:16,borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, paddingVertical: 8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', maxWidth: 1000, width: '100%', alignSelf: 'center' },
  avatar: { width: 64, height: 68, justifyContent: 'center' },
  kicker: { fontSize: 12, fontWeight: '600', color: colors.green }, title: { color: colors.ink, fontSize: 16, fontWeight: '700', lineHeight: 23 },
  message: { fontSize: 14, lineHeight: 22, color: colors.muted }, action: { alignSelf: 'flex-start', backgroundColor:colors.surface, borderRadius:10, paddingHorizontal:12, paddingVertical:8, marginTop:3 },
  actionText: { fontSize: 14, fontWeight: '700', color: colors.green },
  destinations: { maxWidth: 1000, width: '100%', alignSelf: 'center', paddingTop: 12, gap: 10 },
  shortcut: { backgroundColor: 'white', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  input: { minHeight: 56, padding: 12, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: colors.line, color: colors.ink, fontSize: 15, textAlignVertical: 'top' },
});
