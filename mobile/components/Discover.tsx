import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { api, assetUrl } from '../services/api';
import { useApp } from '../state/AppProvider';
import { colors, radius, ui } from '../theme';
import { compactCount, duration } from '../recipeTools';
import { Button, Choice, ListRow, Section, type IconName } from './ui';
import {
  cuisineOptions,
  parseIngredients,
  type Channel,
  type Cuisine,
  type Filter,
  type Ranking,
  type Recipe,
  type Theme,
  type Video,
  type YtChannel,
} from '../types';

const cuisineGlyphs: Partial<
  Record<Cuisine, React.ComponentProps<typeof MaterialCommunityIcons>['name']>
> = {
  all: 'silverware-fork-knife',
  korean: 'rice',
  chinese: 'food-takeout-box',
  japanese: 'fish',
  western: 'pasta',
  asian: 'noodles',
  snack: 'chili-mild',
  fusion: 'taco',
  dessert: 'cupcake',
};

/** Large greeting and the ingredient search card at the top of home. */
export function HomeHero({ onSearch }: { onSearch: (names: string[]) => void }) {
  const app = useApp();
  const [draft, setDraft] = useState('');
  const hour = new Date().getHours();
  const meal = hour < 10 ? '아침' : hour < 15 ? '점심' : hour < 21 ? '저녁' : '야식';
  function submit() {
    const names = parseIngredients(draft);
    if (!names.length) {
      app.setNotice('예: 계란, 김치, 두부처럼 재료를 입력해주세요.');
      return;
    }
    onSearch(names);
    setDraft('');
  }
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6, paddingHorizontal: 4, paddingTop: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.green }}>오늘 {meal}</Text>
        <Text accessibilityRole="header" style={ui.title}>
          뭘 해먹을까요?
        </Text>
      </View>
      <View style={ui.card}>
        <Text style={ui.label}>냉장고에 있는 재료로 찾아볼게요</Text>
        <TextInput
          accessibilityLabel="보유 재료 입력 (쉼표로 구분)"
          placeholder="계란, 김치, 두부"
          placeholderTextColor={colors.muted}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          returnKeyType="search"
          style={ui.input}
        />
        {app.settings.ingredients.length > 0 && (
          <Text style={ui.muted} numberOfLines={1}>
            내 냉장고 · {app.settings.ingredients.join(', ')}
          </Text>
        )}
        <Button large busy={app.searching} onPress={submit}>
          맞춤 레시피 찾기
        </Button>
      </View>
    </View>
  );
}

