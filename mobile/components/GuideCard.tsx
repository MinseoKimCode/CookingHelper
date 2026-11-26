import { LayoutScrollView } from './LayoutScrollView';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Monster } from './Monster';
import { useGuidance } from '../state/AppProvider';
import { colors } from '../theme';
import type { GuideAction, MonsterMood } from '../guide';
import type { Tab } from '../types';
import { stepLabels, tutorialSteps } from '../tutorial';

const moodLabels: Record<MonsterMood, string> = {
  idle: '함께 있어요',
  listening: '듣고 있어요',
  thinking: '고민 중이에요',
  scanning: '살펴보고 있어요',
  cooking: '요리 중이에요',
  happy: '신나요!',
  puzzled: '같이 해결해봐요',
};
const destinations: { action: GuideAction; label: string }[] = [
  { action: 'recipes', label: '홈' },
  { action: 'pantry', label: '재료 입력' },
  { action: 'saved', label: '저장한 요리' },
  { action: 'kitchen', label: '내 주방' },
  { action: 'community', label: '요리 이야기' },
];
/**
 * `bar` (phones, recipe sheets): one quiet line until tapped, so the monster never covers the screen.
 * `panel` (wide sidebar): the full card. A running tutorial always shows its message and buttons.
 */
function GuideCardContent({
  navigationEnabled = true,
  variant = 'bar',
}: {
  navigationEnabled?: boolean;
  variant?: 'bar' | 'panel';
}) {
  const {
    guide,
    tab,
    setTab,
    recommend,
    searching,
    tutorial,
    tutorialStep,
    tutorialCompleted,
    startTutorial,
    nextTutorial,
    skipTutorial,
    stopTutorial,
    aiGuideAnswer,
    aiGuideBusy,
    aiGuideError,
    askGuide,
  } = useGuidance();
  const [expanded, setExpanded] = useState(false);
  const [greeting, setGreeting] = useState(false);
  const [question, setQuestion] = useState('');
  useEffect(() => {
    if (!greeting) return;
    const timer = setTimeout(() => setGreeting(false), 1800);
    return () => clearTimeout(timer);
  }, [greeting]);
  const mood = aiGuideBusy
    ? 'thinking'
    : greeting && (guide.mood === 'idle' || guide.mood === 'happy')
      ? 'listening'
      : guide.mood;
  function act(action: GuideAction) {
    if (action === 'recommend') void recommend();
    else setTab(action);
  }
  const bar = variant === 'bar';
  const detailed = !bar || expanded || !!tutorial;
  const actions = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {!tutorial && guide.action && navigationEnabled && (
        <Pressable
          accessibilityRole="button"
          disabled={guide.action === 'recommend' && searching}
          onPress={() => act(guide.action!)}
          style={s.action}
        >
          <Text style={s.actionText}>{guide.actionLabel}</Text>
        </Pressable>
      )}
      {tutorial?.event === 'continue' && (
        <Pressable
          accessibilityRole="button"
          onPress={nextTutorial}
          style={[s.action, { backgroundColor: colors.green }]}
        >
          <Text style={[s.actionText, { color: 'white' }]}>
            {tutorial.id === 'welcome'
              ? '함께 시작하기'
              : tutorial.id === 'complete'
                ? '안내 마치기'
                : tutorial.nextLabel || '다음'}
          </Text>
        </Pressable>
      )}
      {tutorial?.event !== 'continue' &&
        tutorial?.action &&
        tutorial.action !== tab &&
        navigationEnabled && (
          <Pressable
            accessibilityRole="button"
            disabled={searching}
            onPress={() => act(tutorial.action!)}
            style={s.action}
          >
            <Text style={s.actionText}>{tutorial.actionLabel}</Text>
          </Pressable>
        )}
      {tutorial && tutorial.event !== 'continue' && (
        <Pressable
          accessibilityRole="button"
          onPress={skipTutorial}
          style={[s.action, { backgroundColor: 'transparent' }]}
        >
          <Text style={[s.actionText, { color: colors.muted }]}>건너뛰기</Text>
        </Pressable>
      )}
      {!bar && !tutorial && !tutorialCompleted && navigationEnabled && (
        <Pressable accessibilityRole="button" onPress={startTutorial} style={s.action}>
          <Text style={s.actionText}>사용법 둘러보기</Text>
        </Pressable>
      )}
    </View>
  );
  return (
    <View style={[s.card, bar && s.bar, !!tutorial && s.tutorialCard]} testID="monster-guide">
      {tutorial && (
        <View style={s.progress}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Text style={s.kicker}>
              {tutorial.id === 'welcome'
                ? '시작하기 전에'
                : tutorial.id === 'complete'
                  ? '둘러보기 완료'
                  : `${stepLabels[tutorial.id]} · ${tutorialStep}/${tutorialSteps.length - 2}`}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="사용 안내 닫기"
              onPress={stopTutorial}
              hitSlop={8}
              style={{
                minWidth: 32,
                minHeight: 32,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="사용 안내 진행"
            accessibilityValue={{ min: 0, max: tutorialSteps.length - 1, now: tutorialStep ?? 0 }}
            style={s.track}
          >
            <View
              style={{
                height: 3,
                backgroundColor: colors.green,
                width: `${((tutorialStep ?? 0) / (tutorialSteps.length - 1)) * 100}%`,
              }}
            />
          </View>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? '한끼 안내 접기' : '한끼 안내 펼치기'}
        accessibilityState={{ expanded }}
        disabled={!bar}
        onPress={() => {
          setGreeting(true);
          setExpanded(!expanded);
        }}
        style={[s.row, { alignItems: detailed ? 'flex-start' : 'center' }]}
      >
        <View style={{ width: tutorial ? 32 : bar ? 40 : 60, alignItems: 'center' }}>
          <Monster mood={mood} size={tutorial ? 32 : bar ? 40 : 60} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          {!bar && !tutorial && <Text style={s.kicker}>한끼 · {moodLabels[guide.mood]}</Text>}
          <Text
            style={[s.title, bar && { fontSize: 14 }]}
            numberOfLines={detailed ? undefined : 1}
            accessibilityLiveRegion="polite"
          >
            {guide.title}
          </Text>
          <Text
            style={s.message}
            numberOfLines={tutorial && !expanded ? 3 : detailed ? undefined : 1}
          >
            {guide.message}
          </Text>
        </View>
        {bar && (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.muted}
          />
        )}
        {!bar && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'AI 질문 접기' : 'AI에게 질문하기'}
            onPress={() => setExpanded(!expanded)}
            hitSlop={10}
          >
            <Ionicons
              name={expanded ? 'chevron-up' : 'chatbubble-ellipses-outline'}
              size={18}
              color={colors.green}
            />
          </Pressable>
        )}
      </Pressable>
      {detailed && (
        <View style={{ paddingLeft: tutorial ? 0 : bar ? 52 : 72, paddingTop: 6 }}>{actions}</View>
      )}
      {expanded && (
        <LayoutScrollView
          style={{ maxHeight: 280 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          contentContainerStyle={s.destinations}
        >
          <Text style={s.message}>지금 보고 있는 화면과 재료를 바탕으로 AI에게 물어보세요.</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              accessibilityLabel="한끼에게 질문"
              value={question}
              onChangeText={setQuestion}
              maxLength={600}
              placeholder="예: 이 단계에서 불을 얼마나 줄여야 해?"
              placeholderTextColor={colors.muted}
              style={s.input}
              multiline
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="AI 한끼에게 물어보기"
              disabled={aiGuideBusy || !question.trim()}
              onPress={() => {
                void askGuide(question.trim());
                setQuestion('');
              }}
              style={[s.send, (aiGuideBusy || !question.trim()) && { opacity: 0.45 }]}
            >
              {aiGuideBusy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Ionicons name="arrow-up" size={18} color="white" />
              )}
            </Pressable>
          </View>
          {aiGuideError ? (
            <Text style={{ color: colors.danger, fontSize: 13, lineHeight: 20 }}>
              {aiGuideError}
            </Text>
          ) : null}
          {aiGuideAnswer && (
            <View style={{ gap: 4, backgroundColor: colors.tint, borderRadius: 10, padding: 12 }}>
              <Text style={s.title}>{aiGuideAnswer.title}</Text>
              <Text selectable style={[s.message, { color: colors.ink }]}>
                {aiGuideAnswer.message}
              </Text>
            </View>
          )}
          {navigationEnabled && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {destinations.map((item) => (
                <Pressable
                  key={item.action}
                  accessibilityRole="button"
                  onPress={() => {
                    setTab(item.action as Tab);
                    setExpanded(false);
                  }}
                  style={s.action}
                >
                  <Text style={s.actionText}>{item.label}</Text>
                </Pressable>
              ))}
              {!tutorial && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    startTutorial();
                    setExpanded(false);
                  }}
                  style={s.action}
                >
                  <Text style={s.actionText}>
                    {tutorialCompleted ? '사용법 다시 보기' : '사용법 둘러보기'}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </LayoutScrollView>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  progress: { maxWidth: 1000, width: '100%', alignSelf: 'center', gap: 6, marginBottom: 8 },
  track: { height: 3, backgroundColor: colors.line, borderRadius: 3, overflow: 'hidden' },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 18 },
  tutorialCard: { borderWidth: 1, borderColor: colors.line, paddingTop: 6, paddingBottom: 10 },
  bar: {
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  kicker: { fontSize: 12, fontWeight: '600', color: colors.green },
  title: { color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 21 },
  message: { fontSize: 13, lineHeight: 20, color: colors.muted },
  action: {
    backgroundColor: colors.light,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: { fontSize: 13, fontWeight: '700', color: colors.green },
  destinations: { maxWidth: 1000, width: '100%', alignSelf: 'center', paddingTop: 12, gap: 10 },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.fill,
    borderRadius: 12,
    color: colors.ink,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const GuideCard = React.memo(GuideCardContent);
