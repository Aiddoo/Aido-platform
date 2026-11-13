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
      {/* 미리보기·받을 혜택·수락 버튼이 모두 같은 미리보기 조회라 실패(없는·바뀐 코드 등)는 화면 하나로 알린다 */}
      <QueryErrorBoundary fallback={InvitePreview.Error}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow"
          contentInsetAdjustmentBehavior="automatic"
        >
          <StyledSafeAreaView edges={['left', 'right']} className="grow">
            <ReadableContent className="grow px-6 pt-1 pb-6">
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
