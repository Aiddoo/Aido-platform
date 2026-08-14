import { useContext } from 'react';

import { type OverlayState, OverlayStateContext } from './OverlayStateContext';

export const useOverlayState = (): OverlayState => {
  const state = useContext(OverlayStateContext);
  if (!state) {
    throw new Error('useOverlayState must be used within OverlayProvider');
  }
  return state;
};
