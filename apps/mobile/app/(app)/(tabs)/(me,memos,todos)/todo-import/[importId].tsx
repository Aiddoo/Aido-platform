import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { TodoImportFailureAlert } from '@src/features/planning/todo-import/components/todo-import-failure-alert';
import { TodoImportProgress } from '@src/features/planning/todo-import/components/todo-import-progress';
import { TodoImportResult } from '@src/features/planning/todo-import/components/todo-import-result';
import type { TodoImport } from '@src/features/planning/todo-import/domains/todo-import.model';
import { useTodoImportId } from '@src/features/planning/todo-import/hooks/use-todo-import-id';
import { useGetTodoImportQueryOptions } from '@src/features/planning/todo-import/queries/todo-import.queries';
import { todoImportParamsSchema } from '@src/features/planning/todo-import/schemas/todo-import-params.schema';
import { toTodoImportCountBucket } from '@src/features/planning/todo-import/utils/todo-import-analytics';
import { useTrack } from '@src/shared/analytics';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  ErrorIllustration,
  QueryErrorBoundary,
  ReadableContent,
  Result,
  SafeAreaScrollView,
  Spacing,
  WordWrapText,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
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
        <QueryErrorBoundary fallback={TodoImportProgress.Error} resetKeys={[importId]}>
          <Suspense fallback={<TodoImportProgress.Loading />}>
            <TodoImportStatus />
          </Suspense>
        </QueryErrorBoundary>
      </ReadableContent>
    </SafeAreaScrollView>
  );
}

function TodoImportStatus() {
  const { t } = useTranslation('todoImport');
  const [importId] = useTodoImportId();
  const { data: todoImport } = useSuspenseQuery(useGetTodoImportQueryOptions({ importId }));

  useTrackImportOutcome(todoImport.status, todoImport.counts);

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
        <Result
          icon={<ErrorIllustration />}
          title={t('result.failedTitle')}
          description={t('result.failedDescription')}
          button={<StartAgainButton />}
        />
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

  return (
    <Button size="large" onPress={() => router.replace('/todo-import')}>
      {t('result.startAgain')}
    </Button>
  );
}

/** 이 화면에서 처리 중이던 가져오기가 끝나는 순간만 센다. 결과를 다시 열 때는 세지 않는다 */
function useTrackImportOutcome(status: TodoImport['status'], counts: TodoImport['counts']) {
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const accountId = useMyAccountId();
  const previousStatusRef = useRef(status);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;
    if (previousStatus === status) {
      return;
    }
    match(toImportOutcome(status))
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
  }, [status, counts, trackEvent, trackAttributedFeatureSuccess, accountId]);
}

function toImportOutcome(status: TodoImport['status']) {
  return match(status)
    .with('COMPLETED', () => 'completed' as const)
    .with('FAILED', () => 'server_failed' as const)
    .with('CANCELED', () => 'canceled' as const)
    .with('ABANDONED', () => 'abandoned' as const)
    .with(P.union('UPLOADING', 'QUEUED', 'RUNNING', 'UNDOING', 'UNDONE'), () => null)
    .exhaustive();
}
