import { use } from 'react';

import { type OverlayState, OverlayStateContext } from './overlay-state-context';

export function useOverlayState(): OverlayState {
  return use(OverlayStateContext);
}
