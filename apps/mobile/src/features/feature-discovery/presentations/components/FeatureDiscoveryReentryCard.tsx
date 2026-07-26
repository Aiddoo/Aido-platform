import { useTranslation } from '@src/shared/i18n';
import { RobotPixelIcon, Text, VStack } from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';

interface FeatureDiscoveryReentryCardProps {
  onPress: () => void;
}

export function FeatureDiscoveryReentryCard({ onPress }: FeatureDiscoveryReentryCardProps) {
  const { t } = useTranslation('featureDiscovery');

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('entry.openLabel')}
      className="rounded-2xl bg-main/10 px-4 py-3"
    >
      <PressableFeedback.Highlight className="rounded-2xl" />
      <VStack gap={4}>
        <RobotPixelIcon width={24} height={24} colorClassName="text-main" />
        <Text size="b3" weight="semibold" shade={9} className="shrink">
          {t('entry.feedTitle')}
        </Text>
        <Text size="b4" shade={6} className="shrink">
          {t('entry.feedDescription')}
        </Text>
      </VStack>
    </PressableFeedback>
  );
}
