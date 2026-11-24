import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { QueryErrorBoundary, useOpenKeyboardSheet } from '@src/shared/ui';
import { type ComponentProps, Suspense } from 'react';

import { CategoryTargetSheet } from '../components/category-target-sheet';

type OpenCategoryTargetSheetOptions = Omit<
  ComponentProps<typeof CategoryTargetSheet>,
  'isOpen' | 'onOpenChange' | 'close' | 'onLocked'
>;

/**
 * 넣을 곳을 고르는 시트를 연다. 고르면 `onChoose`가 불리고 시트는 내려간 뒤에 지워진다.
 * 새 카테고리 이름·색은 같은 시트 안에서 받아, 내려가는 시트 위에 다른 시트를 띄워 얼지 않게 한다
 */
export function useOpenCategoryTargetSheet(): (options: OpenCategoryTargetSheetOptions) => void {
  const openKeyboardSheet = useOpenKeyboardSheet();
  // 요금제 안내는 시트가 아니라 이 단계가 띄워, 넣을 곳 시트가 지워진 뒤에도 남는다
  const categoryGate = useEntitlementGate('TODO_CATEGORY', { surface: 'todo_import' });

  return (options) => {
    let isLockedPressed = false;
    openKeyboardSheet(({ isOpen, onOpenChange, close }) => {
      // 잠긴 새 카테고리를 누르면 시트를 먼저 내리고 다 내려간 뒤 안내를 띄워, 토스트가 시트 뒤에 가리거나
      // 내려가는 시트 위에 안내 시트가 겹치지 않는다
      const handleOpenChange = (nextIsOpen: boolean) => {
        onOpenChange(nextIsOpen);
        if (!nextIsOpen && isLockedPressed) {
          isLockedPressed = false;
          categoryGate.promptLimit();
        }
      };
      const handleLocked = () => {
        isLockedPressed = true;
        close();
      };

      return (
        <QueryErrorBoundary
          fallback={(props) => (
            <CategoryTargetSheet.Error {...props} isOpen={isOpen} onOpenChange={onOpenChange} />
          )}
        >
          {/* 카테고리·요금제는 이 단계가 이미 받아 둔 캐시라 기다리지 않고 바로 올라온다 */}
          <Suspense fallback={null}>
            <CategoryTargetSheet
              {...options}
              isOpen={isOpen}
              onOpenChange={handleOpenChange}
              close={close}
              onLocked={handleLocked}
            />
          </Suspense>
        </QueryErrorBoundary>
      );
    });
  };
}
