import { useHaptics } from '@src/shared/di/shared-di-context';
import { useState } from 'react';
import {
  type ReorderableListDragEndEvent,
  type ReorderableListReorderEvent,
  reorderItems,
} from 'react-native-reorderable-list';
import { scheduleOnRN } from 'react-native-worklets';

import { getReorderInstruction, type ReorderInstruction } from '../utils/get-reorder-instruction';

/**
 * 행이 끌기를 여는 길게 누르기(Pressable 기본 500ms)보다 조금 늦게 끌기 제스처를 켠다.
 * 바로 켜면 Android에서 행 위에서 시작한 스와이프를 끌기가 가져가 바깥 스크롤과 당겨서 새로고침이 멈춘다.
 * 라이브러리 문서의 Refresh Control 항목이 권하는 값이다. 문서가 권하는 `panGesture`는 이 라이브러리 타입이
 * gesture-handler 2의 `PanGesture`라 3의 `Gesture.Pan()`과 맞지 않아, 같은 일을 하는 `panActivateAfterLongPress`를 쓴다
 */
const DRAG_ACTIVATION_DELAY_MS = 520;

interface ReorderedList<TItem, TId> {
  instruction: ReorderInstruction<TId>;
  items: TItem[];
}

interface UseReorderableListParams<TItem, TId> {
  items: TItem[];
  updatedAt: number;
  isPending: boolean;
  getItemId: (item: TItem) => TId;
  onReorder: (reordered: ReorderedList<TItem, TId>) => void;
}

interface ReorderHold<TItem> {
  items: TItem[];
  updatedAt: number;
  isDragging: boolean;
}

/**
 * 서버 순서를 받아 `ReorderableList`/`NestedReorderableList`에 그대로 펼칠 props를 만든다.
 * 평소에는 받은 목록을 그대로 그린다. 끄는 동안과 놓은 뒤 서버 값이 새로 올 때까지만 화면 순서를 붙잡는다.
 * 끌기 시작과 자리 바뀜의 햅틱도 여기서 낸다. 콜백이 worklet이라 호출부로 나누면 `scheduleOnRN`까지 옮겨야 한다.
 */
export function useReorderableList<TItem, TId>({
  items,
  updatedAt,
  isPending,
  getItemId,
  onReorder,
}: UseReorderableListParams<TItem, TId>) {
  const haptics = useHaptics();
  const [hold, setHold] = useState<ReorderHold<TItem> | null>(null);
  const isHolding = hold != null && (hold.isDragging || isPending || hold.updatedAt === updatedAt);
  const data = isHolding ? hold.items : items;

  const handleDragStart = () => {
    setHold({ items: data, updatedAt, isDragging: true });
    haptics.impact('medium');
  };

  const handleDragEnd = ({ from, to }: ReorderableListDragEndEvent) => {
    if (from === to) {
      setHold(null);
    }
  };

  const handleIndexChange = () => {
    haptics.selection();
  };

  const handleReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const reorderedItems = reorderItems(data, from, to);
    const instruction = getReorderInstruction({ reorderedItems, from, to, getItemId });
    if (instruction == null) {
      setHold(null);
      return;
    }

    setHold({ items: reorderedItems, updatedAt, isDragging: false });
    onReorder({ instruction, items: reorderedItems });
  };

  return {
    data,
    panActivateAfterLongPress: DRAG_ACTIVATION_DELAY_MS,
    dragEnabled: !isPending,
    onReorder: handleReorder,
    onDragStart: () => {
      'worklet';
      scheduleOnRN(handleDragStart);
    },
    onIndexChange: () => {
      'worklet';
      scheduleOnRN(handleIndexChange);
    },
    onDragEnd: (event: ReorderableListDragEndEvent) => {
      'worklet';
      scheduleOnRN(handleDragEnd, event);
    },
  };
}
