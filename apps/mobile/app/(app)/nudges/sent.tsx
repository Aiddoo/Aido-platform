import { SentNudgeList } from '@src/features/nudge/components/nudge-interactions/sent-nudge-list';
import { QueryErrorBoundary, StyledSafeAreaView } from '@src/shared/ui';
import { Suspense } from 'react';

export default function SentNudgesScreen() {
  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-background">
      <QueryErrorBoundary fallback={SentNudgeList.Error}>
        <Suspense fallback={<SentNudgeList.Loading />}>
          <SentNudgeList />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
