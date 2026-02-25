import type { SubscriptionStatus } from '@src/features/user/models/user.model';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { View } from 'react-native';

interface SubscriptionStatusCardProps {
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: Date | null;
}

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; color: string; bgColor: string }> =
  {
    ACTIVE: { label: '구독 중', color: 'text-main', bgColor: 'bg-main/10' },
    CANCELLED: { label: '취소됨', color: 'text-gray-6', bgColor: 'bg-gray-2' },
    EXPIRED: { label: '만료됨', color: 'text-gray-6', bgColor: 'bg-gray-2' },
    FREE: { label: '무료', color: 'text-gray-6', bgColor: 'bg-gray-2' },
  };

export function SubscriptionStatusCard({
  subscriptionStatus,
  subscriptionExpiresAt,
}: SubscriptionStatusCardProps) {
  const config = STATUS_CONFIG[subscriptionStatus];
  const dateLabel = subscriptionStatus === 'ACTIVE' ? '다음 결제일' : '만료일';

  return (
    <VStack gap={12} className="bg-white dark:bg-gray-2 rounded-2xl p-4">
      <HStack className="items-center justify-between">
        <Text size="b3" weight="bold" className="text-gray-9">
          프리미엄
        </Text>
        <View className={`${config.bgColor} px-2.5 py-1 rounded-full`}>
          <Text size="e2" weight="bold" className={config.color}>
            {config.label}
          </Text>
        </View>
      </HStack>

      {subscriptionExpiresAt && (
        <HStack className="items-center justify-between">
          <Text size="b4" className="text-gray-5">
            {dateLabel}
          </Text>
          <Text size="b4" weight="semibold" className="text-gray-8">
            {subscriptionExpiresAt.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </HStack>
      )}

      <Text size="e1" className="text-gray-5">
        구독은 App Store 또는 Play Store 설정에서 관리할 수 있어요
      </Text>
    </VStack>
  );
}
