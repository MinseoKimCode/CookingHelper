import { communityReceipt } from '../communityReceipt';
import { CommunityActions } from '../components/CommunityActions';
import { loadOwnership, rememberOwnership } from '../services/ownership';
import { LayoutScrollView } from '../components/LayoutScrollView';
import { SectionCover } from '../components/SectionCover';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Button, Empty, Field, Sheet } from '../components/ui';
import { useApp } from '../state/AppProvider';
import { api, assetUrl } from '../services/api';
import { pickPhoto } from '../services/photos';
import { useGuideActivity } from '../hooks/useGuideActivity';
import { colors, ui } from '../theme';
import type { Post } from '../types';

function CommunityScreenContent() {
  const { viewer, nickname, setNickname, setNotice, reactGuide } = useApp();
  const [pendingOwnership, setPendingOwnership] = useState<Record<string, string>>({});
  const [ownership, setOwnership] = useState<Record<string, string>>({});
  useEffect(() => {
    void loadOwnership()
      .then(setOwnership)
      .catch((e) => setNotice((e as Error).message));
  }, []);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [writing, setWriting] = useState(false);
  const [thread, setThread] = useState<Post | null>(null);
  const [opening, setOpening] = useState(false);
  const [author, setAuthor] = useState(nickname);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState<string[]>([]);
  const likes = useRef(new Set<string>());
  const version = useRef(0);
  const threadVersion = useRef(0);
  const [threadError, setThreadError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mounted = useRef(true);
  useGuideActivity(
    photoBusy
      ? {
          mood: 'scanning',
          title: '요리 사진을 준비하고 있어요',
          message: '사진 크기를 맞추고 있어요. 잠시만 기다려주세요.',
          priority: 100,
        }
      : sending || commentBusy
        ? {
            mood: 'thinking',
            title: '요리 이야기를 전하고 있어요',
            message: '등록이 끝날 때까지 잠시만 기다려주세요.',
            priority: 85,
          }
        : writing
          ? {
              mood: 'listening',
              title: '오늘의 요리는 어땠나요?',
              message: '닉네임과 제목, 요리 이야기를 적어주세요. 완성 사진도 함께 올릴 수 있어요.',
              priority: 60,
            }
          : selectedId
            ? {
                mood: opening ? 'thinking' : 'listening',
                title: opening ? '이야기를 열어볼게요' : '함께 만든 요리 이야기를 나눠봐요',
                message: opening
                  ? '게시글과 댓글을 가져오고 있어요.'
                  : '궁금한 점이나 응원의 말을 댓글로 남겨보세요.',
                priority: 60,
              }
            : loading
              ? {
                  mood: 'thinking',
                  title: '다른 주방의 이야기를 찾고 있어요',
                  message: '최신 요리 후기를 가져올게요.',
                  priority: 75,
                }
              : null,
  );
  useEffect(() => {
    void load();
    return () => {
      mounted.current = false;
      version.current++;
      threadVersion.current++;
    };
  }, []);
  function merge(post: Post) {
    if (!mounted.current) return;
    setPosts((current) =>
      current.map((old) => (old.id === post.id && old.revision <= post.revision ? post : old)),
    );
    setThread((current) =>
      current?.id === post.id && current.revision <= post.revision ? post : current,
    );
  }
  async function load(more = false) {
    const current = ++version.current;
    setLoading(true);
    setFeedError('');
    try {
      const result = await api.feed(viewer, more ? cursor || undefined : undefined);
      if (current !== version.current) return;
      setPosts((old) =>
        more
          ? [...old, ...result.posts.filter((p) => !old.some((x) => x.id === p.id))]
          : result.posts,
      );
      setCursor(result.nextCursor);
    } catch (e) {
      if (current === version.current) setFeedError((e as Error).message);
    } finally {
      if (current === version.current) setLoading(false);
    }
  }
  async function open(id: string) {
    const current = ++threadVersion.current;
    setSelectedId(id);
    setThread(null);
    setOpening(true);
    setThreadError('');
    setComment('');
    setAuthor(nickname);
    try {
      const result = await api.post(id, viewer);
      if (current === threadVersion.current) {
        setThread(result);
        merge(result);
      }
    } catch (e) {
      if (current === threadVersion.current) setThreadError((e as Error).message);
    } finally {
      if (current === threadVersion.current) setOpening(false);
    }
  }
  async function toggleLike(post: Post) {
    if (likes.current.has(post.id)) return;
    likes.current.add(post.id);
    setLikeBusy([...likes.current]);
    try {
      merge(await api.like(post.id, viewer, !post.liked));
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      likes.current.delete(post.id);
      if (mounted.current) setLikeBusy([...likes.current]);
    }
  }
  async function choosePhoto(camera = false) {
    setPhotoBusy(true);
    try {
      const image = await pickPhoto(camera, 2 * 1024 * 1024);
      if (image) setPhoto(image);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }
  async function acceptGrant(grant: { id: string; token: string } | null) {
    if (!grant) return true;
    const { id, token } = grant;
    setOwnership((current) => ({ ...current, [id]: token }));
    try {
      await rememberOwnership(id, token);
      return true;
    } catch {
      setPendingOwnership((current) => ({ ...current, [id]: token }));
      return false;
    }
  }
  async function retryOwnership() {
    for (const [id, token] of Object.entries(pendingOwnership)) {
      try {
        await rememberOwnership(id, token);
        setPendingOwnership((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
      } catch (error) {
        setNotice((error as Error).message);
        return;
      }
    }
  }
  async function publish() {
    if (!author.trim() || !title.trim() || !content.trim()) {
      setNotice('닉네임, 제목, 내용을 입력해주세요.');
      return;
    }
    setSending(true);
    try {
      const response = await api.createPost({
        author: author.trim(),
        title: title.trim(),
        content: content.trim(),
        ...(photo ? { image: photo } : {}),
      });
      const { post, grant } = communityReceipt(response);
      await acceptGrant(grant);
      setNickname(author.trim());
      setPosts((current) => [post, ...current]);
      setWriting(false);
      setTitle('');
      setContent('');
      setPhoto(null);
      setNotice('요리 이야기를 올렸어요.');
      reactGuide({
        mood: 'happy',
        title: '요리 이야기를 잘 전했어요!',
        message: '다른 사람들의 이야기도 함께 둘러봐요. 작은 팁이 다음 요리에 도움이 될 거예요.',
      });
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  async function sendComment() {
    if (!thread || !author.trim() || !comment.trim()) {
      setNotice('닉네임과 댓글을 입력해주세요.');
      return;
    }
    setCommentBusy(true);
    const current = threadVersion.current;
    try {
      const response = await api.comment(thread.id, viewer, author.trim(), comment.trim());
      const { post: result, grant } = communityReceipt(response);
      await acceptGrant(grant);
      merge(result);
      setNickname(author.trim());
      if (current === threadVersion.current) setComment('');
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      if (mounted.current) setCommentBusy(false);
    }
  }
  function likeButton(post: Post) {
    return (
      <Button
        secondary
        busy={likeBusy.includes(post.id)}
        icon={post.liked ? 'heart' : 'heart-outline'}
        onPress={() => void toggleLike(post)}
      >{`좋아요 ${post.likeCount}`}</Button>
    );
  }
  return (
    <>
      <LayoutScrollView contentContainerStyle={ui.page} keyboardShouldPersistTaps="handled">
        {Object.keys(pendingOwnership).length > 0 && (
          <View style={ui.card}>
            <Text style={ui.error}>
              등록은 완료됐지만 작성 권한을 기기에 저장하지 못했어요. 이 화면을 닫기 전에 다시
              저장해주세요.
            </Text>
            <Button secondary onPress={() => void retryOwnership()}>
              작성 권한 저장 재시도
            </Button>
          </View>
        )}
        <SectionCover
          title="함께 차리는 식탁"
          detail="오늘 만든 요리와 작은 발견을 나눠보세요."
          icon="chatbubbles-outline"
        />
        <View style={ui.row}>
          <Button
            icon="create-outline"
            onPress={() => {
              setAuthor(nickname);
              setWriting(true);
            }}
          >
            이야기 쓰기
          </Button>
          <Button secondary busy={loading} onPress={() => void load()}>
            새로고침
          </Button>
        </View>
        {feedError ? <Text style={ui.error}>{feedError}</Text> : null}
        {!posts.length && !loading && !feedError && (
          <Empty
            title="첫 요리 이야기를 기다리고 있어요"
            message="완성한 요리 사진이나 나만의 팁을 남겨보세요."
          />
        )}
        {posts.map((post) => (
          <View key={post.id} style={ui.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${post.title} 게시글 보기`}
              onPress={() => void open(post.id)}
              style={{ gap: 12 }}
            >
              {post.image && (
                <Image
                  source={{ uri: assetUrl(post.image) }}
                  style={{
                    height: 190,
                    width: '100%',
                    borderRadius: 14,
                    backgroundColor: colors.light,
                  }}
                  resizeMode="cover"
                />
              )}
              <Text style={ui.heading}>{post.title}</Text>
              <Text numberOfLines={3} style={ui.text}>
                {post.content}
              </Text>
              <Text style={ui.muted}>
                {post.author} · {new Date(post.createdAt).toLocaleDateString('ko-KR')}
              </Text>
            </Pressable>
            <View style={ui.row}>
              {likeButton(post)}
              <Button
                secondary
                icon="chatbubble-outline"
                onPress={() => void open(post.id)}
              >{`댓글 ${post.commentCount}`}</Button>
            </View>
          </View>
        ))}
        {cursor && (
          <Button secondary busy={loading} onPress={() => void load(true)}>
            이야기 더 보기
          </Button>
        )}
        {loading && !posts.length && <ActivityIndicator color={colors.green} />}
      </LayoutScrollView>
      <Sheet
        visible={writing}
        title="요리 이야기 쓰기"
        onClose={() => {
          if (!sending && !photoBusy) setWriting(false);
        }}
      >
        <Field label="닉네임" value={author} onChangeText={setAuthor} maxLength={24} />
        <Field label="제목" value={title} onChangeText={setTitle} maxLength={80} />
        <Field
          label="요리 이야기"
          placeholder="어떤 요리를 만드셨나요?"
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={1200}
        />
        {photo && (
          <>
            <Image
              source={{ uri: photo }}
              style={{ height: 200, width: '100%', borderRadius: 14 }}
            />
            <Button secondary disabled={sending || photoBusy} onPress={() => setPhoto(null)}>
              사진 제거
            </Button>
          </>
        )}
        <View style={ui.row}>
          <Button
            secondary
            icon="images-outline"
            busy={photoBusy}
            disabled={sending}
            onPress={() => void choosePhoto()}
          >
            사진 선택
          </Button>
          <Button
            secondary
            icon="camera-outline"
            disabled={photoBusy || sending}
            onPress={() => void choosePhoto(true)}
          >
            촬영
          </Button>
        </View>
        <Button busy={sending} disabled={photoBusy} onPress={() => void publish()}>
          게시하기
        </Button>
      </Sheet>
      <Sheet
        visible={selectedId !== null}
        title="요리 이야기"
        onClose={() => {
          threadVersion.current++;
          setSelectedId(null);
          setThread(null);
        }}
      >
        {opening && <ActivityIndicator color={colors.green} />}
        {threadError ? (
          <>
            <Text style={ui.error}>{threadError}</Text>
            <Button secondary onPress={() => selectedId && void open(selectedId)}>
              다시 불러오기
            </Button>
          </>
        ) : null}
        {thread && (
          <>
            <Text style={ui.title}>{thread.title}</Text>
            <Text style={ui.muted}>
              {thread.author} · {new Date(thread.createdAt).toLocaleString('ko-KR')}
            </Text>
            {thread.image && (
              <Image
                source={{ uri: assetUrl(thread.image) }}
                style={{ height: 250, width: '100%', borderRadius: 16 }}
                resizeMode="cover"
              />
            )}
            <Text style={ui.text}>{thread.content}</Text>
            {likeButton(thread)}
            <CommunityActions
              post={thread}
              token={ownership[thread.id]}
              changed={merge}
              removed={() => {
                setPosts((current) => current.filter((p) => p.id !== thread.id));
                setThread(null);
                setSelectedId(null);
              }}
            />
            <Text style={ui.heading}>댓글 {thread.commentCount}</Text>
            {thread.comments?.map((item) => (
              <View key={item.id} style={ui.card}>
                <Text style={ui.label}>{item.author}</Text>
                <Text style={ui.text}>{item.content}</Text>
                <Text style={ui.muted}>{new Date(item.createdAt).toLocaleString('ko-KR')}</Text>
                <CommunityActions
                  post={thread}
                  comment={item}
                  token={ownership[item.id]}
                  changed={merge}
                  removed={() => undefined}
                />
              </View>
            ))}
            {!thread.comments?.length && <Text style={ui.muted}>첫 댓글을 남겨보세요.</Text>}
            <Field label="댓글 닉네임" value={author} onChangeText={setAuthor} maxLength={24} />
            <Field
              label="댓글"
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={400}
            />
            <Button busy={commentBusy} onPress={() => void sendComment()}>
              댓글 남기기
            </Button>
          </>
        )}
      </Sheet>
    </>
  );
}

export const CommunityScreen = React.memo(CommunityScreenContent);
