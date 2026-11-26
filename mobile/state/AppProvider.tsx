import React, { type ReactNode } from 'react';
import { useAppState } from './useAppState';
import { StateContexts } from './contexts';
export {
  useRecipeBrowser,
  useApp,
  useSession,
  useAppActions,
  useKitchen,
  useRecommendations,
  useGuidance,
} from './contexts';
export function AppProvider({ children }: { children: ReactNode }) {
  const value = useAppState();
  return <StateContexts value={value}>{children}</StateContexts>;
}