const situations: {
  label: string;
  icon: IconName;
  color: string;
  filter?: Filter;
  popular?: boolean;
}[] = [
  { label: '10분 요리', icon: 'flash', color: '#F59E0B', filter: 'ten' },
  { label: '30분 안에', icon: 'time', color: '#3B82F6', filter: 'thirty' },
  { label: '초보 성공', icon: 'happy', color: '#22C55E', filter: 'easy' },
  { label: '지금 인기', icon: 'flame', color: '#EF4444', popular: true },
  { label: '가볍게', icon: 'leaf', color: '#10B981', filter: 'light' },
  { label: '바로 가능', icon: 'snow', color: '#06B6D4', filter: 'ready' },
];
/** Toss-style 3×2 tiles; each opens the recipe list with that filter. */
export function SituationGrid({ onPick }: { onPick: (filter: Filter | 'popular') => void }) {
  return (
    <Section title="상황별로 찾기">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
        {situations.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => onPick(item.popular ? 'popular' : item.filter!)}
            style={({ pressed }) => ({
              width: '33.33%',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: pressed ? colors.fill : 'transparent',
            })}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: item.color + '1F',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={item.icon} size={24} color={item.color} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.sub }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

export function CategoryRow({
  value,
  onChange,
  title = '카테고리',
}: {
  value: Cuisine;
  onChange: (value: Cuisine) => void;
  title?: string;
}) {
  return (
    <Section title={title}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 4 }}
      >
        {cuisineOptions
          .filter((option) => cuisineGlyphs[option.value])
          .map((option) => {
            const selected = value === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.label} 요리`}
                onPress={() => onChange(option.value)}
                style={{ alignItems: 'center', gap: 6, width: 62 }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? colors.green : colors.fill,
                  }}
                >
                  <MaterialCommunityIcons
                    name={cuisineGlyphs[option.value]!}
                    size={24}
                    color={selected ? 'white' : colors.sub}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: selected ? '700' : '500',
                    color: selected ? colors.green : colors.sub,
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
      </ScrollView>
    </Section>
  );
}

export function TodayLineup({ onPick }: { onPick: (value: Exclude<Theme, ''>) => void }) {
  const now = new Date();
  const month = now.getMonth() + 1;
  return (
    <Section title="오늘의 편성" detail={`${month}월 ${now.getDate()}일 기준`}>
      <View>
        <ListRow
          icon="heart"
          iconColor="#EC4899"
          title="취향 기반 추천"
          caption="저장하고 만든 요리와 비슷한 메뉴"
          onPress={() => onPick('taste')}
        />
        <ListRow
          icon="leaf"
          iconColor="#22C55E"
          title={`${month}·${(month % 12) + 1}월 제철 레시피`}
          caption="지금 가장 맛있는 제철 재료로"
          onPress={() => onPick('seasonal')}
        />
        <ListRow
          icon="wallet"
          iconColor="#F59E0B"
          title="만원의 식탁"
          caption="1인분 재료비 만 원 이하"
          onPress={() => onPick('budget')}
        />
      </View>
    </Section>
  );
}

const periods = [
  { value: 'today' as const, label: '오늘' },
  { value: 'week' as const, label: '이번 주' },
  { value: 'all' as const, label: '전체' },
];
export function RankingView({
  onOpen,
  compact = false,
  onMore,
}: {
  onOpen: (recipe: Recipe) => void;
  compact?: boolean;
  onMore?: () => void;
}) {
  const app = useApp();
  const [period, setPeriod] = useState<'today' | 'week' | 'all'>(compact ? 'all' : 'today');
  const [rows, setRows] = useState<Ranking[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  async function load() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    try {
      const result = await api.rankings(period, controller.signal);
      if (controller.signal.aborted) return;
      setRows(result.rankings);
      app.setViews((current) => ({
        ...current,
        ...Object.fromEntries(result.rankings.map((row) => [row.recipe.id, row.views])),
      }));
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => active.current?.abort();
  }, [period]);
  const shown = compact ? rows.slice(0, 5) : rows;
  return (
    <Section title="지금 뜨는 레시피" action={compact ? '전체' : undefined} onAction={onMore}>
      <Choice options={periods} value={period} onChange={setPeriod} />
      {busy && <ActivityIndicator color={colors.green} />}
      {!!error && (
        <View style={{ gap: 8 }}>
          <Text style={ui.error}>{error}</Text>
          <Button small secondary onPress={() => void load()}>
            다시 불러오기
          </Button>
        </View>
      )}
      {!busy && !error && !rows.length && (
        <Text style={ui.muted}>
          아직 이 기간에 열어본 레시피가 없어요. 레시피를 열면 조회수로 순위가 매겨져요.
        </Text>
      )}
      <View>
        {shown.map((row, index) => (
          <Pressable
            key={row.recipe.id}
            accessibilityRole="button"
            accessibilityLabel={`${index + 1}위 ${row.recipe.name}`}
            onPress={() => onOpen(row.recipe)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: pressed ? colors.fill : 'transparent',
            })}
          >
            <Text
              style={{
                width: 22,
                fontSize: 17,
                fontWeight: '800',
                color: index < 3 ? colors.green : colors.muted,
                textAlign: 'center',
              }}
            >
              {index + 1}
            </Text>
            <Image
              source={{ uri: row.recipe.photo ? assetUrl(row.recipe.photo.url) : undefined }}
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.thumb,
                backgroundColor: colors.fill,
              }}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[ui.label, { fontSize: 16 }]} numberOfLines={1}>
                {row.recipe.name}
              </Text>
              <Text style={[ui.muted, { fontSize: 13 }]} numberOfLines={1}>
                조회 {compactCount(row.views)} ·{' '}
                {cuisineOptions.find((c) => c.value === row.recipe.cuisine)?.label || '기타'}
                {row.reviewCount ? ` · ★ ${row.rating}` : ''}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

/** YouTube thumbnail card with "레시피로 정리" that turns the video into a catalog recipe. */
export function VideoCard({
  video,
  width,
  busy,
  onRecipe,
}: {
  video: Video;
  width?: number;
  busy: boolean;
  onRecipe: () => void;
}) {
  return (
    <View style={{ width, gap: 8 }}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${video.title} 유튜브에서 보기`}
        onPress={() => void Linking.openURL(video.url)}
        style={{ borderRadius: 14, overflow: 'hidden', backgroundColor: colors.fill }}
      >
        <Image
          source={{ uri: video.thumbnail }}
          style={{ width: '100%', aspectRatio: 16 / 9 }}
          resizeMode="cover"
        />
        {video.seconds > 0 && (
          <Text
            style={{
              position: 'absolute',
              right: 6,
              bottom: 6,
              color: 'white',
              fontSize: 11,
              fontWeight: '700',
              backgroundColor: 'rgba(0,0,0,.75)',
              borderRadius: 4,
              paddingHorizontal: 5,
              paddingVertical: 1,
              overflow: 'hidden',
            }}
          >
            {duration(video.seconds)}
          </Text>
        )}
      </Pressable>
      <Text style={[ui.label, { fontSize: 14 }]} numberOfLines={2}>
        {video.title}
      </Text>
      <Text style={[ui.muted, { fontSize: 12 }]} numberOfLines={1}>
        {video.channel} · 조회수 {compactCount(video.views)}회
      </Text>
      {video.recipeReady === false ? (
        <Button small ghost icon="create-outline" onPress={onRecipe}>
          설명 붙여넣고 정리
        </Button>
      ) : (
        <Button small secondary icon="sparkles" busy={busy} onPress={onRecipe}>
          레시피로 정리
        </Button>
      )}
    </View>
  );
}

