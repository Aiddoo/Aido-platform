import { useTranslation } from '@src/shared/i18n';
import { Button, Spacing, Text, VStack } from '@src/shared/ui';
import { useRouter } from 'expo-router';
import { Card } from 'heroui-native';

export function ReportPremiumBanner() {
  const router = useRouter();
  const { t } = useTranslation('ai');

  return (
    <Card className="border border-gray-3 dark:bg-gray-2">
      <VStack gap={8} align="center" className="py-4">
        <Text size="b3" weight="bold" shade={9} align="center">
          {t('report.premiumBanner.title')}
        </Text>
        <Text size="b4" shade={6} align="center">
          {t('report.premiumBanner.description')}
        </Text>
        <Spacing size={4} />
        <Button size="medium" onPress={() => router.push('/settings/subscription')}>
          {t('report.premiumBanner.subscribe')}
        </Button>
      </VStack>
    </Card>
  );
}
