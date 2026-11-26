import { LayoutScrollView } from '../components/LayoutScrollView';
import { SectionCover } from '../components/SectionCover';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Choice, Field, Section } from '../components/ui';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../state/AppProvider';
import { api } from '../services/api';
import { pickPhoto } from '../services/photos';
import { useGuideActivity } from '../hooks/useGuideActivity';
import { Inventory } from '../components/Inventory';
import { TutorialTarget } from '../components/TutorialTarget';
import { colors, ui } from '../theme';
import {
  cuisineOptions,
  levelLabels,
  parseIngredients,
  validateIngredientNames,
  mergeIngredientNames,
  type Level,
} from '../types';

export function PantryScreen() {
  const {
    settings,
    updateSettings,
    searching,
    recommend,
    cancelSearch,
    setNotice,
    aiEnabled,
    reactGuide,
    tutorial,
    tutorialEvent,
    setTab,
  } = useApp();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const targetOffsets = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!tutorial) return;
    const timer = setTimeout(() => {
      const offset = targetOffsets.current[tutorial.id];
      if (offset === undefined) return;
      scroll.current?.scrollTo({
        y: Math.max(0, offset - 12),
        animated: true,
      });
    }, 200);
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
  useGuideActivity(
    photoBusy
      ? {
          mood: 'scanning',
          title: '사진 속 재료를 살펴보고 있어요',
          message: '어떤 재료가 보이는지 찾아볼게요. 잠시만 기다려주세요.',
          priority: 100,
        }
      : photo
        ? {
            mood: 'listening',
            title: '제가 찾은 재료가 맞나요?',
            message: '아래 인식 결과에서 잘못 읽은 이름을 고치고, 재료에 추가해주세요.',
            priority: 70,
          }
        : listening
          ? {
              mood: 'listening',
              title: '어떤 재료인지 듣고 있어요',
              message: '쉼표로 나눠 적고 추가를 눌러주세요. 재료를 다 넣으면 함께 메뉴를 골라봐요.',
              priority: 30,
            }
          : null,
  );
  function add() {
    const names = parseIngredients(draft);
    const merged = mergeIngredientNames(settings.ingredients, names);
    if (!merged) {
      setNotice('재료는 60개까지, 이름은 40자 이내로 입력해주세요.');
      return;
    }
    if (!names.length) return;
    updateSettings({ ingredients: merged });
    setDraft('');
    tutorialEvent('ingredientsAdded');
    reactGuide({
      mood: 'happy',
      title: '재료를 기억했어요!',
      message: `${names.join(', ')}${names.length > 1 ? ' 등을' : '를'} 추가했어요. 더 있는 재료나 양념도 알려주세요.`,
    });
  }
  async function recognize(camera: boolean) {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const image = await pickPhoto(camera);
      if (!image) return;
      const result = await api.recognize(image);
      setPhoto(image);
      setRecognized(result.ingredients.join(', '));
    } catch (error) {
      setNotice((error as Error).message);
      reactGuide({
        mood: 'puzzled',
        title: '사진을 읽다가 잠깐 멈췄어요',
        message: `${(error as Error).message} 재료를 직접 적어도 괜찮아요.`,
      });
    } finally {
      setPhotoBusy(false);
    }
  }
  function confirmPhoto() {
    const names = parseIngredients(recognized);
    if (!names.length) {
      setNotice('인식된 재료 이름을 확인해주세요.');
      return;
    }
    const merged = mergeIngredientNames(settings.ingredients, names);
    if (!merged) {
      setNotice(
        '재료는 60개까지, 이름은 40자 이내로 입력해주세요. 기존 재료나 인식 결과를 줄여주세요.',
      );
      return;
    }
    updateSettings({ ingredients: merged });
    setPhoto(null);
    tutorialEvent('ingredientsAdded');
    reactGuide({
      mood: 'happy',
      title: '사진 속 재료를 함께 확인했어요!',
      message: '이제 양념과 제외할 재료를 확인하고 요리를 찾아볼까요?',
      action: 'recommend',
      actionLabel: '요리 찾아보기',
    });
  }
  const openShopping = (settings.shopping || []).filter((item) => !item.checked);
  return (
    <LayoutScrollView
      ref={scroll}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={ui.page}
    >
      <SectionCover
        title="내 냉장고"
        detail="가진 재료를 담아두면 맞춤 메뉴를 추천받을 수 있어요."
      />
      <TutorialTarget
        target="ingredients"
        onLayout={(event) => {
          targetOffsets.current.ingredients = event.nativeEvent.layout.y;
        }}
      >
        <Section
          title="재료"
          detail={
            settings.ingredients.length
              ? `${settings.ingredients.length}개 · 눌러서 빼기`
              : '쉼표로 나눠 입력하거나 사진으로 찾아보세요'
          }
        >
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[ui.input, { flex: 1, minWidth: 0 }]}
              accessibilityLabel="재료 입력"
              placeholder="예: 달걀, 토마토, 대파"
              placeholderTextColor={colors.muted}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={add}
              onFocus={() => setListening(true)}
              onBlur={() => setListening(false)}
              returnKeyType="done"
            />
            <Button onPress={add} icon="add">
              추가
            </Button>
          </View>
          <View style={ui.row}>
            <Button
              small
              ghost
              icon="camera-outline"
              busy={photoBusy}
              onPress={() => void recognize(true)}
            >
              사진 찍기
            </Button>
            <Button
              small
              ghost
              icon="images-outline"
              disabled={photoBusy}
              onPress={() => void recognize(false)}
            >
              앨범에서 선택
            </Button>
          </View>
          {settings.ingredients.length > 0 && (
            <View style={[ui.row, { gap: 6 }]}>
              {settings.ingredients.map((name) => (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityLabel={`${name} 빼기`}
                  onPress={() =>
                    updateSettings({ ingredients: settings.ingredients.filter((x) => x !== name) })
                  }
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingLeft: 12,
                    paddingRight: 8,
                    paddingVertical: 7,
                    backgroundColor: colors.light,
                    borderRadius: 16,
                  }}
                >
                  <Text style={{ color: colors.ink, fontSize: 14 }}>{name}</Text>
                  <Ionicons name="close" size={14} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          )}
          {photo && (
            <View style={[ui.card, { gap: 12 }]}>
              <Image
                source={{ uri: photo }}
                style={{ width: '100%', height: 180, borderRadius: 10 }}
                resizeMode="cover"
              />
              <Field
                label="인식 결과를 확인하고 고쳐주세요"
                value={recognized}
                onChangeText={setRecognized}
                multiline
              />
              <View style={ui.row}>
                <Button small onPress={confirmPhoto}>
                  재료에 추가
                </Button>
                <Button small ghost onPress={() => setPhoto(null)}>
                  취소
                </Button>
              </View>
            </View>
          )}
        </Section>
      </TutorialTarget>
      <TutorialTarget
        target="recommend"
        onLayout={(event) => {
          targetOffsets.current.recommend = event.nativeEvent.layout.y;
        }}
      >
        <View style={{ gap: 8 }}>
          <Button
            icon="sparkles-outline"
            busy={searching}
            disabled={!settings.ingredients.length}
            onPress={() => {
              if (draft.trim()) {
                setNotice('입력 중인 재료를 먼저 추가해주세요.');
                return;
              }
              void recommend();
            }}
          >
            이 재료로 요리 찾기
          </Button>
          {searching && (
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={[ui.muted, { flex: 1 }]}>메뉴를 만들고 검토하고 있어요…</Text>
              <Button small ghost onPress={cancelSearch}>
                취소
              </Button>
            </View>
          )}
        </View>
      </TutorialTarget>
      {(settings.ingredients.length > 0 || !!settings.undoStock?.length) && <Inventory />}
      {openShopping.length > 0 && (
        <Section
          title="장보기 리스트"
          detail={`${openShopping
            .slice(0, 5)
            .map((item) => item.name)
            .join(', ')}${openShopping.length > 5 ? ` 외 ${openShopping.length - 5}개` : ''}`}
          action="전체 보기"
          onAction={() => setTab('kitchen')}
        />
      )}
      <TutorialTarget
        target="preferences"
        onLayout={(event) => {
          targetOffsets.current.preferences = event.nativeEvent.layout.y;
        }}
      >
        <View style={ui.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: preferencesOpen }}
            onPress={() => setShowPreferences((value) => !value)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={ui.heading}>추천 설정</Text>
              <Text style={ui.muted}>
                {levelLabels[settings.level]} · {settings.servings}인분 ·{' '}
                {cuisineOptions.find((c) => c.value === settings.cuisine)?.label} · 추가 재료{' '}
                {settings.maxExtraIngredients}개까지
              </Text>
            </View>
            <Ionicons
              name={preferencesOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.muted}
            />
          </Pressable>
          {preferencesOpen && (
            <View style={{ gap: 16, paddingTop: 4 }}>
              <View style={{ gap: 8 }}>
                <Text style={ui.label}>요리 숙련도</Text>
                <Choice
                  options={levelLabels.map((label, value) => ({ value: value as Level, label }))}
                  value={settings.level}
                  onChange={(level) => updateSettings({ level })}
                />
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={ui.label}>인분</Text>
                <View style={[ui.row, { gap: 4 }]}>
                  <Button
                    small
                    secondary
                    disabled={settings.servings <= 1}
                    onPress={() => updateSettings({ servings: settings.servings - 1 })}
                  >
                    −
                  </Button>
                  <Text style={[ui.label, { minWidth: 44, textAlign: 'center' }]}>
                    {settings.servings}인분
                  </Text>
                  <Button
                    small
                    secondary
                    disabled={settings.servings >= 6}
                    onPress={() => updateSettings({ servings: settings.servings + 1 })}
                  >
                    ＋
                  </Button>
                </View>
              </View>
              <View style={{ gap: 8 }}>
                <Text style={ui.label}>요리 종류</Text>
                <Choice
                  scroll
                  options={cuisineOptions}
                  value={settings.cuisine}
                  onChange={(cuisine) => updateSettings({ cuisine })}
                />
              </View>
              <Field
                label="보유 양념"
                placeholder="예: 소금, 식용유, 간장"
                value={pantryDraft}
                onChangeText={(text) => {
                  const names = parseIngredients(text);
                  if (!validateIngredientNames(names)) {
                    setNotice('양념은 60개까지, 이름은 40자 이내로 입력해주세요.');
                    return;
                  }
                  setPantryDraft(text);
                  updateSettings({ pantry: names });
                }}
              />
              <Field
                label="제외 재료 · 알레르기"
                placeholder="예: 우유, 밀"
                value={excludedDraft}
                onChangeText={(text) => {
                  const names = parseIngredients(text);
                  if (!validateIngredientNames(names)) {
                    setNotice('제외 재료는 60개까지, 이름은 40자 이내로 입력해주세요.');
                    return;
                  }
                  setExcludedDraft(text);
                  updateSettings({ excluded: names });
                }}
              />
              <View style={{ gap: 8 }}>
                <Text style={ui.label}>추가로 사도 되는 재료</Text>
                <Choice
                  options={[
                    { value: 0, label: '없음' },
                    { value: 2, label: '2개' },
                    { value: 5, label: '5개' },
                    { value: 10, label: '10개' },
                  ]}
                  value={settings.maxExtraIngredients}
                  onChange={(maxExtraIngredients) => updateSettings({ maxExtraIngredients })}
                />
              </View>
              <View style={{ gap: 8 }}>
                <Text style={ui.label}>한 번에 추천받을 메뉴</Text>
                <Choice
                  options={[
                    { value: 3, label: '3개' },
                    { value: 6, label: '6개' },
                    { value: 12, label: '12개' },
                  ]}
                  value={settings.resultCount}
                  onChange={(resultCount) => updateSettings({ resultCount })}
                />
              </View>
              <Text style={[ui.muted, { fontSize: 12 }]}>
                복합 식품의 모든 성분을 판별하지는 못해요. 알레르기가 있다면 실제 제품의 원재료도
                확인해주세요.
              </Text>
            </View>
          )}
        </View>
      </TutorialTarget>
      {aiEnabled === false && (
        <Text style={ui.muted}>
          메뉴 추천·사진 인식·AI 질문에는 서버의 OpenAI API 연결이 필요해요. 저장한 요리와 기본 사용
          안내는 계속 볼 수 있어요.
        </Text>
      )}
    </LayoutScrollView>
  );
}
