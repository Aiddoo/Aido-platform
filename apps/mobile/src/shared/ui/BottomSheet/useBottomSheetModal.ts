import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef } from 'react';
import { Keyboard } from 'react-native';
import { Easing } from 'react-native-reanimated';

/** 닫기 전용 빠른 애니메이션. 열기는 기본 속도 유지. */
const FAST_DISMISS = { duration: 250, easing: Easing.out(Easing.quad) };

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
