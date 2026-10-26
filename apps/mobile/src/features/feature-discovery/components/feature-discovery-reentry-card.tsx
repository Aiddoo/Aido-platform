import { useTranslation } from '@src/shared/i18n';
import { CloseIcon, HStack, RobotPixelIcon, Text, VStack } from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';

interface FeatureDiscoveryReentryCardProps {
  onPress: () => void;
  onDismiss: () => void;
}

/** 기능 가이드를 다시 여는 피드 카드. 피드의 알림 받기 배너와 같은 모양·닫기 버튼을 쓴다 */
export function FeatureDiscoveryReentryCard({
  onPress,
  onDismiss,
}: FeatureDiscoveryReentryCardProps) {
  const { t } = useTranslation('featureDiscovery');

  return (
    <HStack align="center" gap={12} className="rounded-xl bg-gray-1 px-4 py-3.5">
      <PressableFeedback
        testID="feature-guide-open"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('entry.openLabel')}
        className="flex-1"
      >
        <HStack align="center" gap={12}>
          <RobotPixelIcon width={24} height={24} colorClassName="text-main" />
          <VStack flex={1} gap={2}>
            <Text size="b3" weight="medium">
              {t('entry.feedTitle')}
            </Text>
            <Text size="e1" shade={6}>
              {t('entry.feedDescription')}
            </Text>
          </VStack>
        </HStack>
      </PressableFeedback>

      <PressableFeedback
        testID="feature-guide-dismiss"
        onPress={onDismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('entry.dismissLabel')}
      >
        <CloseIcon width={20} height={20} colorClassName="text-gray-6" />
      </PressableFeedback>
    </HStack>
  );
}
