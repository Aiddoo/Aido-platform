import { isApiError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import {
  type QueryErrorFallbackProps,
  Result,
  StyledSafeAreaView,
  TextSkeleton,
  HStack,
  VStack,
} from '@src/shared/ui';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { ScrollView } from 'react-native';

function NudgeDetailError({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todo', 'common']);
  const isUnavailable = isApiError(error) && error.status === 404;

  return (
    <VStack flex={1} p={24}>
      <Result
        title={t(isUnavailable ? 'todo:interaction.unavailable' : 'todo:interaction.loadError')}
        description={isUnavailable ? t('todo:interaction.unavailableDescription') : undefined}
        button={
          <Result.Button onPress={isUnavailable ? () => router.replace('/notifications') : reset}>
            {t(isUnavailable ? 'common:actions.goBack' : 'common:actions.retry')}
          </Result.Button>
        }
      />
    </VStack>
  );
}

function NudgeDetailLoading() {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <StyledSafeAreaView edges={['left', 'right']} className="p-6">
        <VStack gap={24}>
          <HStack gap={12} align="center">
            <Skeleton className="size-12 rounded-full" />
            <VStack flex={1} gap={4}>
              <TextSkeleton size="b3" className="w-40" />
              <TextSkeleton size="e1" className="w-16" />
            </VStack>
          </HStack>
          <TextSkeleton size="t3" className="w-3/4" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </VStack>
      </StyledSafeAreaView>
    </ScrollView>
  );
}

export const NudgeDetail = { Error: NudgeDetailError, Loading: NudgeDetailLoading } as const;
