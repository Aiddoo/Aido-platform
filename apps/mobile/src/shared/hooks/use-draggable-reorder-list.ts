import { useEffect, useRef, useState } from 'react';
import type { DragEndParams } from 'react-native-draggable-flatlist';

import { getReorderInstruction, type ReorderInstruction } from '../utils/draggable-reorder';

interface UseDraggableReorderListParams<TItem, TId> {
  items: TItem[];
  updatedAt: number;
  isPending: boolean;
  getItemId: (item: TItem) => TId;
  onReorder: (instruction: ReorderInstruction<TId>) => void;
}

export function useDraggableReorderList<TItem, TId>({
  items,
  updatedAt,
  isPending,
  getItemId,
  onReorder,
}: UseDraggableReorderListParams<TItem, TId>) {
  const [localItems, setLocalItems] = useState(items);
  const isDraggingRef = useRef(false);
  const syncedAtRef = useRef(updatedAt);

  const syncServerItems = () => {
    if (syncedAtRef.current === updatedAt) {
      return;
    }
    syncedAtRef.current = updatedAt;
    setLocalItems(items);
  };

  useEffect(() => {
    if (isDraggingRef.current || isPending) {
      return;
    }
    syncServerItems();
  }, [items, updatedAt, isPending]);

  /** 드래그 중 리스트를 다시 그리면 셀 위치가 어긋나므로 상태가 아닌 ref로 표시한다. */
  const handleDragBegin = () => {
    isDraggingRef.current = true;
  };

  const handleDragEnd = ({ data, from, to }: DragEndParams<TItem>) => {
    isDraggingRef.current = false;
    const instruction = isPending ? null : getReorderInstruction(data, from, to, getItemId);
    if (instruction == null) {
      syncServerItems();
      return;
    }

    setLocalItems(data);
    onReorder(instruction);
  };

  return { items: localItems, onDragBegin: handleDragBegin, onDragEnd: handleDragEnd };
}
