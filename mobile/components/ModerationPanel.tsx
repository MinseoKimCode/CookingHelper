import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { community, type ReportRow } from '../services/community';
import { useAppActions } from '../state/AppProvider';
import { ui } from '../theme';
import { Button, Field } from './ui';

export function ModerationPanel() {
  const { setNotice } = useAppActions();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  async function load() {
    setBusy(true);
    try {
      setReports((await community.reports(key)).reports);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resolve(id: string, action: 'dismiss' | 'remove') {
    setBusy(true);
    try {
      await community.resolve(key, id, action);
      setReports((current) => current.filter((r) => r.id !== id));
      setConfirm(null);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={ui.card}>
      <Button
        ghost
        onPress={() => {
          setOpen(!open);
          setKey('');
          setReports([]);
          setConfirm(null);
        }}
      >{`신고 관리 ${open ? '닫기' : '열기'}`}</Button>
      {open && (
        <>
          <Field
            label="관리자 키"
            secureTextEntry
            autoCapitalize="none"
            value={key}
            onChangeText={setKey}
          />
          <Text style={ui.muted}>
            서버에 설정한 관리자만 사용할 수 있어요. 키는 기기에 저장하지 않아요.
          </Text>
          <Button secondary busy={busy} disabled={!key.trim()} onPress={() => void load()}>
            미처리 신고 조회
          </Button>
          {reports.map((report) => (
            <View key={report.id} style={ui.card}>
              <Text style={ui.label}>
                {report.kind === 'recipe' ? '레시피' : report.comment ? '댓글' : '게시글'} ·{' '}
                {report.reason}
              </Text>
              <Text selectable style={ui.muted}>
                {report.target}
                {report.comment ? ` / ${report.comment}` : ''}
              </Text>
              <Text style={ui.text}>{report.detail || '추가 설명 없음'}</Text>
              <View style={ui.row}>
                <Button
                  small
                  secondary
                  disabled={busy}
                  onPress={() => void resolve(report.id, 'dismiss')}
                >
                  검토 완료
                </Button>
                <Button small ghost disabled={busy} onPress={() => setConfirm(report.id)}>
                  대상 숨김·삭제
                </Button>
              </View>
              {confirm === report.id && (
                <>
                  <Text style={ui.error}>
                    {report.kind === 'recipe'
                      ? '레시피를 목록에서 숨길까요?'
                      : '신고된 글 또는 댓글을 삭제할까요? 이 작업은 되돌릴 수 없어요.'}
                  </Text>
                  <View style={ui.row}>
                    <Button small disabled={busy} onPress={() => void resolve(report.id, 'remove')}>
                      확인
                    </Button>
                    <Button small ghost onPress={() => setConfirm(null)}>
                      취소
                    </Button>
                  </View>
                </>
              )}
            </View>
          ))}
        </>
      )}
    </View>
  );
}
