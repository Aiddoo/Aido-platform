import { MemoCreateForm } from '@src/features/memo/components/memo-create-form';
import { QueryErrorBoundary } from '@src/shared/ui';
import { Suspense } from 'react';

export default function MemoCreateRoute() {
  return (
    <QueryErrorBoundary>
      <Suspense fallback={null}>
        <MemoCreateForm />
      </Suspense>
    </QueryErrorBoundary>
  );
}
