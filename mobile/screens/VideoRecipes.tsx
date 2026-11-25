import React, { useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Button, Field } from '../components/ui';
import { useApp } from '../state/AppProvider';
import { api, request } from '../services/api';
import { ui } from '../theme';

export function VideoRecipes() {
  const {settings} = useApp();
  const [query,setQuery] = useState(settings.ingredients.join(' '));
  const [url,setUrl] = useState('');
  const [video,setVideo] = useState<{url:string;title:string;author:string} | null>(null);
  const [notes,setNotes] = useState('');
  const [answer,setAnswer] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function run(operation:(signal:AbortSignal)=>Promise<void>) {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller; setError(''); setBusy(true);
    try { await operation(controller.signal); } catch(e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function open(link:string) { void Linking.openURL(link).catch(() => setError('링크를 열 수 없어요.')); }
  return <><View style={ui.card}><Field label="요리 영상 찾기" placeholder="요리명 또는 재료" value={query} onChangeText={setQuery}/>
    <Button onPress={() => open('https://www.youtube.com/results?search_query='+encodeURIComponent(query.trim()+' 요리 레시피'))}>YouTube에서 검색</Button></View>
    <View style={ui.card}><Field label="원본 영상 주소" placeholder="YouTube 공유 링크" value={url} editable={!busy} onChangeText={text=>{setUrl(text);setVideo(null);setNotes('');setAnswer('');}}/>
    <Button busy={busy} disabled={!url.trim()} onPress={()=>void run(async signal=>{const result=await request<{url:string;title:string;author:string}>('/api/video',{url:url.trim()},signal);if(!signal.aborted)setVideo(result);})}>영상 불러오기</Button>
    {!url && <Button secondary onPress={()=>setUrl('https://www.youtube.com/watch?v=34BJfQ7fH9g')}>김치볶음밥 영상으로 시작</Button>}
    {video && <><Text style={ui.heading}>{video.title}</Text><Text style={ui.muted}>{video.author}</Text><Button secondary onPress={()=>open(video.url)}>제작자 원본 영상 보기</Button>
    <Field label="영상 설명 또는 자막" multiline maxLength={10000} editable={!busy} value={notes} onChangeText={text=>{setNotes(text);setAnswer('');}} placeholder="재료와 조리법이 담긴 부분을 붙여넣으세요."/>
    <Button busy={busy} disabled={!notes.trim()} onPress={()=>void run(async signal=>{const result=await api.guide('question','제공된 설명에 명시된 재료, 분량과 조리 순서를 한국어로 간결하게 정리해줘. 누락된 정보는 추측하지 마.',{title:video.title,sourceText:notes},signal);if(!signal.aborted)setAnswer(result.message);})}>입력한 설명 AI 정리</Button>
    {!!answer && <Text selectable style={ui.text}>{answer}</Text>}</>}{!!error && <Text style={ui.error}>{error}</Text>}</View></>;
}
