import { INVITE_QUALIFICATION } from '@aido/api/vocabulary';
import { ReceiptBenefitRow } from '@src/features/billing/subscription/components/receipt-benefit-row';
import { useTranslation } from '@src/shared/i18n';
import {
  Barcode,
  DashedDivider,
  FillTicketIcon,
  HStack,
  ListRow,
  ScallopedContainer,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Skeleton } from 'heroui-native';

import { INVITEE_PREMIUM_DAYS, FIRST_INVITER_PREMIUM_DAYS } from '../constants/invite.constants';
import type { InviteCode } from '../domains/invite-code.model';
import { useInviteParams } from '../hooks/use-invite-params';
import { useGetInvitePreviewQueryOptions } from '../queries/invite.queries';

/** 가입하면 받는 혜택을 구독 화면과 같은 영수증 톤으로 보여 준다 */
export function InviteBenefitReceipt() {
  const [{ inviteCode }] = useInviteParams();

  if (inviteCode == null) {
    return null;
  }

  return <InviteBenefitReceipt.Receipt inviteCode={inviteCode} />;
}

InviteBenefitReceipt.Receipt = function Receipt({ inviteCode }: { inviteCode: InviteCode }) {
  const { t } = useTranslation('invite');
  const { data: preview } = useSuspenseQuery(useGetInvitePreviewQueryOptions({ inviteCode }));
  const inviterName = preview.inviter.name ?? t('card.unnamedInviter');

  return (
    <ScallopedContainer>
      <VStack gap={14} className="px-5 pb-4.5 pt-3.5">
        <HStack className="gap-3" align="center">
          <FillTicketIcon width={40} height={40} />

          <VStack gap={2} className="flex-1">
            <Text size="t3" weight="bold" tone="brand">
              {t('card.receipt.title', { count: INVITEE_PREMIUM_DAYS })}
            </Text>

            <Text size="b4" shade={7}>
              {t('card.receipt.description')}
            </Text>
          </VStack>
        </HStack>

        <DashedDivider />

        <VStack>
          <ReceiptBenefitRow
            shade={9}
            title={t('card.receipt.benefitFriend', { name: inviterName })}
          />
          <ReceiptBenefitRow shade={9} title={t('card.receipt.benefitAi')} />
          <ReceiptBenefitRow shade={9} title={t('card.receipt.benefitFriends')} />
        </VStack>

        <Text
          size="b4"
          shade={6}
          lineBreakStrategyIOS="hangul-word"
          textBreakStrategy="highQuality"
        >
          {t('card.receipt.inviterReward', {
            name: inviterName,
            activeDays: INVITE_QUALIFICATION.MIN_ACTIVE_DAYS,
            days: FIRST_INVITER_PREMIUM_DAYS,
          })}
        </Text>

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
};

/** 영수증과 같은 행·슬롯에 Skeleton만 넣어 큰 글자에서도 높이가 그대로다 */
InviteBenefitReceipt.Loading = function Loading() {
  return (
    <ScallopedContainer>
      <VStack gap={14} className="px-5 pb-4.5 pt-3.5" accessibilityState={{ busy: true }}>
        <HStack className="gap-3" align="center">
          <Skeleton className="size-10 rounded-xl" />

          <VStack gap={2} className="flex-1">
            <TextSkeleton size="t3" className="w-40" />
            <TextSkeleton size="b4" className="w-56" />
          </VStack>
        </HStack>

        <DashedDivider />

        <VStack>
          {range(3).map((index) => (
            <ListRow
              key={index}
              verticalPadding="small"
              left={<Skeleton className="size-5 rounded-full" />}
              contents={<TextSkeleton size="b3" className="w-48" />}
            />
          ))}
        </VStack>

        <VStack>
          <TextSkeleton size="b4" className="w-full" />
          <TextSkeleton size="b4" className="w-40" />
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
};
