import {
  isActiveSubscription,
  isCancelledSubscription,
  SubscriptionPolicy,
} from '@src/features/subscription/models/subscription.model';
import type { SubscriptionStatus } from '@src/features/user/models/user.model';
import { HStack, Text, VStack } from '@src/shared/ui';
import { formatFullDate } from '@src/shared/utils/date';
import { Card, Chip, Separator } from 'heroui-native';

interface SubscriptionStatusCardProps {
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: Date | null;
}

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; description: string }> = {
  ACTIVE: { label: '구독 중', description: '모든 프리미엄 기능을 이용 중이에요' },
  CANCELLED: { label: '취소됨', description: '구독이 취소되었어요' },
  EXPIRED: { label: '만료됨', description: '구독이 만료되었어요' },
  FREE: { label: '무료', description: '무료 플랜을 이용 중이에요' },
};

export function SubscriptionStatusCard({
  subscriptionStatus,
  subscriptionExpiresAt,
}: SubscriptionStatusCardProps) {
  const config = STATUS_CONFIG[subscriptionStatus];
  const isActive = isActiveSubscription(subscriptionStatus);
  const showDetails = SubscriptionPolicy.shouldShowExpirationDetails(
    subscriptionStatus,
    subscriptionExpiresAt,
  );

  const description =
    isCancelledSubscription(subscriptionStatus) && subscriptionExpiresAt
      ? `구독이 취소되었어요. ${formatFullDate(subscriptionExpiresAt)}까지 이용할 수 있어요`
      : config.description;

  return (
    <Card className="dark:bg-gray-2">
      <VStack gap={12}>
        <HStack justify="between" align="center">
          <Text size="t3" weight="bold" shade={9}>
            Aido 프리미엄
          </Text>

          <Chip size="sm" variant="soft" color="accent">
            <Chip.Label>{config.label}</Chip.Label>
          </Chip>
        </HStack>

        <Text size="b4" shade={6}>
          {description}
        </Text>

        {showDetails && (
          <>
            <Separator className="bg-gray-2 dark:bg-gray-3" />

            <VStack gap={8}>
              <HStack className="items-center justify-between">
                <Text size="b4" shade={5}>
                  {isActive ? '다음 결제일' : '만료일'}
                </Text>
                <Text size="b4" weight="semibold" shade={8}>
                  {formatFullDate(subscriptionExpiresAt)}
                </Text>
              </HStack>

              {isActive && (
                <HStack className="items-center justify-between">
                  <Text size="b4" shade={5}>
                    구독 상태
                  </Text>
                  <Text size="b4" weight="semibold" tone="brand">
                    자동 갱신
                  </Text>
                </HStack>
              )}
            </VStack>
          </>
        )}
      </VStack>
    </Card>
  );
}
