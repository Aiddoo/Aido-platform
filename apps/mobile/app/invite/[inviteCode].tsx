import { InviteBenefitReceipt } from '@src/features/social/invite/components/invite-benefit-receipt';
import { InviteCardActions } from '@src/features/social/invite/components/invite-card-actions';
import { InvitePreview } from '@src/features/social/invite/components/invite-preview';
import { useTrackInviteLinkOpened } from '@src/features/social/invite/hooks/use-track-invite-link-opened';
import {
  Box,
  QueryErrorBoundary,
  ReadableContent,
  Spacing,
  StyledSafeAreaView,
} from '@src/shared/ui';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

export default function InviteCardScreen() {
  useTrackInviteLinkOpened();

  return (
    <Box flex={1} className="bg-white">
      <QueryErrorBoundary fallback={InvitePreview.Error}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow"
          contentInsetAdjustmentBehavior="automatic"
        >
          <StyledSafeAreaView edges={['left', 'right']} className="grow">
            <ReadableContent px={24} pt={4} pb={24} className="grow">
              <Suspense fallback={<InvitePreview.Loading />}>
                <InvitePreview />
              </Suspense>

              <Spacing size={24} />

              <Suspense fallback={<InviteBenefitReceipt.Loading />}>
                <InviteBenefitReceipt />
              </Suspense>
            </ReadableContent>
          </StyledSafeAreaView>
        </ScrollView>

        {/* 받기 전에는 누를 수 없고, 화면 맨 아래에 붙어 위 내용을 밀지 않는다 */}
        <Suspense fallback={null}>
          <InviteCardActions />
        </Suspense>
      </QueryErrorBoundary>
    </Box>
  );
}
