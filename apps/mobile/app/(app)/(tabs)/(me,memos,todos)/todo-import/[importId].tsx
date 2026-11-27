import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { TodoImportFailureAlert } from '@src/features/planning/todo-import/components/todo-import-failure-alert';
import { TodoImportProgress } from '@src/features/planning/todo-import/components/todo-import-progress';
import { TodoImportResult } from '@src/features/planning/todo-import/components/todo-import-result';
import { TodoImportUndoButton } from '@src/features/planning/todo-import/components/todo-import-undo-button';
import { isTodoImportNotFoundError } from '@src/features/planning/todo-import/domains/todo-import.error';
import {
  type TodoImport,
  TodoImportPolicy,
} from '@src/features/planning/todo-import/domains/todo-import.model';
import { useSuspenseTodoImport } from '@src/features/planning/todo-import/hooks/use-suspense-todo-import';
import { useTodoImportId } from '@src/features/planning/todo-import/hooks/use-todo-import-params';
import { todoImportParamsSchema } from '@src/features/planning/todo-import/schemas/todo-import-params.schema';
import {
  toTodoImportCountBucket,
  toTodoImportOutcome,
} from '@src/features/planning/todo-import/utils/todo-import-analytics';
import { useTrack } from '@src/shared/analytics';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  ErrorIllustration,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  ReadableContent,
  Result,
  SafeAreaScrollView,
  Spacing,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { useRouter, Stack } from 'expo-router';
import { Spinner } from 'heroui-native';
import { Suspense, useEffect, useEffectEvent, useRef } from 'react';
import { match } from 'ts-pattern';

export default function TodoImportRoute() {
  const route = useRouteParamsOrRedirect(todoImportParamsSchema, { fallbackHref: '/todo-import' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return <TodoImportScreen />;
}

function TodoImportScreen() {
  const [importId] = useTodoImportId();

  return (
    <SafeAreaScrollView className="flex-1 bg-white" contentInsetAdjustmentBehavior="automatic">
      <ReadableContent className="px-4 pt-6 pb-8">
        <QueryErrorBoundary fallback={TodoImportScreen.Error} resetKeys={[importId]}>
          {/* 받기 전에는 진행·결과 중 무엇일지 몰라 어느 모양도 미리 그리지 않는다 */}
          <Suspense fallback={<TodoImportScreen.Loading />}>
            <TodoImportScreen.Stage />
          </Suspense>
        </QueryErrorBoundary>
      </ReadableContent>
    </SafeAreaScrollView>
  );
}

TodoImportScreen.Stage = function Stage() {
  const { t } = useTranslation('todoImport');
  const todoImport = useSuspenseTodoImport();

  useTrackImportOutcome(todoImport);

  return match(TodoImportPolicy.getStage(todoImport))
    .with('processing', () => (
      <>
        <Stack.Screen options={{ title: t('titles.progress') }} />
        <TodoImportProgress />
        <Spacing size={16} />
        <WordWrapText size="b4" shade={6} align="center">
          {t('progress.leaveNotice')}
        </WordWrapText>
      </>
    ))
    .with('finished', () => (
      <>
        <Stack.Screen options={{ title: t('titles.result') }} />
        <TodoImportResult />
      </>
    ))
    .with('undoFailed', () => (
      <>
        <Stack.Screen options={{ title: t('titles.result') }} />
        <Result
          icon={<ErrorIllustration />}
          title={t('result.undoFailedTitle')}
          description={t('result.undoFailedDescription')}
          button={<TodoImportUndoButton size="large">{t('result.undoAgain')}</TodoImportUndoButton>}
        />
      </>
    ))
    .with('failed', () => (
      <>
        <Stack.Screen options={{ title: t('titles.result') }} />
        <Result
          icon={<ErrorIllustration />}
          title={t('result.failedTitle')}
          description={t('result.failedDescription', { count: todoImport.counts.created })}
          button={
            <VStack gap={8}>
              <StartAgainButton />
              <TodoImportUndoButton size="large" variant="weak">
                {t('result.undo')}
              </TodoImportUndoButton>
            </VStack>
          }
        />
      </>
    ))
    .with('stopped', () => (
      <>
        <Stack.Screen options={{ title: t('titles.result') }} />
        <TodoImportFailureAlert className="mb-4" />
        <Result
          icon={<ErrorIllustration />}
          title={t('result.canceledTitle')}
          description={t('result.canceledDescription')}
          button={<StartAgainButton />}
        />
      </>
    ))
    .exhaustive();
};

TodoImportScreen.Loading = function Loading() {
  return (
    <Box className="items-center py-10">
      <Spinner />
    </Box>
  );
};

/** 다른 계정의 가져오기, 30일이 지나 지워진 기록, 잘못된 링크는 다시 시도해도 같아 새로 가져오게 한다 */
TodoImportScreen.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('todoImport');
  const router = useRouter();
  const replaceOnce = useSingleTap(router.replace);

  if (!isTodoImportNotFoundError(error)) {
    return <TodoImportProgress.Error error={error} reset={reset} />;
  }

  return (
    <Result
      icon={<ErrorIllustration />}
      title={t('result.notFoundTitle')}
      description={t('result.notFoundDescription')}
      button={
        <Button size="large" onPress={() => replaceOnce('/todo-import')}>
          {t('result.startNew')}
        </Button>
      }
    />
  );
};

function StartAgainButton() {
  const { t } = useTranslation('todoImport');
  const router = useRouter();
  const replaceOnce = useSingleTap(router.replace);

  return (
    <Button size="large" onPress={() => replaceOnce('/todo-import')}>
      {t('result.startAgain')}
    </Button>
  );
}

/** 이 화면에서 처리 중이던 가져오기가 끝나는 순간만 센다. 결과를 다시 열 때는 세지 않는다 */
function useTrackImportOutcome(todoImport: TodoImport) {
  const { status, counts } = todoImport;
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const accountId = useMyAccountId();
  const previousStatusRef = useRef(status);

  const handleStatusChanged = useEffectEvent(() => {
    match(toTodoImportOutcome(todoImport))
      .with('completed', () => {
        trackEvent('todo_import_completed', {
          created_bucket: toTodoImportCountBucket(counts.created),
          skipped_duplicate: counts.skippedDuplicate,
          skipped_capacity: counts.skippedCapacity,
        });
        if (accountId != null) {
          trackAttributedFeatureSuccess({ accountId, feature: 'calendar_import' });
        }
      })
      .with('server_failed', 'abandoned', 'canceled', (reason) =>
        trackEvent('todo_import_failed', { reason }),
      )
      .with(null, () => undefined)
      .exhaustive();
  });

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;
    if (previousStatus !== status) {
      handleStatusChanged();
    }
  }, [status]);
}
