import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { createBackup, parseBackup, MAX_BACKUP_BYTES, type BackupData } from '../backup';
import { useKitchen } from '../state/AppProvider';
import { ui } from '../theme';
import { Button } from './ui';

export function DataBackup() {
  const app = useKitchen();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<BackupData | null>(null);
  async function exportData() {
    setBusy(true);
    try {
      const raw = createBackup({
        saved: app.saved,
        logs: app.logs,
        settings: app.settings,
        nickname: app.nickname,
      });
      const name = `hankki-${new Date().toISOString().slice(0, 10)}.json`;
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const file = new File(Paths.cache, name);
        await file.write(raw);
        if (!(await Sharing.isAvailableAsync()))
          throw new Error('이 기기에서는 파일 공유를 지원하지 않아요.');
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
      }
    } catch (e) {
      app.setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importData() {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0]!;
      if (asset.size && asset.size > MAX_BACKUP_BYTES)
        throw new Error('백업 파일은 5MB 이하여야 해요.');
      const raw =
        Platform.OS === 'web'
          ? await (await fetch(asset.uri)).text()
          : await new File(asset.uri).text();
      setPending(parseBackup(raw));
    } catch (e) {
      app.setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={ui.card}>
      <Text style={ui.heading}>데이터 백업</Text>
      <Text style={ui.muted}>
        저장 레시피·냉장고·설정·요리 기록을 JSON 파일로 옮길 수 있어요. 커뮤니티 작성 권한은 현재
        기기에 남아요.
      </Text>
      <View style={ui.row}>
        <Button secondary disabled={busy} onPress={() => void exportData()}>
          파일 내보내기
        </Button>
        <Button secondary disabled={busy} onPress={() => void importData()}>
          파일 가져오기
        </Button>
      </View>
      {pending && (
        <>
          <Text style={ui.error}>
            레시피 {pending.saved.length}개, 기록 {pending.logs.length}개로 현재 데이터를
            교체할까요? 먼저 현재 파일을 내보내 두세요.
          </Text>
          <View style={ui.row}>
            <Button
              busy={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await app.restoreBackup(pending);
                  setPending(null);
                  app.setNotice('백업을 가져왔어요.');
                } catch (e) {
                  app.setNotice((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              교체하기
            </Button>
            <Button ghost disabled={busy} onPress={() => setPending(null)}>
              취소
            </Button>
          </View>
        </>
      )}
    </View>
  );
}
