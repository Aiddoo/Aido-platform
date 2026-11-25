import { useAppWindow } from '@src/shared/hooks/use-app-window';
import { useBottomSheetAnimation } from 'heroui-native';
import { type ComponentRef, createContext, type ReactNode, type RefObject, use } from 'react';
import { type View } from 'react-native';

import { getSheetScreenPosition, type MeasuredPosition } from './get-sheet-screen-position';

type ToScreenPosition = (
  position: MeasuredPosition,
  onConverted: (screenPosition: MeasuredPosition) => void,
) => void;

const SheetScreenPositionContext = createContext<ToScreenPosition | null>(null);

interface SheetScreenPositionProviderProps {
  /** 시트 내용의 맨 위 뷰. 스크롤 밖이어야 한다 */
  originRef: RefObject<ComponentRef<typeof View> | null>;
  children: ReactNode;
}

export function SheetScreenPositionProvider({
  originRef,
  children,
}: SheetScreenPositionProviderProps) {
  const { animatedPosition } = useBottomSheetAnimation();
  const { width: windowWidth } = useAppWindow();

  const toScreenPosition: ToScreenPosition = (position, onConverted) => {
    originRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      onConverted(
        getSheetScreenPosition({
          position,
          sheetOrigin: { pageX, pageY, width, height },
          sheetTop: animatedPosition.get(),
          windowWidth,
        }),
      );
    });
  };

  return (
    <SheetScreenPositionContext value={toScreenPosition}>{children}</SheetScreenPositionContext>
  );
}

/** 시트 안에서 잰 자리를 화면 좌표로 바꾼다. 시트 밖이면 잰 값이 이미 화면 좌표라 `null`이다 */
export function useSheetScreenPosition() {
  return use(SheetScreenPositionContext);
}
