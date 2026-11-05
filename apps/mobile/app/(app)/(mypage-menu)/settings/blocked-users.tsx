import { BlockedUserList } from '@src/features/moderation/components/blocked-user-list';
import { QueryErrorBoundary, ReadableContent, StyledSafeAreaView } from '@src/shared/ui';
import { Suspense } from 'react';

export default function BlockedUsersScreen() {
  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
      <ReadableContent flex={1} px={16}>
        <QueryErrorBoundary fallback={BlockedUserList.Error}>
          <Suspense fallback={<BlockedUserList.Loading />}>
            <BlockedUserList />
          </Suspense>
        </QueryErrorBoundary>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
