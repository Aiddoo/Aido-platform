import { Button } from '@src/shared/ui/Button/Button';
import { Spacing } from '@src/shared/ui/Spacing';
import { Text } from '@src/shared/ui/Text';
import { VStack } from '@src/shared/ui/VStack';
import { useRouter } from 'expo-router';
import { Card } from 'heroui-native';

export function ReportPremiumBanner() {
  const router = useRouter();

  return (
    <Card className="border border-gray-3 dark:bg-gray-2">
      <VStack gap={8} align="center" className="py-4">
        <Text size="b3" weight="bold" shade={9}>
          AI가 분석한 나만의 리포트
        </Text>
        <Text size="b4" shade={6} className="text-center">
          {'프리미엄 구독으로 매주/매월\nAI 리포트를 받아보세요'}
        </Text>
        <Spacing size={4} />
        <Button size="medium" onPress={() => router.push('/settings/subscription')}>
          구독하기
        </Button>
      </VStack>
    </Card>
  );
}
