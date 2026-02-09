import { isSameDay } from '@src/shared/utils/date';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export const useToday = (): Date => {
  const [today, setToday] = useState(() => new Date());
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasInBackground = appState.current !== 'active';
      const isActive = nextAppState === 'active';

      if (wasInBackground && isActive) {
        setToday((prev) => {
          const now = new Date();
          const hasDateChanged = !isSameDay(prev, now);
          return hasDateChanged ? now : prev;
        });
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  return today;
};
