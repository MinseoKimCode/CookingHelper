import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../state/AppProvider';
import { api } from '../services/api';
import { useGuideActivity } from '../hooks/useGuideActivity';
import { ui } from '../theme';
import type { Recipe } from '../types';
import { Button, Field } from './ui';

export function Rescue({recipe, step, instruction, apply}: {recipe: Recipe; step: number; instruction: string; apply: (text: string) => void}) {
  const {settings} = useApp();
  const [issue, setIssue] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  useGuideActivity(busy ? {mood:'thinking',title:'현재 단계의 해결책을 찾고 있어요',message:issue,priority:95} :
    applied ? {mood:'happy',title:'바뀐 방법으로 진행해요',message:'현재 단계에 적용한 조리법을 확인해주세요.',priority:72} :
    issue ? {mood:'listening',title:'어떤 상황인지 알려주세요',message:'현재 조리 단계와 냉장고 재료를 함께 살펴볼게요.',priority:72} : null);
  async function ask() {
    const controller = new AbortController(); active.current?.abort(); active.current = controller;
    setBusy(true); setError(''); setAnswer('');
    try {
      const {message} = await api.guide('rescue',issue,{dish:recipe.name, servings:recipe.servings, step:recipe.steps[step], instruction, ingredients:settings.ingredients, pantry:settings.pantry, excluded:settings.excluded},controller.signal);
      if (!controller.signal.aborted) setAnswer(message);
    } catch(e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally {if (!controller.signal.aborted) setBusy(false);}
  }
  function change(text:string) {setIssue(text); setApplied(false); setAnswer(''); setError('');}
  return <View style={ui.card}><Text style={ui.heading}>조리 중 도움이 필요해요</Text><View style={ui.row}>{['재료가 없어요','너무 짜요'].map(label => <Button key={label} secondary disabled={busy} onPress={() => change(label)}>{label}</Button>)}</View>
    {!!issue && <><Field label="현재 상황" maxLength={600} editable={!busy} value={issue} onChangeText={change}/><Button busy={busy} disabled={!issue.trim()} onPress={() => void ask()}>몬스터에게 해결책 묻기</Button></>}
    {!!error && <Text style={ui.error}>{error}</Text>}{!!answer && <><Text style={ui.text}>{answer}</Text><Button onPress={() => {apply(answer); setAnswer(''); setIssue(''); setApplied(true);}}>현재 단계에 적용</Button></>}
  </View>;
}

export function Consumption({recipe,finish}: {recipe: Recipe; finish: () => void}) {
  const app = useApp();
  const stock = app.settings.stock || [];
  const [amounts, setAmounts] = useState<Record<string,string>>(() => Object.fromEntries(stock.map(item => {
    const matches = [...recipe.ingredients,...recipe.seasonings].filter(row => row.name === item.name);
    const amount = matches.reduce((sum,row) => sum + row.amount,0);
    return [item.name, matches.length && matches.every(row => row.unit === item.unit) && amount <= item.quantity ? String(amount) : ''];
  })));
  const locked = useRef(false);
  const invalid = stock.some(item => { const raw = amounts[item.name] || ''; return raw !== '' && (!/^\d+(\.\d{1,3})?$/.test(raw) || Number(raw) > item.quantity); });
  return <View style={ui.card}><Text style={ui.heading}>실제 사용량 확인</Text><Text style={ui.muted}>재고와 단위가 일치하는 분량을 채웠어요. 빈칸은 차감하지 않아요.</Text>
    {stock.map(item => <Field key={item.name} label={item.name + ' · 보유 ' + item.quantity + item.unit} value={amounts[item.name] || ''} placeholder={'사용량 (' + item.unit + ')'} keyboardType="decimal-pad" onChangeText={text => setAmounts(prev => ({...prev,[item.name]:text}))}/>)}
    {invalid && <Text style={ui.error}>사용량은 보유량 이하로 입력해주세요. 소수점 셋째 자리까지 기록할 수 있어요.</Text>}
    <Button disabled={invalid} onPress={() => {if (locked.current) return; locked.current=true; app.consumeStock(Object.fromEntries(Object.entries(amounts).map(([name,value]) => [name,Number(value)]))); finish();}}>사용량 확정하고 완료</Button>
    <Button secondary onPress={finish}>차감 없이 완료</Button></View>;
}