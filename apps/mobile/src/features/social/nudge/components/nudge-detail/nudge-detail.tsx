import { useTranslation } from '@src/shared/i18n';
import {
  type QueryErrorFallbackProps,
  Result,
  Spacing,
  StyledSafeAreaView,
  TextSkeleton,
  HStack,
  VStack,
} from '@src/shared/ui';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { ScrollView } from 'react-native';

import { isNudgeUnavailable } from '../../domains/todo-nudge.error';
import { NudgeModerationToolbar } from './nudge-moderation-toolbar';
import { NudgeResponse } from './nudge-response';
import { NudgeSummary } from './nudge-summary';
import { NudgeTodoButton } from './nudge-todo-button';

export function NudgeDetail() {
  return (
    <>
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
    </>
  );
}

NudgeDetail.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todo', 'common']);
  const isUnavailable = isNudgeUnavailable(error);

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
};

NudgeDetail.Loading = function Loading() {
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
};
