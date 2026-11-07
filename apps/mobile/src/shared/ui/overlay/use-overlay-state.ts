import { use } from 'react';

import { type OverlayState, OverlayStateContext } from './overlay-state-context';

export function useOverlayState(): OverlayState {
  const state = use(OverlayStateContext);
  if (!state) {
    throw new Error('useOverlayState must be used within OverlayProvider');
  }
  return state;
}
