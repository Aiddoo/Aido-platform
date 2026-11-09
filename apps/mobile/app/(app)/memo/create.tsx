import { MemoCreateForm } from '@src/features/notes/memo/components/memo-create-form';
import { QueryErrorBoundary } from '@src/shared/ui';
import { Suspense } from 'react';

export default function MemoCreateRoute() {
  return (
    <QueryErrorBoundary>
      {/* 내 정보는 로그인 때 받아 둔 캐시라 기다릴 일이 거의 없다 */}
      <Suspense fallback={null}>
        <MemoCreateForm />
      </Suspense>
    </QueryErrorBoundary>
  );
}
