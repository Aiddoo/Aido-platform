import {
  isActiveSubscription,
  isCancelledSubscription,
  SubscriptionPolicy,
} from '@src/features/subscription/models/subscription.model';
import type { SubscriptionStatus } from '@src/features/user/models/user.model';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, VStack } from '@src/shared/ui';
import { formatFullDate } from '@src/shared/utils/date';
import { Card, Chip, Separator } from 'heroui-native';

interface SubscriptionStatusCardProps {
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: Date | null;
}

const STATUS_KEYS = {
  ACTIVE: { label: 'status.active.label', description: 'status.active.description' },
  CANCELLED: { label: 'status.cancelled.label', description: 'status.cancelled.description' },
  EXPIRED: { label: 'status.expired.label', description: 'status.expired.description' },
  FREE: { label: 'status.free.label', description: 'status.free.description' },
} as const satisfies Record<SubscriptionStatus, { label: string; description: string }>;

export function SubscriptionStatusCard({
  subscriptionStatus,
  subscriptionExpiresAt,
}: SubscriptionStatusCardProps) {
  const { t } = useTranslation('subscription');
  const statusKeys = STATUS_KEYS[subscriptionStatus];
  const isActive = isActiveSubscription(subscriptionStatus);
  const showDetails = SubscriptionPolicy.shouldShowExpirationDetails(
    subscriptionStatus,
    subscriptionExpiresAt,
  );

  const description =
    isCancelledSubscription(subscriptionStatus) && subscriptionExpiresAt
      ? t('status.cancelledUntil', { date: formatFullDate(subscriptionExpiresAt) })
      : t(statusKeys.description);

  return (
    <Card className="dark:bg-gray-2">
      <VStack gap={12}>
        <HStack justify="between" align="center">
          <Text size="t3" weight="bold" shade={9}>
            {t('status.premiumTitle')}
          </Text>

          <Chip size="sm" variant="soft" color="accent">
            <Chip.Label>{t(statusKeys.label)}</Chip.Label>
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
                  {isActive ? t('status.nextBillingDate') : t('status.expiresAt')}
                </Text>
                <Text size="b4" weight="semibold" shade={8}>
                  {formatFullDate(subscriptionExpiresAt)}
                </Text>
              </HStack>

              {isActive && (
                <HStack className="items-center justify-between">
                  <Text size="b4" shade={5}>
                    {t('status.statusLabel')}
                  </Text>
                  <Text size="b4" weight="semibold" tone="brand">
                    {t('status.autoRenewal')}
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
