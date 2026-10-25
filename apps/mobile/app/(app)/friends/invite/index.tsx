import catHiImage from '@assets/images/ido_cat_hi.webp';
import ShareIcon from '@expo/material-symbols/share.xml';
import { InviteLinkCard } from '@src/features/invite/components/invite-link-card';
import { InvitePawPrintBoard } from '@src/features/invite/components/invite-paw-print-board';
import { InviteShareActions } from '@src/features/invite/components/invite-share-actions';
import { InvitedFriendSummary } from '@src/features/invite/components/invited-friend-summary';
import { InviteRewardPolicy } from '@src/features/invite/domains/invite-reward.model';
import { createInviteShareContent } from '@src/features/invite/domains/invite-share.model';
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
  QueryErrorBoundary,
  ReadableContent,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Suspense } from 'react';
import { Image, RefreshControl, ScrollView } from 'react-native';
import { useResolveClassNames } from 'uniwind';

const SHARE_ICON = process.env.EXPO_OS === 'ios' ? 'square.and.arrow.up' : ShareIcon;

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
              <InviteHeroBanner />

              <QueryErrorBoundary fallback={InviteLinkCard.Error}>
                <Suspense fallback={<InviteLinkCard.Loading />}>
                  <InviteLinkCard />
                </Suspense>
              </QueryErrorBoundary>

              <QueryErrorBoundary fallback={InviteShareActions.Error}>
                <Suspense fallback={<InviteShareActions.Loading />}>
                  <InviteShareActions />
                </Suspense>
              </QueryErrorBoundary>

              <VStack gap={14} className="rounded-3xl border border-gray-2 bg-white px-[18px] py-5">
                <H4>{t('pawPrintBoard.title')}</H4>
                <QueryErrorBoundary fallback={InvitePawPrintBoard.Error}>
                  <Suspense fallback={<InvitePawPrintBoard.Loading />}>
                    <InvitePawPrintBoard />
                  </Suspense>
                </QueryErrorBoundary>
              </VStack>

              <QueryErrorBoundary fallback={InvitedFriendSummary.Error}>
                <Suspense fallback={<InvitedFriendSummary.Loading />}>
                  <InvitedFriendSummary />
                </Suspense>
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

function InviteHeroBanner() {
  const { t } = useTranslation('invite');
  const inviteeDays = InviteRewardPolicy.welcomePremiumDays();
  const inviterDays = InviteRewardPolicy.inviterPremiumDays();

  return (
    <Box className="min-h-[168px] overflow-hidden rounded-3xl bg-highlight px-5 pb-5 pt-[22px]">
      {/* 고양이를 먼저 그려 글자 아래에 깔고, 제목은 고양이가 보이는 폭(98pt)만큼 비켜 선다 */}
      <Image
        source={catHiImage}
        accessibilityIgnoresInvertColors
        className="absolute -bottom-[30px] -right-[18px] size-[136px]"
        resizeMode="cover"
      />

      <Box className="self-start rounded-full bg-white px-3 py-1">
        <Text size="b4" weight="semibold" tone="brand">
          {inviteeDays === inviterDays
            ? t('myInvite.heroChip', { days: inviteeDays })
            : t('myInvite.heroChipSeparate', { inviteeDays, inviterDays })}
        </Text>
      </Box>

      <Spacing size={14} />

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
    <VStack gap={4} px={2} accessibilityRole="list">
      <NoticeRow>
        {t('myInvite.notice.qualification', {
          count: InvitedFriendPolicy.requiredActiveDays(),
          days: InvitedFriendPolicy.qualificationWindowDays(),
        })}
      </NoticeRow>
      <NoticeRow>
        {t('myInvite.notice.cap', {
          monthly: InvitePolicy.monthlyPremiumCapDays(),
          total: InvitePolicy.totalPremiumCapDays(),
        })}
      </NoticeRow>
      <NoticeRow>{t('myInvite.notice.subscription')}</NoticeRow>
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
