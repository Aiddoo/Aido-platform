import {
  INVITE_QUALIFICATION,
  INVITE_REWARD_CAPS,
  INVITEE_REWARDS,
  INVITER_REWARD_MILESTONES,
} from '@aido/api/vocabulary';
import { InvitePawPrintBoard } from '@src/features/social/invite/components/invite-paw-print-board';
import { InviteShareActions } from '@src/features/social/invite/components/invite-share-actions';
import { InviteShareToolbar } from '@src/features/social/invite/components/invite-share-toolbar';
import { InvitedFriendSummary } from '@src/features/social/invite/components/invited-friend-summary';
import { MyInviteCode } from '@src/features/social/invite/components/my-invite-code';
import { InviteMilestonePolicy } from '@src/features/social/invite/domains/invite-milestone.model';
import { InviteRewardPolicy } from '@src/features/social/invite/domains/invite-reward.model';
import { isInviteDisabledError } from '@src/features/social/invite/domains/invite.error';
import { refreshInvite } from '@src/features/social/invite/queries/invite-cache';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  H4,
  HStack,
  QueryErrorBoundary,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  ReadableContent,
  StyledSafeAreaView,
  SurfaceCard,
  Text,
  TintedRefreshControl,
  VStack,
  WordWrapText,
  Mascot,
} from '@src/shared/ui';
import { tv } from '@src/shared/utils/tv';
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Chip } from 'heroui-native';
import { Suspense, type ReactNode } from 'react';
import { ScrollView } from 'react-native';

export default function MyInviteScreen() {
  const { t } = useTranslation('invite');
  const queryClient = useQueryClient();
  // 발자국 판·링크·친구 요약이 모두 초대 쿼리를 읽으니 한 번에 새로 고친다
  const [isRefreshing, handleRefresh] = useRefresh(() => refreshInvite(queryClient));

  return (
    <>
      <Stack.Screen options={{ title: t('myInvite.title') }} />

      <InviteShareToolbar />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <TintedRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <StyledSafeAreaView edges={['left', 'right']}>
          <ReadableContent px={16} pt={8} pb={32}>
            <VStack gap={20}>
              <Box className="min-h-[168px] overflow-hidden rounded-3xl bg-highlight px-5 pt-5.5 pb-5">
                {/* 고양이를 먼저 그려 글자 아래에 깔고, 제목은 고양이가 보이는 폭(98pt)만큼 비켜 선다 */}
                <Mascot
                  name="catHi"
                  size={136}
                  contentFit="cover"
                  className="absolute -right-[18px] -bottom-[30px]"
                />

                <Text
                  size="t2"
                  weight="bold"
                  lineBreakStrategyIOS="hangul-word"
                  className="mr-24.5"
                >
                  {t('myInvite.heroTitle')}
                </Text>
              </Box>

              <InviteCard>
                <RewardLine
                  label={t('myInvite.rewardInviteeLabel')}
                  value={t('myInvite.rewardInvitee', {
                    days: InviteRewardPolicy.getPremiumDays(INVITEE_REWARDS),
                  })}
                />
                <RewardLine
                  label={t('myInvite.rewardInviterLabel')}
                  value={t('myInvite.rewardInviter', {
                    activeDays: INVITE_QUALIFICATION.MIN_ACTIVE_DAYS,
                    days: InviteMilestonePolicy.getPremiumDays(INVITER_REWARD_MILESTONES[0]),
                  })}
                />
              </InviteCard>

              {/* 세 블록이 같은 초대 조회를 읽으므로 실패는 한 곳에서 한 번만 알린다. 불러오는 동안은 블록마다 자리를 지킨다 */}
              <QueryErrorBoundary fallback={MyInviteScreen.Error}>
                <Suspense fallback={<MyInviteCode.Loading />}>
                  <MyInviteCode />
                </Suspense>

                <Suspense fallback={<InviteShareActions.Loading />}>
                  <InviteShareActions />
                </Suspense>

                <InviteCard title={t('pawPrintBoard.title')}>
                  <Suspense fallback={<InvitePawPrintBoard.Loading />}>
                    <InvitePawPrintBoard />
                  </Suspense>
                </InviteCard>
              </QueryErrorBoundary>

              {/* 초대한 친구 요약은 다른 조회라 실패해도 위 블록을 지우지 않는다 */}
              <QueryErrorBoundary fallback={InvitedFriendSummary.Error}>
                <Suspense fallback={<InvitedFriendSummary.Loading />}>
                  <InvitedFriendSummary />
                </Suspense>
              </QueryErrorBoundary>

              {/* 사용 시작 조건과 상한 안내. 이 화면에서만 보여 준다 */}
              <VStack className="gap-1 px-0.5">
                <Text size="b4" weight="semibold" shade={7} accessibilityRole="header">
                  {t('myInvite.notice.title')}
                </Text>
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

/** 초대가 꺼졌으면 블록마다 쓸 수 없음 안내를, 그 밖의 실패는 다시 시도·문의를 한 번만 보인다 */
MyInviteScreen.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('invite');

  if (isInviteDisabledError(error)) {
    return (
      <>
        <MyInviteCode.Unavailable />
        <InviteShareActions.Unavailable />
        <InviteCard title={t('pawPrintBoard.title')}>
          <InvitePawPrintBoard.Unavailable />
        </InviteCard>
      </>
    );
  }

  return (
    <Box className="min-h-[320px] justify-center">
      <QueryErrorFallback title={t('result.loadFailed.title')} reset={reset} />
    </Box>
  );
};

function RewardLine({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation('invite');

  return (
    <VStack gap={6} accessible accessibilityLabel={t('myInvite.rewardLineLabel', { label, value })}>
      <Chip size="sm" variant="soft" className="bg-main/10">
        <Text size="e1" weight="bold" tone="brand">
          {label}
        </Text>
      </Chip>
      <WordWrapText size="b3" shade={9}>
        {value}
      </WordWrapText>
    </VStack>
  );
}

const inviteCard = tv({
  base: 'gap-3.5 border border-gray-2 px-4.5',
  variants: { hasTitle: { true: 'py-5', false: 'py-4' } },
});

/** 제목이 있으면 위아래를 조금 더 띄운다 */
function InviteCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <SurfaceCard className={inviteCard({ hasTitle: title != null })}>
      {title != null && <H4>{title}</H4>}
      {children}
    </SurfaceCard>
  );
}

function NoticeRow({ children }: { children: string }) {
  return (
    <HStack align="start" gap={8}>
      <Box className="mt-2.25 size-[3px] rounded-full bg-gray-5" />
      <Text size="b4" shade={6} className="flex-1">
        {children}
      </Text>
    </HStack>
  );
}
