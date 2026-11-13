import { BlockedUserList } from '@src/features/social/moderation/components/blocked-user-list';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, ReadableContent, StyledSafeAreaView } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { Suspense } from 'react';

export default function BlockedUsersScreen() {
  const { t } = useTranslation('settings');

  return (
    <>
      <Stack.Screen options={{ title: t('titles.blockedUsers') }} />

      <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
        <ReadableContent flex={1} px={16}>
          <QueryErrorBoundary fallback={BlockedUserList.Error}>
            <Suspense fallback={<BlockedUserList.Loading />}>
              <BlockedUserList />
            </Suspense>
          </QueryErrorBoundary>
        </ReadableContent>
      </StyledSafeAreaView>
    </>
  );
}
