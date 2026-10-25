import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useInviteService } from '@src/bootstrap/providers/di-context';
import { InvitePreviewCard } from '@src/features/invite/components/invite-preview-card';
import { InvitePreviewPolicy } from '@src/features/invite/domains/invite-preview.model';
import { InviteRedemptionPolicy } from '@src/features/invite/domains/invite-redemption.model';
import { InviteRewardPolicy } from '@src/features/invite/domains/invite-reward.model';
import { type InviteCode, InvitePolicy } from '@src/features/invite/domains/invite.model';
import { useInviteRouteParams } from '@src/features/invite/hooks/use-invite-route-params';
import { useGetInvitePreviewQueryOptions } from '@src/features/invite/queries/get-invite-preview-query-options';
import { useGetInviteQueryOptions } from '@src/features/invite/queries/get-invite-query-options';
import { useRedeemInviteMutationOptions } from '@src/features/invite/queries/use-redeem-invite-mutation-options';
import { myInviteHref } from '@src/features/invite/utils/navigation/invite-href';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useTranslation } from '@src/shared/i18n';
import {
  Barcode,
  Box,
  Button,
  DashedDivider,
  FillCheckIcon,
  FillTicketIcon,
  HStack,
  ListRow,
  QueryErrorBoundary,
  ReadableContent,
  ScallopedContainer,
  Spacing,
  StyledSafeAreaView,
  Text,
  TextButton,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { Suspense, useEffect } from 'react';
import { ScrollView } from 'react-native';

export default function InviteCardScreen() {
  return (
    <Box flex={1} className="bg-gray-1">
      <QueryErrorBoundary fallback={InvitePreviewCard.Error}>
        <Suspense fallback={<InviteCardScreenLoading />}>
          <ScrollView
            className="flex-1"
            contentContainerClassName="grow"
            contentInsetAdjustmentBehavior="automatic"
          >
            <StyledSafeAreaView edges={['left', 'right']} className="grow">
              <ReadableContent px={24} pt={4} pb={24} className="grow">
                <InvitePreviewCard />

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
        <InvitePreviewCard.Loading />

        <Spacing size={24} />

        <InviteBenefitReceiptLoading />
      </ReadableContent>
    </StyledSafeAreaView>
  );
}

/** 가입하면 받는 혜택을 구독 화면과 같은 영수증 톤으로 보여 준다 */
function InviteBenefitReceipt() {
  const { inviteCode } = useInviteRouteParams();

  if (inviteCode == null) {
    return null;
  }

  return <InviteBenefitReceiptContents inviteCode={inviteCode} />;
}

function InviteBenefitReceiptContents({ inviteCode }: { inviteCode: InviteCode }) {
  const { t } = useTranslation('invite');
  const { data: preview } = useSuspenseQuery(useGetInvitePreviewQueryOptions({ inviteCode }));
  const inviterName = InvitePreviewPolicy.inviterName(preview, t('card.unnamedInviter'));

  return (
    <ScallopedContainer>
      <VStack gap={14} className="px-5 pb-[18px] pt-3.5">
        <HStack gap={12} align="center">
          <FillTicketIcon width={40} height={40} />

          <VStack gap={2} className="flex-1">
            <Text size="t3" weight="bold" tone="brand">
              {t('card.receipt.title', { count: InviteRewardPolicy.welcomePremiumDays() })}
            </Text>

            <Text size="b4" shade={7}>
              {t('card.receipt.description')}
            </Text>
          </VStack>
        </HStack>

        <DashedDivider />

        <VStack>
          <ReceiptBenefitRow title={t('card.receipt.benefitFriend', { name: inviterName })} />
          <ReceiptBenefitRow title={t('card.receipt.benefitAi')} />
          <ReceiptBenefitRow title={t('card.receipt.benefitFriends')} />
        </VStack>

        <DashedDivider />

        <HStack justify="between" align="center">
          <Text size="b4" shade={7}>
            {t('card.receipt.codeLabel')}
          </Text>
          <Text size="b2" weight="bold" className="tracking-[3px] tabular-nums" selectable>
            {inviteCode}
          </Text>
        </HStack>

        <Barcode className="px-9" />
      </VStack>
    </ScallopedContainer>
  );
}

/** 영수증과 같은 행·슬롯에 Skeleton만 넣어 큰 글자에서도 높이가 그대로다 */
function InviteBenefitReceiptLoading() {
  return (
    <ScallopedContainer>
      <VStack gap={14} className="px-5 pb-[18px] pt-3.5" accessibilityState={{ busy: true }}>
        <HStack gap={12} align="center">
          <Skeleton className="size-10 rounded-xl" />

          <VStack gap={2} className="flex-1">
            <TextSkeleton size="t3" className="w-40" />
            <TextSkeleton size="b4" className="w-56" />
          </VStack>
        </HStack>

        <DashedDivider />

        <VStack>
          {times(3, (index) => (
            <ListRow
              key={index}
              verticalPadding="small"
              left={<Skeleton className="size-5 rounded-full" />}
              contents={<TextSkeleton size="b3" className="w-48" />}
            />
          ))}
        </VStack>

        <DashedDivider />

        <HStack justify="between" align="center">
          <TextSkeleton size="b4" className="w-16" />
          <TextSkeleton size="b2" className="w-24" />
        </HStack>

        <Skeleton className="mx-9 h-8 rounded" />
      </VStack>
    </ScallopedContainer>
  );
}

function ReceiptBenefitRow({ title }: { title: string }) {
  return (
    <ListRow
      verticalPadding="small"
      left={
        <Box className="size-5 items-center justify-center rounded-full bg-main">
          <FillCheckIcon width={12} height={12} colorClassName="text-white dark:text-gray-1" />
        </Box>
      }
      contents={
        <Text size="b3" shade={9}>
          {title}
        </Text>
      }
    />
  );
}

/** 초대 카드 아래 행동. 로그인 전이면 초대를 기기에 남기고 가입·로그인으로 보낸다 */
function InviteCardActions() {
  const { status } = useAuth();
  const { inviteCode, source } = useInviteRouteParams();
  const inviteService = useInviteService();
  const { t } = useTranslation('invite');

  if (inviteCode == null) {
    return null;
  }

  if (status === 'authenticated') {
    return <InviteRedeemActions inviteCode={inviteCode} />;
  }

  const continueAsGuest = (pathname: '/sign-up' | '/login') => {
    inviteService.savePendingRedemption({ inviteCode, source }, new Date());
    router.push(pathname);
  };

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']}>
      <ReadableContent px={20} pt={12} pb={12} gap={4}>
        <Button testID="invite-card-signup" onPress={() => continueAsGuest('/sign-up')}>
          {t('card.signUp')}
        </Button>

        <Box className="items-center">
          <TextButton
            testID="invite-card-login"
            size="medium"
            onPress={() => continueAsGuest('/login')}
          >
            {t('card.login')}
          </TextButton>
        </Box>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}

/**
 * 로그인한 사용자의 수락 버튼. 가입한 지 얼마 안 된 계정은 보상을, 오래 쓴 계정은 친구 맺기만 안내한다.
 * 최종 판정은 서버가 하고 결과는 환영 시트가 보여 준다.
 */
function InviteRedeemActions({ inviteCode }: { inviteCode: InviteCode }) {
  const { t } = useTranslation('invite');
  const inviteService = useInviteService();
  const [{ data: preview }, { data: me }, { data: myInvite }] = useSuspenseQueries({
    queries: [
      useGetInvitePreviewQueryOptions({ inviteCode }),
      useGetMeQueryOptions(),
      useGetInviteQueryOptions(),
    ],
  });
  const redeem = useMutation(useRedeemInviteMutationOptions());
  const inviterName = InvitePreviewPolicy.inviterName(preview, t('card.unnamedInviter'));
  const isRewardExpected = InviteRedemptionPolicy.isRewardExpected(me.createdAt, new Date());

  // 로그인한 본인에게 카드를 보여 줬으면 이어서 열 초대를 지운다. 닫고 나가도 다음 실행 때 다시 뜨지 않는다
  useEffect(() => {
    inviteService.clearPendingRedemption();
  }, [inviteService]);

  // 내 링크를 연 경우 수락 요청을 보내지 않고 내 초대 화면으로 안내한다
  if (InvitePolicy.isOwnCode(myInvite, inviteCode)) {
    return (
      <StyledSafeAreaView edges={['left', 'right', 'bottom']}>
        <ReadableContent px={20} pt={12} pb={12} gap={12}>
          <Box className="rounded-2xl bg-white px-4 py-3">
            <Text size="b4" shade={7} align="center">
              {t('card.ownInviteNote')}
            </Text>
          </Box>

          <Button
            testID="invite-card-open-my-invite"
            onPress={() => {
              inviteService.clearPendingRedemption();
              router.replace(myInviteHref());
            }}
          >
            {t('card.openMyInvite')}
          </Button>
        </ReadableContent>
      </StyledSafeAreaView>
    );
  }

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']}>
      <ReadableContent px={20} pt={12} pb={12} gap={12}>
        {!isRewardExpected && (
          <Box className="rounded-2xl bg-white px-4 py-3">
            <Text size="b4" shade={7} align="center">
              {t('card.existingAccountNote')}
            </Text>
          </Box>
        )}

        <Button
          testID="invite-card-redeem"
          onPress={() => redeem.mutate(inviteCode)}
          isLoading={redeem.isPending}
          isDisabled={redeem.isPending}
        >
          {isRewardExpected
            ? t('card.redeemWithReward', { count: InviteRewardPolicy.welcomePremiumDays() })
            : t('card.connect', { name: inviterName })}
        </Button>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
