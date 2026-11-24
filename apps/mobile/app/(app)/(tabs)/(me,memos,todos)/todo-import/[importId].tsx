import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { TodoImportFailureAlert } from '@src/features/planning/todo-import/components/todo-import-failure-alert';
import { TodoImportProgress } from '@src/features/planning/todo-import/components/todo-import-progress';
import { TodoImportResult } from '@src/features/planning/todo-import/components/todo-import-result';
import { TodoImportUndoButton } from '@src/features/planning/todo-import/components/todo-import-undo-button';
import { isTodoImportNotFoundError } from '@src/features/planning/todo-import/domains/todo-import.error';
import type { TodoImport } from '@src/features/planning/todo-import/domains/todo-import.model';
import { useTodoImportId } from '@src/features/planning/todo-import/hooks/use-todo-import-id';
import { useGetTodoImportQueryOptions } from '@src/features/planning/todo-import/queries/todo-import.queries';
import { todoImportParamsSchema } from '@src/features/planning/todo-import/schemas/todo-import-params.schema';
import { toTodoImportCountBucket } from '@src/features/planning/todo-import/utils/todo-import-analytics';
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
import { useSuspenseQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { Spinner } from 'heroui-native';
import { Suspense, useEffect, useRef } from 'react';
import { match, P } from 'ts-pattern';

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
            <TodoImportStatus />
          </Suspense>
        </QueryErrorBoundary>
      </ReadableContent>
    </SafeAreaScrollView>
  );
}

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
  const replace = useSingleTap(router.replace);

  if (!isTodoImportNotFoundError(error)) {
    return <TodoImportProgress.Error error={error} reset={reset} />;
  }

  return (
    <Result
      icon={<ErrorIllustration />}
      title={t('result.notFoundTitle')}
      description={t('result.notFoundDescription')}
      button={
        <Button size="large" onPress={() => replace('/todo-import')}>
          {t('result.startNew')}
        </Button>
      }
    />
  );
};

function TodoImportStatus() {
  const { t } = useTranslation('todoImport');
  const [importId] = useTodoImportId();
  const { data: todoImport } = useSuspenseQuery(useGetTodoImportQueryOptions({ importId }));

  useTrackImportOutcome(todoImport);

  return match(todoImport.status)
    .with(P.union('UPLOADING', 'QUEUED', 'RUNNING'), () => (
      <>
        <Stack.Screen options={{ title: t('titles.progress') }} />
        <TodoImportProgress />
        <Spacing size={16} />
        <WordWrapText size="b4" shade={6} align="center">
          {t('progress.leaveNotice')}
        </WordWrapText>
      </>
    ))
    .with(P.union('COMPLETED', 'UNDOING', 'UNDONE'), () => (
      <>
        <Stack.Screen options={{ title: t('titles.result') }} />
        <TodoImportResult />
      </>
    ))
    .with('FAILED', () => (
      <>
        <Stack.Screen options={{ title: t('titles.result') }} />
        {match(todoImport.failureReason)
          .with('UNDO_FAILED', () => (
            <Result
              icon={<ErrorIllustration />}
              title={t('result.undoFailedTitle')}
              description={t('result.undoFailedDescription')}
              button={
                <TodoImportUndoButton size="large">{t('result.undoAgain')}</TodoImportUndoButton>
              }
            />
          ))
          // 이유를 모르면(null) 만들다 멈춘 것과 같이 안내한다
          .with(P.union('MATERIALIZATION_FAILED', 'STALLED', null), () => (
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
          ))
          .exhaustive()}
      </>
    ))
    .with(P.union('CANCELED', 'ABANDONED'), () => (
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
}

function StartAgainButton() {
  const { t } = useTranslation('todoImport');
  const replace = useSingleTap(router.replace);

  return (
    <Button size="large" onPress={() => replace('/todo-import')}>
      {t('result.startAgain')}
    </Button>
  );
}

/** 이 화면에서 처리 중이던 가져오기가 끝나는 순간만 센다. 결과를 다시 열 때는 세지 않는다 */
function useTrackImportOutcome({ status, failureReason, counts }: TodoImport) {
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const accountId = useMyAccountId();
  const previousStatusRef = useRef(status);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;
    if (previousStatus === status) {
      return;
    }
    match(toImportOutcome(status, failureReason))
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
  }, [status, failureReason, counts, trackEvent, trackAttributedFeatureSuccess, accountId]);
}

function toImportOutcome(status: TodoImport['status'], failureReason: TodoImport['failureReason']) {
  return (
    match(status)
      .with('COMPLETED', () => 'completed' as const)
      // 되돌리기 실패는 가져오기 실패가 아니라 세지 않는다
      .with('FAILED', () => (failureReason === 'UNDO_FAILED' ? null : ('server_failed' as const)))
      .with('CANCELED', () => 'canceled' as const)
      .with('ABANDONED', () => 'abandoned' as const)
      .with(P.union('UPLOADING', 'QUEUED', 'RUNNING', 'UNDOING', 'UNDONE'), () => null)
      .exhaustive()
  );
}
