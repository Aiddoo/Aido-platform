import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';

import { FAST_DISMISS } from './constants';

interface UseBottomSheetModalReturn {
  ref: React.RefObject<BottomSheetModal | null>;
  open: () => void;
  close: () => void;
}

/**
 * 키보드 dismiss + 모달 present/dismiss 타이밍 관리.
 */
export const useBottomSheetModal = (): UseBottomSheetModalReturn => {
  const ref = useRef<BottomSheetModal>(null);
  const presentationFrameRef = useRef<number | undefined>(undefined);

  const cancelPresentation = useCallback(() => {
    if (presentationFrameRef.current === undefined) return;
    cancelAnimationFrame(presentationFrameRef.current);
    presentationFrameRef.current = undefined;
  }, []);

  useEffect(() => cancelPresentation, [cancelPresentation]);

  const open = useCallback(() => {
    cancelPresentation();
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      presentationFrameRef.current = requestAnimationFrame(() => {
        presentationFrameRef.current = undefined;
        ref.current?.present();
      });
    } else {
      ref.current?.present();
    }
  }, [cancelPresentation]);

  const close = useCallback(() => {
    cancelPresentation();
    ref.current?.dismiss(FAST_DISMISS);
  }, [cancelPresentation]);

  return { ref, open, close };
};
