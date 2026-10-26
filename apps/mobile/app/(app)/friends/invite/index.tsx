import catHiImage from '@assets/images/ido_cat_hi.webp';
import ShareIcon from '@expo/material-symbols/share.xml';
import { InviteLinkCard } from '@src/features/invite/components/invite-link-card';
import { InvitePawPrintBoard } from '@src/features/invite/components/invite-paw-print-board';
import { InviteRewardLines } from '@src/features/invite/components/invite-reward-lines';
import { InviteShareActions } from '@src/features/invite/components/invite-share-actions';
import { InvitedFriendSummary } from '@src/features/invite/components/invited-friend-summary';
import { createInviteShareContent } from '@src/features/invite/domains/invite-share.model';
import { isInviteDisabledError } from '@src/features/invite/domains/invite.error';
import { InvitePolicy } from '@src/features/invite/domains/invite.model';
import { InvitedFriendPolicy } from '@src/features/invite/domains/invited-friend.model';
import { useGetInviteQueryOptions } from '@src/features/invite/queries/get-invite-query-options';
import { invalidateInvite } from '@src/features/invite/queries/invite-cache';
import { useShareInviteMutationOptions } from '@src/features/invite/queries/use-share-invite-mutation-options';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  H4,
  HStack,
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  ReadableContent,
  Result,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { type ReactNode, Suspense } from 'react';
import { Image, RefreshControl, ScrollView } from 'react-native';
import { useResolveClassNames } from 'uniwind';

const SHARE_ICON = process.env.EXPO_OS === 'ios' ? 'square.and.arrow.up' : ShareIcon;

export default function MyInviteScreen() {
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
              <InviteHeroBanner />

              <InviteRewardLines />

              {/* 네 블록이 같은 초대 조회를 읽으므로 실패는 한 곳에서 한 번만 알린다. 불러오는 동안은 블록마다 자리를 지킨다 */}
              <QueryErrorBoundary fallback={InviteContentsError}>
                <Suspense fallback={<InviteLinkCard.Loading />}>
                  <InviteLinkCard />
                </Suspense>

                <Suspense fallback={<InviteShareActions.Loading />}>
                  <InviteShareActions />
                </Suspense>

                <PawPrintBoardSection>
                  <Suspense fallback={<InvitePawPrintBoard.Loading />}>
                    <InvitePawPrintBoard />
                  </Suspense>
                </PawPrintBoardSection>

                <Box className="-mx-4">
                  <Suspense fallback={<InvitedFriendSummary.Loading />}>
                    <InvitedFriendSummary />
                  </Suspense>
                </Box>
              </QueryErrorBoundary>

              <InviteRewardNotice />
            </VStack>
          </ReadableContent>
        </StyledSafeAreaView>
      </ScrollView>
    </>
  );
}

/** 툴바 공유 버튼. 요약이 오기 전에는 숨긴다(레일·가로 바로 OS가 옮긴다) */
function InviteShareToolbar() {
  const { t } = useTranslation('invite');
  const share = useMutation(useShareInviteMutationOptions());
  const [{ data: myInvite }, { data: me }] = useQueries({
    queries: [
      { ...useGetInviteQueryOptions(), throwOnError: false },
      { ...useGetMeQueryOptions(), throwOnError: false },
    ],
  });

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        icon={SHARE_ICON}
        hidden={myInvite == null || me == null}
        accessibilityLabel={t('share.toolbarLabel')}
        onPress={() => {
          if (myInvite == null || me == null) {
            return;
          }

          share.mutate({ channel: 'system', content: createInviteShareContent(myInvite, me.name) });
        }}
      />
    </Stack.Toolbar>
  );
}

/** 초대가 꺼졌으면 블록마다 쓸 수 없음 안내를, 그 밖의 실패는 다시 시도·문의를 한 번만 보인다 */
function InviteContentsError({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('invite');

  if (isInviteDisabledError(error)) {
    return (
      <>
        <InviteLinkCard.Unavailable />
        <InviteShareActions.Unavailable />
        <PawPrintBoardSection>
          <InvitePawPrintBoard.Unavailable />
        </PawPrintBoardSection>
        <Box className="-mx-4">
          <InvitedFriendSummary.Unavailable />
        </Box>
      </>
    );
  }

  return (
    <Box className="min-h-[320px] justify-center">
      <Result title={t('result.loadFailed.title')} button={<QueryErrorActions onRetry={reset} />} />
    </Box>
  );
}

function PawPrintBoardSection({ children }: { children: ReactNode }) {
  const { t } = useTranslation('invite');

  return (
    <VStack gap={14} className="rounded-3xl border border-gray-2 bg-white px-[18px] py-5">
      <H4>{t('pawPrintBoard.title')}</H4>
      {children}
    </VStack>
  );
}

function InviteHeroBanner() {
  const { t } = useTranslation('invite');

  return (
    <Box className="min-h-[168px] overflow-hidden rounded-3xl bg-highlight px-5 pb-5 pt-[22px]">
      {/* 고양이를 먼저 그려 글자 아래에 깔고, 제목은 고양이가 보이는 폭(98pt)만큼 비켜 선다 */}
      <Image
        source={catHiImage}
        accessibilityIgnoresInvertColors
        className="absolute -bottom-[30px] -right-[18px] size-[136px]"
        resizeMode="cover"
      />

      <Text size="t2" weight="bold" lineBreakStrategyIOS="hangul-word" className="mr-[98px]">
        {t('myInvite.heroTitle')}
      </Text>
    </Box>
  );
}

/** 사용 시작 조건과 상한 안내. 이 화면에서만 보여 준다 */
function InviteRewardNotice() {
  const { t } = useTranslation('invite');

  return (
    <VStack gap={4} px={2}>
      <Text size="b4" weight="semibold" shade={7} accessibilityRole="header">
        {t('myInvite.notice.title')}
      </Text>
      <Spacing size={2} />
      <VStack gap={4} accessibilityRole="list">
        <NoticeRow>
          {t('myInvite.notice.qualification', {
            count: InvitedFriendPolicy.requiredActiveDays(),
            days: InvitedFriendPolicy.qualificationWindowDays(),
          })}
        </NoticeRow>
        <NoticeRow>
          {t('myInvite.notice.cap', {
            windowDays: InvitePolicy.premiumCapWindowDays(),
            monthly: InvitePolicy.monthlyPremiumCapDays(),
            total: InvitePolicy.totalPremiumCapDays(),
          })}
        </NoticeRow>
        <NoticeRow>{t('myInvite.notice.subscription')}</NoticeRow>
      </VStack>
    </VStack>
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
