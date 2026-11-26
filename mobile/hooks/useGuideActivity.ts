import { useEffect, useId } from 'react';
import { useAppActions } from '../state/AppProvider';
import type { GuideActivity } from '../guide';

export function useGuideActivity(activity: GuideActivity | null) {
  const id = useId();
  const { setGuideActivity } = useAppActions();
  const { mood, title, message, priority, action, actionLabel } = activity || {};
  useEffect(() => {
    setGuideActivity(
      id,
      mood && title && message && priority !== undefined
        ? { mood, title, message, priority, action, actionLabel }
        : null,
    );
    return () => setGuideActivity(id, null);
  }, [id, setGuideActivity, mood, title, message, priority, action, actionLabel]);
}
