import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { community } from '../services/community';
import { useKitchen } from '../state/AppProvider';
import type { Post } from '../types';
import { ui } from '../theme';
import { Button, Field, Sheet } from './ui';

export function CommunityActions({
  post,
  comment,
  token,
  changed,
  removed,
}: {
  post: Post;
  comment?: { id: string; content: string };
  token?: string;
  changed: (post: Post) => void;
  removed: () => void;
}) {
  const { viewer, setNotice } = useKitchen();
  const [mode, setMode] = useState<'edit' | 'delete' | 'report' | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      if (mode === 'edit' && token)
        changed(
          await community.edit(post.id, token, viewer, content.trim(), title.trim(), comment?.id),
        );
      if (mode === 'delete' && token) {
        const result = await community.remove(post.id, token, viewer, comment?.id);
        if ('deleted' in result) removed();
        else changed(result);
      }
      if (mode === 'report') {
        await community.report(post.id, viewer, reason.trim(), content.trim(), comment?.id);
        setNotice('신고를 접수했어요.');
      }
      setMode(null);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <View style={ui.row}>
        {token && (
          <>
            <Button
              small
              ghost
              onPress={() => {
                setTitle(post.title);
                setContent(comment?.content ?? post.content);
                setMode('edit');
              }}
            >
              수정
            </Button>
            <Button small ghost onPress={() => setMode('delete')}>
              삭제
            </Button>
          </>
        )}
        <Button
          small
          ghost
          onPress={() => {
            setReason('');
            setContent('');
            setMode('report');
          }}
        >
          신고
        </Button>
      </View>
      <Sheet
        visible={mode !== null}
        title={mode === 'edit' ? '내용 수정' : mode === 'delete' ? '삭제 확인' : '문제 신고'}
        onClose={() => {
          if (!busy) setMode(null);
        }}
      >
        {mode === 'delete' ? (
          <Text style={ui.error}>
            {comment ? '이 댓글' : '이 게시글과 모든 댓글'}을 삭제할까요? 되돌릴 수 없어요.
          </Text>
        ) : (
          <>
            {mode === 'edit' && !comment && (
              <Field label="제목" value={title} onChangeText={setTitle} maxLength={80} />
            )}
            {mode === 'report' && (
              <Field label="신고 사유" value={reason} onChangeText={setReason} maxLength={80} />
            )}
            <Field
              label={mode === 'report' ? '자세한 내용 (선택)' : '내용'}
              multiline
              value={content}
              onChangeText={setContent}
              maxLength={mode === 'edit' && !comment ? 1200 : 400}
            />
          </>
        )}
        <View style={ui.row}>
          <Button
            busy={busy}
            disabled={
              mode === 'edit'
                ? !content.trim() || (!comment && !title.trim())
                : mode === 'report'
                  ? !reason.trim()
                  : false
            }
            onPress={() => void submit()}
          >
            {mode === 'edit' ? '저장' : mode === 'delete' ? '삭제' : '신고 보내기'}
          </Button>
          <Button ghost disabled={busy} onPress={() => setMode(null)}>
            취소
          </Button>
        </View>
      </Sheet>
    </>
  );
}
