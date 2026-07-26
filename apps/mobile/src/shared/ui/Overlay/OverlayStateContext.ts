import { createContext } from 'react';

export interface OverlayState {
  hasActiveOverlay: boolean;
}

export const OverlayStateContext = createContext<OverlayState | null>(null);
