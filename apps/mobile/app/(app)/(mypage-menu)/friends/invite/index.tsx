import { INVITE_QUALIFICATION, INVITE_REWARD_CAPS } from '@aido/api/vocabulary';
import catHiImage from '@assets/images/ido_cat_hi.webp';
import { InviteContentsError } from '@src/features/social/invite/components/invite-contents-error';
import { InviteLinkCard } from '@src/features/social/invite/components/invite-link-card';
import { InvitePawPrintBoard } from '@src/features/social/invite/components/invite-paw-print-board';
import { PawPrintBoardCard } from '@src/features/social/invite/components/invite-paw-print-board-card';
import { InviteRewardLines } from '@src/features/social/invite/components/invite-reward-lines';
import { InviteShareActions } from '@src/features/social/invite/components/invite-share-actions';
import { InviteShareToolbar } from '@src/features/social/invite/components/invite-share-toolbar';
import { InvitedFriendSummary } from '@src/features/social/invite/components/invited-friend-summary';
import { invalidateInvite } from '@src/features/social/invite/queries/invite-cache';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  Image,
  QueryErrorBoundary,
  ReadableContent,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Suspense } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useResolveClassNames } from 'uniwind';

export default function MyInviteScreen() {
  const { t } = useTranslation('invite');
  const queryClient = useQueryClient();
  const { color: refreshTint } = useResolveClassNames('text-main');
  // 발자국 판·링크·친구 요약이 모두 초대 쿼리를 읽으니 한 번에 새로 고친다
  const [isRefreshing, handleRefresh] = useRefresh(() => invalidateInvite(queryClient));

  return (
    <>
      <InviteShareToolbar />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={refreshTint}
            colors={refreshTint == null ? undefined : [refreshTint]}
          />
        }
      >
        <StyledSafeAreaView edges={['left', 'right']}>
          <ReadableContent px={16} pt={8} pb={32}>
            <VStack gap={20}>
              <Box className="min-h-[168px] overflow-hidden rounded-3xl bg-highlight px-5 pb-5 pt-[22px]">
                {/* 고양이를 먼저 그려 글자 아래에 깔고, 제목은 고양이가 보이는 폭(98pt)만큼 비켜 선다 */}
                <Image
                  source={catHiImage}
                  accessibilityIgnoresInvertColors
                  className="absolute -bottom-[30px] -right-[18px] size-[136px]"
                  contentFit="cover"
                />

                <Text
                  size="t2"
                  weight="bold"
                  lineBreakStrategyIOS="hangul-word"
                  className="mr-[98px]"
                >
                  {t('myInvite.heroTitle')}
                </Text>
              </Box>

              <InviteRewardLines />

              {/* 네 블록이 같은 초대 조회를 읽으므로 실패는 한 곳에서 한 번만 알린다. 불러오는 동안은 블록마다 자리를 지킨다 */}
              <QueryErrorBoundary fallback={InviteContentsError}>
                <Suspense fallback={<InviteLinkCard.Loading />}>
                  <InviteLinkCard />
                </Suspense>

                <Suspense fallback={<InviteShareActions.Loading />}>
                  <InviteShareActions />
                </Suspense>

                <PawPrintBoardCard>
                  <Suspense fallback={<InvitePawPrintBoard.Loading />}>
                    <InvitePawPrintBoard />
                  </Suspense>
                </PawPrintBoardCard>

                <Box className="-mx-4">
                  <Suspense fallback={<InvitedFriendSummary.Loading />}>
                    <InvitedFriendSummary />
                  </Suspense>
                </Box>
              </QueryErrorBoundary>

              {/* 사용 시작 조건과 상한 안내. 이 화면에서만 보여 준다 */}
              <VStack gap={4} px={2}>
                <Text size="b4" weight="semibold" shade={7} accessibilityRole="header">
                  {t('myInvite.notice.title')}
                </Text>
                <Spacing size={2} />
                <VStack gap={4} accessibilityRole="list">
                  <NoticeRow>
                    {t('myInvite.notice.qualification', {
                      count: INVITE_QUALIFICATION.MIN_ACTIVE_DAYS,
                      days: INVITE_QUALIFICATION.EXPIRE_AFTER_DAYS,
                    })}
                  </NoticeRow>
                  <NoticeRow>
                    {t('myInvite.notice.cap', {
                      windowDays: INVITE_REWARD_CAPS.WINDOW_DAYS,
                      monthly: INVITE_REWARD_CAPS.PREMIUM_DAYS_PER_30_DAYS,
                      total: INVITE_REWARD_CAPS.PREMIUM_DAYS_TOTAL,
                    })}
                  </NoticeRow>
                  <NoticeRow>{t('myInvite.notice.subscription')}</NoticeRow>
                </VStack>
              </VStack>
            </VStack>
          </ReadableContent>
        </StyledSafeAreaView>
      </ScrollView>
    </>
  );
}

function NoticeRow({ children }: { children: string }) {
  return (
    <HStack align="start" gap={8}>
      <Box className="mt-[9px] size-[3px] rounded-full bg-gray-5" />
      <Text size="b4" shade={6} className="flex-1">
        {children}
      </Text>
    </HStack>
  );
}
