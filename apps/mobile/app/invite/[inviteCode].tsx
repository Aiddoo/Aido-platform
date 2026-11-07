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
        <Suspense fallback={<InviteCardScreenLoading />}>
          <ScrollView
            className="flex-1"
            contentContainerClassName="grow"
            contentInsetAdjustmentBehavior="automatic"
          >
            <StyledSafeAreaView edges={['left', 'right']} className="grow">
              <ReadableContent px={24} pt={4} pb={24} className="grow">
                <InvitePreview />

                <Spacing size={24} />

                <InviteBenefitReceipt />
              </ReadableContent>
            </StyledSafeAreaView>
          </ScrollView>

          <InviteCardActions />
        </Suspense>
      </QueryErrorBoundary>
    </Box>
  );
}

function InviteCardScreenLoading() {
  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1">
      <ReadableContent px={24} pt={4} className="flex-1">
        <InvitePreview.Loading />

        <Spacing size={24} />

        <InviteBenefitReceipt.Loading />
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
