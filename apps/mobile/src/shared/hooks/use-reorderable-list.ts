import { useHaptics } from '@src/shared/di/shared-di-context';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  type ReorderableListDragEndEvent,
  type ReorderableListReorderEvent,
  reorderItems,
} from 'react-native-reorderable-list';
import { scheduleOnRN } from 'react-native-worklets';

import { getReorderInstruction, type ReorderInstruction } from '../utils/get-reorder-instruction';

/** 바로 켜면 Android에서 행 위 스와이프를 끌기가 가져가 스크롤이 멈춘다. `panGesture`는 gesture-handler 2 타입이라 3과 맞지 않아 `panActivateAfterLongPress`를 쓴다 */
const DRAG_ACTIVATION_DELAY_MS = 520;

interface ReorderedList<TItem, TId> {
  instruction: ReorderInstruction<TId>;
  items: TItem[];
}

interface UseReorderableListOptions<TItem, TId> {
  items: TItem[];
  updatedAt: number;
  isPending: boolean;
  getItemId: (item: TItem) => TId;
  /** 서버 응답 전의 임시 행. 하나라도 있으면 끌 수 없고, 그래도 끝난 끌기는 순서를 보내지 않고 서버 순서로 돌아간다 */
  isOptimistic?: (item: TItem) => boolean;
  onReorder: (reordered: ReorderedList<TItem, TId>) => void;
}

interface ReorderHold<TItem> {
  items: TItem[];
  updatedAt: number;
  isDragging: boolean;
}

interface ShownList<TItem> {
  items: TItem[];
  updatedAt: number;
}

/** 콜백이 worklet이라 햅틱을 호출부로 나누면 `scheduleOnRN`까지 옮겨야 해 여기서 낸다 */
export function useReorderableList<TItem, TId>({
  items,
  updatedAt,
  isPending,
  getItemId,
  isOptimistic = () => false,
  onReorder,
}: UseReorderableListOptions<TItem, TId>) {
  const haptics = useHaptics();
  const [hold, setHold] = useState<ReorderHold<TItem> | null>(null);
  const isHolding = hold != null && (hold.isDragging || isPending || hold.updatedAt === updatedAt);
  const data = isHolding ? hold.items : items;
  // 라이브러리 셀은 layout effect에서 콜백을 바꿔 끌기 시작이 한 렌더 전 목록을 쥔다. 임시 행이 서버 행으로 바뀐 뒤에도 임시 id를 보내지 않게 마지막으로 그린 목록을 읽는다
  const shownRef = useRef<ShownList<TItem>>({ items: data, updatedAt });
  useLayoutEffect(() => {
    shownRef.current = { items: data, updatedAt };
  });

  const handleDragStart = () => {
    setHold({ ...shownRef.current, isDragging: true });
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
    const shown = shownRef.current;
    const reorderedItems = reorderItems(shown.items, from, to);
    const instruction = getReorderInstruction({ reorderedItems, from, to, getItemId });
    if (instruction == null || reorderedItems.some(isOptimistic)) {
      setHold(null);
      return;
    }

    setHold({ items: reorderedItems, updatedAt: shown.updatedAt, isDragging: false });
    onReorder({ instruction, items: reorderedItems });
  };

  return {
    data,
    panActivateAfterLongPress: DRAG_ACTIVATION_DELAY_MS,
    dragEnabled: !isPending && !data.some(isOptimistic),
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
