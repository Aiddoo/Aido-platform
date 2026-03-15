import { useEffect, useRef, useState } from 'react';
import type { DragEndParams } from 'react-native-draggable-flatlist';
import {
  type FriendReorderInstruction,
  getFriendReorderInstruction,
} from '../utils/draggable-reorder';

interface UseDraggableFriendReorderListParams<TItem extends { followId: string }> {
  items: TItem[];
  updatedAt: number;
  isPending: boolean;
  onReorder: (instruction: FriendReorderInstruction) => void;
}

export const useDraggableFriendReorderList = <TItem extends { followId: string }>({
  items,
  updatedAt,
  isPending,
  onReorder,
}: UseDraggableFriendReorderListParams<TItem>) => {
  const [localItems, setLocalItems] = useState(items);
  const lastUpdatedAtRef = useRef(updatedAt);

  useEffect(() => {
    if (lastUpdatedAtRef.current === updatedAt) return;
    lastUpdatedAtRef.current = updatedAt;
    setLocalItems(items);
  }, [updatedAt, items]);

  const onDragEnd = ({ data, from, to }: DragEndParams<TItem>) => {
    if (isPending) return;
    const instruction = getFriendReorderInstruction(data, from, to);
    if (!instruction) return;

    setLocalItems(data);
    onReorder(instruction);
  };

  return { items: localItems, onDragEnd };
};
