import {
  type ComponentRef,
  createContext,
  type ReactNode,
  use,
  useLayoutEffect,
  useRef,
} from 'react';
import { View } from 'react-native';

/** footer 내용이 바뀔 때 gorhom의 footerComponent가 바뀌면 고정 영역이 다시 마운트되어 누르던 버튼을 놓친다 */
export const SheetFooterContext = createContext<ReactNode>(null);

interface SheetFooterSlotProps {
  /** 시트가 내용 아래를 이만큼 비워 footer가 내용을 가리지 않게 한다 */
  onHeightChange: (height: number) => void;
}

export function SheetFooterSlot({ onHeightChange }: SheetFooterSlotProps) {
  const slotRef = useRef<ComponentRef<typeof View>>(null);

  // onLayout은 그려진 뒤에 와 시트가 footer 몫 없이 먼저 열렸다 커지므로, 첫 높이는 그리기 전에 동기로 잰다(New Architecture)
  useLayoutEffect(() => {
    if (slotRef.current != null) {
      slotRef.current.measure((_x, _y, _width, height) => onHeightChange(height));
    }
  }, [onHeightChange]);

  return (
    <View ref={slotRef} onLayout={(event) => onHeightChange(event.nativeEvent.layout.height)}>
      {use(SheetFooterContext)}
    </View>
  );
}
