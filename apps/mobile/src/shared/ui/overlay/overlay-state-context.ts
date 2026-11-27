import { createContext } from 'react';

export interface OverlayState {
  hasActiveOverlay: boolean;
}

// Provider 밖에는 overlay가 뜰 자리가 없어 열린 것도 없다
export const OverlayStateContext = createContext<OverlayState>({ hasActiveOverlay: false });
