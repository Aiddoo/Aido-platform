import { KeyboardAdaptiveButton } from '@src/shared/ui';
import type { ComponentProps } from 'react';

import {
  type TodoImportCollection,
  TodoImportCollectionPolicy,
} from '../domains/todo-import-collection.model';
import type { TodoImportRange } from '../domains/todo-import-range.model';
import { useSelectedImportCollections } from '../hooks/use-selected-import-collections';

interface ConfirmCalendarSelectionButtonProps
  extends ComponentProps<typeof KeyboardAdaptiveButton>, TodoImportRange {
  /** 고른 캘린더 키. null은 기본 선택이다 */
  value: readonly string[] | null;
  // 화면에 보인 고른 캘린더(일정 수 포함)를 함께 준다
  onConfirm: (selected: TodoImportCollection[]) => void;
}

// 고른 캘린더를 확정하고 다음으로 넘기는 버튼. 고른 캘린더가 없거나 한 번에 가져올 수 있는 수를 넘으면 넘기지 않는다
export function ConfirmCalendarSelectionButton({
  startDate,
  endDate,
  value,
  isDisabled = false,
  onConfirm,
  onPress,
  ...props
}: ConfirmCalendarSelectionButtonProps) {
  const selected = useSelectedImportCollections({ startDate, endDate, selectedKeys: value });

  return (
    <KeyboardAdaptiveButton
      {...props}
      isDisabled={
        selected.length === 0 ||
        TodoImportCollectionPolicy.isOverImportLimit(selected) ||
        isDisabled
      }
      onPress={(event) => {
        onConfirm(selected);
        // asChild 트리거·코치마크가 자식에 넣은 onPress를 이어 불러 그 누름이 사라지지 않게 한다
        onPress?.(event);
      }}
    />
  );
}
