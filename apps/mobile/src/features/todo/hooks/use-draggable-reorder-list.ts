import { useEffect, useState } from 'react';
import type { DragEndParams } from 'react-native-draggable-flatlist';

import { getReorderInstruction, type ReorderInstruction } from '../utils/draggable-reorder';

interface UseDraggableReorderListParams<TItem extends { id: number }> {
  items: TItem[];
  isPending: boolean;
  onReorder: (instruction: ReorderInstruction) => void;
}

export function useDraggableReorderList<TItem extends { id: number }>({
  items,
  isPending,
  onReorder,
}: UseDraggableReorderListParams<TItem>) {
  const [localItems, setLocalItems] = useState(items);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging && !isPending) {
      setLocalItems(items);
    }
  }, [items, isDragging, isPending]);

  function onDragEnd({ data, from, to }: DragEndParams<TItem>) {
    setIsDragging(false);
    if (isPending) {
      return;
    }
    const instruction = getReorderInstruction(data, from, to);
    if (!instruction) {
      return;
    }

    setLocalItems(data);
    onReorder(instruction);
  }

  return { items: localItems, onDragBegin: () => setIsDragging(true), onDragEnd };
}
