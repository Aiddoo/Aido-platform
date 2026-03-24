import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef } from 'react';
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

  const open = () => {
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      requestAnimationFrame(() => {
        ref.current?.present();
      });
    } else {
      ref.current?.present();
    }
  };

  const close = () => {
    ref.current?.dismiss(FAST_DISMISS);
  };

  return { ref, open, close };
};
