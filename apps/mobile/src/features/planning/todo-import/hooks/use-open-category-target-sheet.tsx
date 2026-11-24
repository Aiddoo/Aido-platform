import { QueryErrorBoundary, useOpenKeyboardSheet } from '@src/shared/ui';
import { type ComponentProps, Suspense } from 'react';

import { CategoryTargetSheet } from '../components/category-target-sheet';

type OpenCategoryTargetSheetOptions = Omit<
  ComponentProps<typeof CategoryTargetSheet>,
  'isOpen' | 'onOpenChange' | 'close'
>;

/**
 * 넣을 곳을 고르는 시트를 연다. 고르면 `onChoose`가 불리고 시트는 내려간 뒤에 지워진다.
 * 새 카테고리 이름·색은 같은 시트 안에서 받아, 내려가는 시트 위에 다른 시트를 띄워 얼지 않게 한다
 */
export function useOpenCategoryTargetSheet(): (options: OpenCategoryTargetSheetOptions) => void {
  const openKeyboardSheet = useOpenKeyboardSheet();

  return (options) =>
    openKeyboardSheet(({ isOpen, onOpenChange, close }) => (
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
            onOpenChange={onOpenChange}
            close={close}
          />
        </Suspense>
      </QueryErrorBoundary>
    ));
}
