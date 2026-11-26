import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Choice, Field, Section } from './ui';
import { useApp } from '../state/AppProvider';
import { api } from '../services/api';
import { colors, ui } from '../theme';
import type { Recipe, Review } from '../types';

function Stars({
  value,
  onChange,
  size = 24,
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          disabled={!onChange}
          accessibilityRole={onChange ? 'button' : undefined}
          accessibilityLabel={onChange ? `별점 ${star}점` : undefined}
          onPress={() => onChange?.(star)}
          hitSlop={4}
        >
          <Ionicons
            name={star <= value ? 'star' : 'star-outline'}
            size={size}
            color={colors.amber}
          />
        </Pressable>
      ))}
    </View>
  );
}

export function Reviews({ recipe }: { recipe: Recipe }) {
  const app = useApp();
  const [data, setData] = useState<{
    reviews: Review[];
    rating: number;
    reviewCount: number;
  } | null>(null);
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
    api
      .reviews(recipe.id, controller.signal)
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError((e as Error).message);
      });
    return () => controller.abort();
  }, [recipe.id]);
  async function submit() {
    setBusy(true);
    setError('');
    try {
      setData(
        await api.review(recipe.id, {
          viewer: app.viewer,
          author: author.trim(),
          rating,
          content: content.trim(),
        }),
      );
      app.setNickname(author.trim());
      setWriting(false);
      setContent('');
      app.setNotice('후기를 남겼어요. 고마워요!');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!tracked)
    return <Text style={ui.muted}>이 레시피는 예전 버전에서 저장돼 후기를 남길 수 없어요.</Text>;
  return (
    <View style={{ gap: 12 }}>
      {data && data.reviewCount > 0 ? (
        <View style={[ui.row, { gap: 8 }]}>
          <Stars value={Math.round(data.rating)} size={18} />
          <Text style={ui.label}>
            {data.rating} · {data.reviewCount}개
          </Text>
        </View>
      ) : (
        <Text style={ui.muted}>아직 후기가 없어요. 만들어 보셨다면 첫 후기를 남겨주세요.</Text>
      )}
      {data?.reviews.slice(0, 10).map((review) => (
        <View
          key={review.id}
          style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 10, gap: 4 }}
        >
          <View style={[ui.row, { gap: 6 }]}>
            <Text style={ui.label}>{review.author}</Text>
            <Stars value={review.rating} size={12} />
            <Text style={ui.muted}>{review.createdAt.slice(0, 10)}</Text>
          </View>
          {!!review.content && <Text style={ui.text}>{review.content}</Text>}
        </View>
      ))}
      {writing ? (
        <View style={{ gap: 12, borderTopWidth: 1, borderColor: colors.line, paddingTop: 12 }}>
          <Stars value={rating} onChange={setRating} />
          <Field label="닉네임" maxLength={24} value={author} onChangeText={setAuthor} />
          <Field
            label="후기 (선택)"
            multiline
            maxLength={400}
            value={content}
            onChangeText={setContent}
            placeholder="맛, 분량, 바꿔본 재료를 알려주세요."
          />
          <View style={ui.row}>
            <Button small busy={busy} disabled={!author.trim()} onPress={() => void submit()}>
              후기 등록
            </Button>
            <Button small ghost onPress={() => setWriting(false)}>
              취소
            </Button>
          </View>
        </View>
      ) : (
        <Button small secondary icon="create-outline" onPress={() => setWriting(true)}>
          만들어 봤어요 · 후기 쓰기
        </Button>
      )}
      {!!error && <Text style={ui.error}>{error}</Text>}
    </View>
  );
}

const reportReasons = [
  '분량이 이상해요',
  '조리 순서가 이상해요',
  '알레르기 표기가 틀려요',
  '사진이 요리와 달라요',
  '기타',
] as const;
export function Report({ recipe }: { recipe: Recipe }) {
  const app = useApp();
  const [openForm, setOpenForm] = useState(false);
  const [reason, setReason] = useState<string>(reportReasons[0]);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  if (!/^ai-/.test(recipe.id)) return null;
  if (!openForm)
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpenForm(true)}
        style={{ alignSelf: 'center', padding: 8 }}
      >
        <Text style={[ui.muted, { textDecorationLine: 'underline' }]}>
          이 레시피에 문제가 있나요?
        </Text>
      </Pressable>
    );
  return (
    <Section title="문제 알리기">
      <Choice
        options={reportReasons.map((value) => ({ value, label: value }))}
        value={reason}
        onChange={setReason}
      />
      <Field
        label="자세한 내용 (선택)"
        multiline
        maxLength={400}
        value={detail}
        onChangeText={setDetail}
      />
      <View style={ui.row}>
        <Button
          small
          busy={busy}
          onPress={() => {
            setBusy(true);
            api
              .report(recipe.id, { viewer: app.viewer, reason, detail: detail.trim() })
              .then(() => {
                app.setNotice('알려주셔서 고마워요. 확인해볼게요.');
                setOpenForm(false);
                setDetail('');
              })
              .catch((e) => app.setNotice((e as Error).message))
              .finally(() => setBusy(false));
          }}
        >
          보내기
        </Button>
        <Button small ghost onPress={() => setOpenForm(false)}>
          취소
        </Button>
      </View>
    </Section>
  );
}

export function Finish({
  recipe,
  onDone,
}: {
  recipe: Recipe;
  onDone: (rating: number, memo: string) => void;
}) {
  const [rating, setRating] = useState(0);
  const [memo, setMemo] = useState('');
  return (
    <Section
      title="한 끼 완성! 기록을 남겨요"
      detail={`${recipe.name} · ${recipe.servings}인분 — 내 주방의 요리 기록에 저장돼요.`}
    >
      <Text style={ui.label}>만족도</Text>
      <Stars value={rating} onChange={setRating} />
      <Field
        label="메모 (선택)"
        multiline
        maxLength={300}
        value={memo}
        onChangeText={setMemo}
        placeholder="다음에 바꿔볼 점, 같이 먹은 사람 등"
      />
      <Button icon="checkmark-outline" onPress={() => onDone(rating, memo)}>
        기록하고 완료
      </Button>
    </Section>
  );
}
