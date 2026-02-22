import { useEffect, useRef, useState } from 'react';
import type { DragEndParams } from 'react-native-draggable-flatlist';
import { getReorderInstruction, type ReorderInstruction } from '../utils/draggable-reorder';

interface UseDraggableReorderListParams<TItem extends { id: number }> {
  items: TItem[];
  updatedAt: number;
  isPending: boolean;
  onReorder: (instruction: ReorderInstruction) => void;
}

export const useDraggableReorderList = <TItem extends { id: number }>({
  items,
  updatedAt,
  isPending,
  onReorder,
}: UseDraggableReorderListParams<TItem>) => {
  const [localItems, setLocalItems] = useState(items);
  const lastUpdatedAtRef = useRef(updatedAt);

  useEffect(() => {
    if (lastUpdatedAtRef.current === updatedAt) return;
    lastUpdatedAtRef.current = updatedAt;
    setLocalItems(items);
  }, [updatedAt, items]);

  const onDragEnd = ({ data, from, to }: DragEndParams<TItem>) => {
    if (isPending) return;
    const instruction = getReorderInstruction(data, from, to);
    if (!instruction) return;

    setLocalItems(data);
    onReorder(instruction);
  };

  return { items: localItems, onDragEnd };
};
