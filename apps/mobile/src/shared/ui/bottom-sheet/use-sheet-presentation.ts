import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import type { BottomSheetRef } from 'heroui-native';
import { use, useEffect, useEffectEvent, useRef } from 'react';
import { Keyboard } from 'react-native';

import { ToastLayerClosingContext } from '../toast/toast-layer';

interface SheetPresentationOptions {
  isOpen: boolean;
  /** `false`는 닫힘 애니메이션이 끝난 뒤에 온다 */
  onOpenChange?: (isOpen: boolean) => void;
  onCloseStart?: () => void;
}

/** 네이티브 시트는 ref로 열고 닫는다. 앱 시트는 `isOpen`으로 다루므로 그 차이를 여기서 한 번만 잇는다 */
export function useSheetPresentation({
  isOpen,
  onOpenChange,
  onCloseStart,
}: SheetPresentationOptions) {
  const sheetRef = useRef<BottomSheetRef>(null);
  // 열기가 끝나기 전에 닫으면 TrueSheet는 열기를 취소하고 닫힘 이벤트를 보내지 않아, 열기를 기다린 뒤 닫는다
  const presentationRef = useRef<Promise<void> | null>(null);
  const startToastLayerClosing = use(ToastLayerClosingContext);
  const reportUnexpectedError = useReportUnexpectedError('bottom_sheet');

  const handleDidDismiss = () => {
    presentationRef.current = null;
    onOpenChange?.(false);
  };

  // 열기에 실패하면 닫힌 것으로 알려 route 시트의 투명한 화면이 터치를 막지 않게 한다
  const handleFailure = useEffectEvent((error: unknown) => {
    reportUnexpectedError(error);
    handleDidDismiss();
  });

  useEffect(() => {
    const sheet = sheetRef.current;
    if (sheet == null) {
      return;
    }
    if (isOpen) {
      if (presentationRef.current == null) {
        const presentation = sheet.present();
        presentationRef.current = presentation;
        presentation.catch(handleFailure);
      }
      return;
    }
    presentationRef.current?.then(() => sheetRef.current?.dismiss()).catch(handleFailure);
  }, [isOpen]);

  return {
    sheetRef,
    onWillDismiss: () => {
      // 키보드 시트가 열린 동안은 keyboard-controller를 꺼 두어(setEnabled) 그 키보드 상태를 믿을 수 없다. 시트 부품은 RN으로 내린다
      Keyboard.dismiss();
      startToastLayerClosing?.();
      onCloseStart?.();
    },
    onDidDismiss: handleDidDismiss,
  };
}
