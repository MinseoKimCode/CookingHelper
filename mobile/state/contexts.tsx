import React, { createContext, useContext, useRef, type ReactNode } from 'react';
import type { useAppState } from './useAppState';

type State = ReturnType<typeof useAppState>;
type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => unknown ? K : never;
}[keyof T];
type Actions = Pick<State, FunctionKeys<State>>;
type Kitchen = Pick<
  State,
  'settings' | 'saved' | 'logs' | 'viewer' | 'nickname' | 'ready' | 'storageError' | 'views'
>;
type Recommendations = Pick<
  State,
  'results' | 'resultSettings' | 'resultMessage' | 'resultMode' | 'searching'
>;
type Guidance = Pick<
  State,
  | 'guide'
  | 'guideModalOpen'
  | 'tutorial'
  | 'tutorialStep'
  | 'tutorialCompleted'
  | 'aiGuideAnswer'
  | 'aiGuideBusy'
  | 'aiGuideError'
>;
type Session = Pick<State, 'notice' | 'aiEnabled' | 'youtubeEnabled' | 'tab'>;
const ActionsContext = createContext<Actions | null>(null);
const KitchenContext = createContext<Kitchen | null>(null);
const RecommendationsContext = createContext<Recommendations | null>(null);
const GuidanceContext = createContext<Guidance | null>(null);
const SessionContext = createContext<Session | null>(null);

function useStableObject<T extends object>(next: T): T {
  const previous = useRef(next);
  if (
    Object.keys(next).some(
      (key) => !Object.is(next[key as keyof T], previous.current[key as keyof T]),
    )
  )
    previous.current = next;
  return previous.current;
}
export function StateContexts({ value, children }: { value: State; children: ReactNode }) {
  const latest = useRef(value);
  latest.current = value;
  const actions = useRef<Actions | null>(null);
  if (!actions.current) {
    const methods: Record<string, (...args: unknown[]) => unknown> = {};
    for (const key of Object.keys(value) as (keyof State)[]) {
      if (typeof value[key] === 'function')
        methods[key] = (...args: unknown[]) =>
          (latest.current[key] as (...args: unknown[]) => unknown)(...args);
    }
    actions.current = methods as Actions;
  }
  const kitchen = useStableObject({
    settings: value.settings,
    saved: value.saved,
    logs: value.logs,
    viewer: value.viewer,
    nickname: value.nickname,
    ready: value.ready,
    storageError: value.storageError,
    views: value.views,
  });
  const recommendations = useStableObject({
    results: value.results,
    resultSettings: value.resultSettings,
    resultMessage: value.resultMessage,
    resultMode: value.resultMode,
    searching: value.searching,
  });
  const guidance = useStableObject({
    guide: value.guide,
    guideModalOpen: value.guideModalOpen,
    tutorial: value.tutorial,
    tutorialStep: value.tutorialStep,
    tutorialCompleted: value.tutorialCompleted,
    aiGuideAnswer: value.aiGuideAnswer,
    aiGuideBusy: value.aiGuideBusy,
    aiGuideError: value.aiGuideError,
  });
  const session = useStableObject({
    notice: value.notice,
    aiEnabled: value.aiEnabled,
    youtubeEnabled: value.youtubeEnabled,
    tab: value.tab,
  });
  return (
    <ActionsContext.Provider value={actions.current}>
      <KitchenContext.Provider value={kitchen}>
        <RecommendationsContext.Provider value={recommendations}>
          <GuidanceContext.Provider value={guidance}>
            <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
          </GuidanceContext.Provider>
        </RecommendationsContext.Provider>
      </KitchenContext.Provider>
    </ActionsContext.Provider>
  );
}
function required<T>(value: T | null): T {
  if (!value) throw new Error('AppProvider required');
  return value;
}
export function useAppActions() {
  return required(useContext(ActionsContext));
}
export function useKitchen() {
  return { ...required(useContext(KitchenContext)), ...useAppActions() };
}
export function useRecommendations() {
  return { ...required(useContext(RecommendationsContext)), ...useAppActions() };
}
export function useGuidance() {
  return {
    ...required(useContext(GuidanceContext)),
    ...required(useContext(SessionContext)),
    ...required(useContext(RecommendationsContext)),
    ...useAppActions(),
  };
}
export function useApp() {
  return {
    ...useKitchen(),
    ...required(useContext(RecommendationsContext)),
    ...required(useContext(GuidanceContext)),
    ...required(useContext(SessionContext)),
  };
}

export function useSession() {
  return { ...required(useContext(SessionContext)), ...useAppActions() };
}

export function useRecipeBrowser() {
  return {
    ...useKitchen(),
    ...required(useContext(RecommendationsContext)),
    ...required(useContext(SessionContext)),
  };
}
