import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useInviteService } from '@src/bootstrap/providers/di-context';
import { InvitePreviewCard } from '@src/features/invite/components/invite-preview-card';
import { InvitePreviewPolicy } from '@src/features/invite/domains/invite-preview.model';
import { InviteRewardPolicy } from '@src/features/invite/domains/invite-reward.model';
import type { InviteCode } from '@src/features/invite/domains/invite.model';
import { useInviteRouteParams } from '@src/features/invite/hooks/use-invite-route-params';
import { useGetInvitePreviewQueryOptions } from '@src/features/invite/queries/get-invite-preview-query-options';
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
import { useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { Suspense } from 'react';
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

  if (inviteCode == null || status === 'authenticated') {
    return null;
  }

  const continueAsGuest = (pathname: '/sign-up' | '/login') => {
    inviteService.savePendingRedemption({ inviteCode, source, ownerId: null }, new Date());
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
