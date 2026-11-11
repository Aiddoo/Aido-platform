import { NudgeModerationToolbar } from '@src/features/social/nudge/components/nudge-detail/nudge-moderation-toolbar';
import { NudgeResponse } from '@src/features/social/nudge/components/nudge-detail/nudge-response';
import { NudgeSummary } from '@src/features/social/nudge/components/nudge-detail/nudge-summary';
import { NudgeTodoButton } from '@src/features/social/nudge/components/nudge-detail/nudge-todo-button';
import { isNudgeUnavailableError } from '@src/features/social/nudge/domains/todo-nudge.error';
import { nudgeParamsSchema } from '@src/features/social/nudge/schemas/nudge-params.schema';
import { useTranslation } from '@src/shared/i18n';
import {
  HStack,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  ReadableContent,
  Result,
  Spacing,
  StyledSafeAreaView,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

export default function NudgeDetailScreen() {
  const params = nudgeParamsSchema.safeParse(useLocalSearchParams());

  return (
    <StyledSafeAreaView edges={['bottom']} className="flex-1 bg-white">
      <ReadableContent flex={1}>
        {params.success ? (
          <QueryErrorBoundary resetKeys={[params.data.nudgeId]} fallback={NudgeDetailScreen.Error}>
            <Suspense fallback={<NudgeDetailScreen.Loading />}>
              <NudgeModerationToolbar />

              <ScrollView contentContainerClassName="grow">
                <StyledSafeAreaView edges={['left', 'right']} className="p-6" testID="nudge-detail">
                  <NudgeSummary />

                  <Spacing size={24} />

                  <NudgeTodoButton />

                  <Spacing size={24} />

                  <NudgeResponse />
                </StyledSafeAreaView>
              </ScrollView>
            </Suspense>
          </QueryErrorBoundary>
        ) : (
          <NudgeDetailScreen.Unavailable />
        )}
      </ReadableContent>
    </StyledSafeAreaView>
  );
}

/** 응답 자리는 받은 사람인지, 완료됐는지에 따라 모양이 달라 그리지 않는다 */
NudgeDetailScreen.Loading = function Loading() {
  return (
    <ScrollView contentContainerClassName="grow">
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

          <HStack gap={12} align="center" p={16}>
            <Skeleton className="size-7 rounded-full" />
            <VStack flex={1} gap={4}>
              <TextSkeleton size="b3" className="w-3/4" />
              <TextSkeleton size="e1" className="w-16" />
            </VStack>
          </HStack>
        </VStack>
      </StyledSafeAreaView>
    </ScrollView>
  );
};

NudgeDetailScreen.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todo', 'common']);

  if (isNudgeUnavailableError(error)) {
    return (
      <StyledSafeAreaView edges={['left', 'right']} className="flex-1 p-6">
        <Result
          title={t('todo:interaction.unavailable')}
          description={t('todo:interaction.unavailableDescription')}
          button={
            <Result.Button onPress={() => router.replace('/notifications')}>
              {t('common:actions.goBack')}
            </Result.Button>
          }
        />
      </StyledSafeAreaView>
    );
  }

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 p-6">
      <Result
        title={t('todo:interaction.loadError')}
        button={<Result.Button onPress={reset}>{t('common:actions.retry')}</Result.Button>}
      />
    </StyledSafeAreaView>
  );
};

NudgeDetailScreen.Unavailable = function Unavailable() {
  const { t } = useTranslation('todo');

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 p-6">
      <Result title={t('interaction.unavailable')} />
    </StyledSafeAreaView>
  );
};
