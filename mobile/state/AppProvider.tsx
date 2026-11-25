import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { deduct, restore } from '../inventory';
import { api } from '../services/api';
import { defaultSettings, loadStorage, saveStorage, type Stored } from '../services/storage';
import type { Recipe, Settings, Tab } from '../types';
import { resolveGuide, type GuideActivity, type GuideMessage } from '../guide';
import { advanceTutorial, tutorialSteps, type TutorialEvent } from '../tutorial';

function useAppState() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState<Recipe[]>([]);
  const [viewer, setViewer] = useState('');
  const [nickname, setNickname] = useState('');
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [notice, setNotice] = useState('');
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [tab, setTabState] = useState<Tab>('pantry');
  const [results, setResults] = useState<Recipe[]>([]);
  const [resultSettings, setResultSettings] = useState<Settings>(defaultSettings);
  const [resultMessage, setResultMessage] = useState('');
  const [resultMode, setResultMode] = useState('');
  const [searching, setSearching] = useState(false);
  const generation = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const writes = useRef(Promise.resolve());
  const recent = useRef<string[]>([]);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const tutorial = tutorialStep === null ? null : tutorialSteps[tutorialStep] || null;
  const [tutorialCopy, setTutorialCopy] = useState<Record<number, { title: string; message: string }>>({});
  const [aiGuideAnswer, setAiGuideAnswer] = useState<{ title: string; message: string } | null>(null);
  const [aiGuideBusy, setAiGuideBusy] = useState(false);
  const [aiGuideError, setAiGuideError] = useState('');
  const guideRequest = useRef<AbortController | null>(null);
  const guideGeneration = useRef(0);
  const [guideRecipe, setGuideRecipe] = useState<{ recipe: Recipe; step: number | null; running: boolean } | null>(null);
  const tutorialEvent = useCallback((event: TutorialEvent) => {
    setTutorialStep(index => advanceTutorial(index, event));
  }, []);
  const setTab = useCallback((value: Tab) => {
    setTabState(value);
    if (value === 'community') tutorialEvent('communityOpened');
  }, [tutorialEvent]);
  function startTutorial() { setTutorialStep(1); setTabState('pantry'); }
  function nextTutorial() {
    if (tutorial?.id === 'complete') setTutorialCompleted(true);
    tutorialEvent('continue');
  }
  function stopTutorial() { setTutorialStep(null); }
  const [guideActivities, setGuideActivities] = useState<Record<string, GuideActivity>>({});
  const [guideReaction, setGuideReaction] = useState<GuideMessage | null>(null);
  const [guideOverlays, setGuideOverlays] = useState<Record<string, boolean>>({});
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setGuideActivity = useCallback((id: string, activity: GuideActivity | null) => {
    setGuideActivities(current => { const next = { ...current }; if (activity) next[id] = activity; else delete next[id]; return next; });
  }, []);
  const setGuideOverlay = useCallback((id: string, visible: boolean) => {
    setGuideOverlays(current => { const next = { ...current }; if (visible) next[id] = true; else delete next[id]; return next; });
  }, []);
  const reactGuide = useCallback((message: GuideMessage, duration = 5000) => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    setGuideReaction(message);
    reactionTimer.current = setTimeout(() => setGuideReaction(null), duration);
  }, []);
  useEffect(() => () => { if (reactionTimer.current) clearTimeout(reactionTimer.current); }, []);
  const guide = resolveGuide({ tab, ingredients: settings.ingredients.length, results: results.length, saved: saved.length, searching }, Object.values(guideActivities), guideReaction,
    tutorial ? { ...tutorial, ...(tutorialStep !== null ? tutorialCopy[tutorialStep] : {}) } : null);
  const guideContextKey = JSON.stringify([tab, tutorialStep, settings, guideRecipe?.recipe.id, guideRecipe?.step]);
  useEffect(() => {
    guideGeneration.current++; guideRequest.current?.abort(); setAiGuideAnswer(null); setAiGuideError(''); setAiGuideBusy(false);
  }, [guideContextKey]);
  async function askGuide(question: string, event: 'question' | 'tutorial' = 'question') {
    const index = tutorialStep;
    guideRequest.current?.abort();
    const controller = new AbortController(); guideRequest.current = controller;
    const version = ++guideGeneration.current; setAiGuideBusy(true); setAiGuideError('');
    try {
      const response = await api.guide(event, question, {
        screen: tab, settings, tutorial, previousAnswer: event === 'question' ? aiGuideAnswer : null,
        recipe: guideRecipe ? { name: guideRecipe.recipe.name, ingredients: guideRecipe.recipe.ingredients, seasonings: guideRecipe.recipe.seasonings, steps: guideRecipe.recipe.steps } : null,
        cooking: guideRecipe ? { step: guideRecipe.step, timerRunning: guideRecipe.running } : null,
      }, controller.signal);
      if (version !== guideGeneration.current) return;
      if (event === 'tutorial' && index !== null) setTutorialCopy(current => ({ ...current, [index]: response }));
      else setAiGuideAnswer(response);
    } catch (error) { if (version === guideGeneration.current && !controller.signal.aborted) setAiGuideError((error as Error).message); }
    finally { if (version === guideGeneration.current) setAiGuideBusy(false); }
  }
  // One AI explanation per tutorial step; typing and animation frames never trigger paid calls.
  useEffect(() => {
    if (!ready || !aiEnabled || tutorialStep === null || tutorialCopy[tutorialStep]) return;
    const timer = setTimeout(() => void askGuide('', 'tutorial'), 350);
    return () => clearTimeout(timer);
  }, [ready, aiEnabled, tutorialStep]);
  useEffect(() => () => guideRequest.current?.abort(), []);

  async function hydrate() {
    setStorageError('');
    try {
      const data = await loadStorage();
      setSettings(data.settings); setSaved(data.saved); setViewer(data.viewer); setNickname(data.nickname); setTutorialStep(data.tutorialStep); setTutorialCompleted(data.tutorialCompleted); setReady(true);
    } catch { setStorageError('저장한 데이터를 읽지 못했어요. 기기의 저장 공간 접근을 확인해주세요.'); }
  }
  useEffect(() => { void hydrate(); void api.status().then(s => setAiEnabled(s.aiEnabled)).catch(() => setAiEnabled(null));
    return () => activeRequest.current?.abort();
  }, []);
  useEffect(() => {
    if (!ready) return;
    const data: Stored = { settings, saved, viewer, nickname, tutorialStep, tutorialCompleted };
    const timeout = setTimeout(() => {
      writes.current = writes.current.then(() => saveStorage(data)).catch(() => setNotice('변경 내용을 기기에 저장하지 못했어요. 저장 공간을 확인해주세요.'));
    }, 200);
    return () => clearTimeout(timeout);
  }, [settings, saved, viewer, nickname, tutorialStep, tutorialCompleted, ready]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(timer); }, [notice]);

  function updateSettings(change: Partial<Settings>) { setSettings(current => {
    const next = { ...current, ...change };
    if (change.ingredients) next.stock = next.stock?.filter(item => change.ingredients!.includes(item.name));
    if (change.ingredients || change.stock) next.undoStock = undefined;
    return next;
  }); }
  function consumeStock(used: Record<string,number>) { setSettings(current => deduct(current, used)); }
  function undoConsumption() { setSettings(restore); }
  function toggleSaved(recipe: Recipe) {
    if (!saved.some(r => r.id === recipe.id)) tutorialEvent('recipeSaved');
    if (!saved.some(r => r.id === recipe.id)) reactGuide({ mood: 'happy', title: '다음에 또 만들어봐요!', message: `${recipe.name} 레시피를 저장했어요. 저장 탭에서 다시 꺼내볼 수 있어요.`, action: 'saved', actionLabel: '저장한 요리 보기' });
    setSaved(current => current.some(r => r.id === recipe.id) ? current.filter(r => r.id !== recipe.id) : [recipe, ...current]);
  }
  async function recommend(more = false, priorityIngredient = '') {
    const input = more ? resultSettings : { ...settings, priorityIngredient };
    if (!input.ingredients.length) { setNotice('재료를 하나 이상 입력해주세요.'); reactGuide({ mood: 'listening', title: '냉장고에 무엇이 있나요?', message: '재료를 하나 이상 알려주면 함께 메뉴를 찾아볼게요.', action: 'pantry', actionLabel: '재료 입력하기' }); return; }
    activeRequest.current?.abort();
    const controller = new AbortController(); activeRequest.current = controller;
    const version = ++generation.current;
    setSearching(true);
    try {
      const result = await api.recommend(input, { mode: 'ai', cuisine: input.cuisine, filter: 'all', more,
        recentMenus: more ? [...new Set([...results.map(r => r.name), ...recent.current])].slice(0, 120) : recent.current,
        previousKeys: more ? results.flatMap(r => r.menuKey ? [r.menuKey] : []) : [],
      }, controller.signal);
      if (version !== generation.current) return;
      setResults(current => {
        const names = new Set(more ? current.map(r => r.name.normalize('NFKC').replace(/\s/g, '')) : []);
        const incoming = result.recipes.filter(r => { const key = r.name.normalize('NFKC').replace(/\s/g, ''); if (names.has(key)) return false; names.add(key); return true; });
        return more ? [...current, ...incoming] : incoming;
      });
      recent.current = [...new Set([...result.recipes.map(r => r.name), ...recent.current])].slice(0, 120);
      setResultSettings(input); setResultMessage(result.message || ''); setResultMode(result.mode); setTab('recipes');
      if (result.recipes.length) tutorialEvent('recommendationsReceived');
      reactGuide(result.recipes.length ? { mood: 'happy', title: `${result.recipes.length}가지 요리를 찾았어요!`, message: '필요한 재료를 비교하고 마음에 드는 요리를 골라봐요. 조리 순서도 함께 살펴볼게요.' } : { mood: 'puzzled', title: '다른 조합을 찾아볼까요?', message: result.message || '이 조건에 맞는 요리를 못 찾았어요. 재료나 제외 설정을 바꿔봐요.', action: 'pantry', actionLabel: '재료 다시 확인하기' });
      if (more && !result.recipes.length) setNotice(result.message || '새로운 메뉴가 없어요. 조건을 바꿔보세요.');
    } catch (error) { if (version === generation.current && !controller.signal.aborted) { setNotice((error as Error).message); reactGuide({ mood: 'puzzled', title: '요리를 찾다가 잠깐 멈췄어요', message: (error as Error).message, action: 'recommend', actionLabel: '추천 다시 시도하기' }); } }
    finally { if (version === generation.current) setSearching(false); }
  }
  function cancelSearch() { generation.current++; activeRequest.current?.abort(); setSearching(false); }
  return { settings, updateSettings, consumeStock, undoConsumption, saved, toggleSaved, viewer, nickname, setNickname, ready, storageError, hydrate,
    notice, setNotice, aiEnabled, tab, setTab, results, resultSettings, resultMessage, resultMode, searching, recommend, cancelSearch,
    guide, setGuideActivity, reactGuide, setGuideOverlay, guideModalOpen: Object.keys(guideOverlays).length > 0,
    tutorial, tutorialStep, tutorialCompleted, tutorialHasAiCopy: tutorialStep !== null && !!tutorialCopy[tutorialStep], startTutorial, nextTutorial, stopTutorial, tutorialEvent,
    aiGuideAnswer, aiGuideBusy, aiGuideError, askGuide, setGuideRecipe };
}
const AppContext = createContext<ReturnType<typeof useAppState> | null>(null);
export function AppProvider({ children }: { children: ReactNode }) { const value = useAppState(); return <AppContext.Provider value={value}>{children}</AppContext.Provider>; }
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error('AppProvider required'); return value; }