export function ChannelList() {
  const app = useApp();
  const [analysed, setAnalysed] = useState<Channel[]>([]);
  const [popular, setPopular] = useState<YtChannel[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const mine = (await api.channels(controller.signal)).channels;
        setAnalysed(mine);
        if (app.youtubeEnabled) {
          // Popular Korean cooking channels, plus any channel whose videos were turned into recipes here.
          const ids = mine.flatMap((c) => (c.channelId ? [c.channelId] : [])).slice(0, 30);
          const [top, used] = await Promise.all([
            api.youtubeChannels([], controller.signal),
            ids.length
              ? api.youtubeChannels(ids, controller.signal)
              : Promise.resolve({ channels: [] }),
          ]);
          const merged = [
            ...top.channels,
            ...used.channels.filter((c) => !top.channels.some((t) => t.id === c.id)),
          ];
          setPopular(merged.sort((a, b) => b.subscribers - a.subscribers));
        }
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    })();
    return () => controller.abort();
  }, [app.youtubeEnabled]);
  const counts = new Map(analysed.map((c) => [c.channelId || c.name, c.analyses]));
  return (
    <Section
      title="인기 요리 채널"
      detail={
        popular.length ? '구독자 수는 YouTube 공개 통계예요' : '한끼에서 레시피로 정리한 채널이에요'
      }
    >
      {busy && <ActivityIndicator color={colors.green} />}
      {!!error && <Text style={ui.error}>{error}</Text>}
      {!busy && !error && !popular.length && !analysed.length && (
        <Text style={ui.muted}>
          아직 정리한 영상이 없어요. 영상에서 '레시피로 정리'를 눌러보세요.
        </Text>
      )}
      <View>
        {popular.map((channel) => (
          <ListRow
            key={channel.id}
            image={channel.thumbnail}
            title={channel.name}
            caption={`구독자 ${channel.subscribers < 0 ? '비공개' : compactCount(channel.subscribers)} · 영상 ${compactCount(channel.videoCount)}개${counts.get(channel.id) ? ` · 한끼 정리 ${counts.get(channel.id)}개` : ''}`}
            onPress={() => void Linking.openURL(channel.url)}
          />
        ))}
        {!popular.length &&
          analysed.map((channel) => (
            <ListRow
              key={channel.name}
              icon="logo-youtube"
              iconColor="#EF4444"
              title={channel.name}
              caption={`한끼 정리 ${channel.analyses}회 · 영상 ${channel.videos.length}개`}
              onPress={() =>
                void Linking.openURL(
                  'https://www.youtube.com/results?search_query=' +
                    encodeURIComponent(channel.name),
                )
              }
            />
          ))}
      </View>
    </Section>
  );
}
