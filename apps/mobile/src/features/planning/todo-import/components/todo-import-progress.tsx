import { useTodoImportUploadSession } from '@src/bootstrap/providers/di-context';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useTranslation } from '@src/shared/i18n';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import {
  Box,
  CheckmarkIcon,
  HStack,
  InlineAlert,
  ListRow,
  Meter,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Text,
  TextButton,
  TextSkeleton,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton, Spinner } from 'heroui-native';
import { useSyncExternalStore } from 'react';
import { match, P } from 'ts-pattern';

import { type TodoImport, TodoImportPolicy } from '../domains/todo-import.model';
import { useTodoImportId } from '../hooks/use-todo-import-id';
import { useCancelTodoImportMutationOptions } from '../queries/todo-import.mutations';
import { useGetTodoImportQueryOptions } from '../queries/todo-import.queries';
import { todoImportSessionStoredValue } from '../schemas/todo-import-session-storage.schema';
import type { TodoImportUploadSnapshot } from '../services/todo-import-upload.session';
import { TodoImportFailureAlert } from './todo-import-failure-alert';

type StageStatus = 'pending' | 'active' | 'done';

interface ProgressView {
  read: StageStatus;
  upload: StageStatus;
  create: StageStatus;
  ratio: number;
  isQueued: boolean;
  isPaused: boolean;
  /** 업로드 중인데 이 기기가 보내고 있지도, 이어 보낼 상태를 갖고 있지도 않다(다른 기기에서 시작했다) */
  isSentElsewhere: boolean;
}

/** 막대의 접근성 값이 백분율로 읽히게 0~100으로 그린다 */
const METER_MAX = 100;

const STAGE_ICON_SIZE = 12;

const STAGE_STATUS_LABEL_KEYS = {
  pending: 'progress.stageStatus.pending',
  active: 'progress.stageStatus.active',
  done: 'progress.stageStatus.done',
} as const satisfies Record<StageStatus, string>;

/** 앱을 나가도 서버가 마저 만들고, 연결이 끊기면 멈췄다 이어 간다 */
export function TodoImportProgress() {
  const { t } = useTranslation(['todoImport', 'common']);
  const [importId] = useTodoImportId();
  const uploadSession = useTodoImportUploadSession();
  const accountId = useMyAccountId();
  const confirmDialog = useConfirmDialog();
  const { data: todoImport } = useSuspenseQuery(useGetTodoImportQueryOptions({ importId }));
  const snapshot = useSyncExternalStore(uploadSession.subscribe, uploadSession.getSnapshot);
  const [storedSession] = useStoredValue(todoImportSessionStoredValue, accountId);
  const isOnline = useIsOnline();
  const cancelImport = useMutation(useCancelTodoImportMutationOptions({ importId }));

  // 꺼진 채 다시 연 앱은 기기 상태가 아직 비어 있어도, 저장해 둔 업로드가 같으면 이 기기의 가져오기다
  const view = toProgressView(todoImport, snapshot, {
    hasStoredSession: storedSession?.importId === todoImport.id,
  });

  const handleCancelPress = () =>
    confirmDialog.openAsync({
      title: t('progress.cancelConfirmTitle'),
      description: t('progress.cancelConfirmDescription'),
      confirmLabel: t('progress.cancel'),
      confirmColor: 'danger',
      cancelLabel: t('common:actions.cancel'),
      onConfirm: () => cancelImport.mutateAsync(),
    });

  return (
    <VStack gap={20}>
      <VStack gap={4}>
        <TodoImportProgress.Stage status={view.read} label={t('progress.reading')} />
        <TodoImportProgress.Stage status={view.upload} label={t('progress.uploading')} />
        <TodoImportProgress.Stage
          status={view.create}
          label={view.isQueued ? t('progress.queued') : t('progress.creating')}
        />
      </VStack>

      <Meter value={Math.round(view.ratio * METER_MAX)} max={METER_MAX} size="medium" />

      <TodoImportFailureAlert />
      {!isOnline && <InlineAlert status="warning" title={t('progress.offline')} />}
      {isOnline && view.isPaused && <InlineAlert status="warning" title={t('progress.paused')} />}
      {/* 오프라인이면 이 기기의 업로드도 아직 이어지지 않아 다른 기기로 오해하지 않게 숨긴다 */}
      {isOnline && view.isSentElsewhere && TodoImportPolicy.canCancel(todoImport) && (
        <VStack gap={8} align="center">
          <InlineAlert status="default" title={t('progress.notOnThisDevice')} />
          <TextButton size="medium" isDisabled={cancelImport.isPending} onPress={handleCancelPress}>
            {t('progress.cancel')}
          </TextButton>
        </VStack>
      )}
    </VStack>
  );
}

interface StageProps {
  status: StageStatus;
  label: string;
}

TodoImportProgress.Stage = function Stage({ status, label }: StageProps) {
  const { t } = useTranslation('todoImport');
  const fontScaledSize = useFontScaledSize();
  const indicatorSize = fontScaledSize(20);

  return (
    <ListRow
      verticalPadding="small"
      accessibilityLabel={`${label}, ${t(STAGE_STATUS_LABEL_KEYS[status])}`}
      left={match(status)
        .with('done', () => (
          <HStack
            align="center"
            justify="center"
            className="rounded-full bg-main"
            style={{ width: indicatorSize, height: indicatorSize }}
          >
            <CheckmarkIcon
              width={fontScaledSize(STAGE_ICON_SIZE)}
              height={fontScaledSize(STAGE_ICON_SIZE)}
              colorClassName="text-white dark:text-gray-9"
            />
          </HStack>
        ))
        .with('active', () => <Spinner size="sm" />)
        .with('pending', () => (
          <Box
            className="rounded-full border-2 border-gray-3"
            style={{ width: indicatorSize, height: indicatorSize }}
          />
        ))
        .exhaustive()}
      contents={
        <Text
          size="b2"
          weight={status === 'active' ? 'semibold' : 'normal'}
          shade={status === 'pending' ? 5 : 8}
          className={cn(status === 'active' && 'tabular-nums')}
        >
          {label}
        </Text>
      }
    />
  );
};

TodoImportProgress.Loading = function Loading() {
  return (
    <VStack gap={20}>
      <VStack gap={4}>
        <ListRow
          verticalPadding="small"
          left={<Skeleton className="size-5 rounded-full" />}
          contents={<TextSkeleton size="b2" className="w-32" />}
        />
        <ListRow
          verticalPadding="small"
          left={<Skeleton className="size-5 rounded-full" />}
          contents={<TextSkeleton size="b2" className="w-40" />}
        />
        <ListRow
          verticalPadding="small"
          left={<Skeleton className="size-5 rounded-full" />}
          contents={<TextSkeleton size="b2" className="w-28" />}
        />
      </VStack>
      <Skeleton className="h-2 w-full rounded-full" />
    </VStack>
  );
};

TodoImportProgress.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return <QueryErrorFallback reset={reset} />;
};

function toProgressView(
  todoImport: TodoImport,
  snapshot: TodoImportUploadSnapshot,
  { hasStoredSession }: { hasStoredSession: boolean },
): ProgressView {
  // 시작 직후(아직 가져오기 id를 모르는 순간)도 이 기기가 보내는 중이다
  const isThisImport =
    snapshot.stage === 'starting' ||
    ('importId' in snapshot && snapshot.importId === todoImport.id);
  const localSnapshot: TodoImportUploadSnapshot = isThisImport ? snapshot : { stage: 'idle' };
  const base = {
    isQueued: false,
    isPaused: localSnapshot.stage === 'paused',
    isSentElsewhere: localSnapshot.stage === 'idle' && !hasStoredSession,
  };

  return match(todoImport.status)
    .with('UPLOADING', () =>
      match(localSnapshot)
        .returnType<ProgressView>()
        .with({ stage: 'uploading' }, ({ uploadedChunkCount, chunkCount }) => ({
          ...base,
          read: 'done',
          upload: 'active',
          create: 'pending',
          ratio: chunkCount === 0 ? 0 : uploadedChunkCount / chunkCount,
        }))
        .with({ stage: 'committing' }, () => ({
          ...base,
          read: 'done',
          upload: 'done',
          create: 'active',
          ratio: 1,
        }))
        .with({ stage: P.union('idle', 'starting', 'reading', 'paused', 'failed') }, () => ({
          ...base,
          read: 'active',
          upload: 'pending',
          create: 'pending',
          ratio: 0,
        }))
        .exhaustive(),
    )
    .with(P.union('QUEUED', 'RUNNING', 'UNDOING'), (status) => ({
      ...base,
      read: 'done' as const,
      upload: 'done' as const,
      create: 'active' as const,
      ratio: TodoImportPolicy.calculateProcessedRatio(todoImport),
      isQueued: status === 'QUEUED',
    }))
    .with(P.union('COMPLETED', 'FAILED', 'CANCELED', 'ABANDONED', 'UNDONE'), () => ({
      ...base,
      read: 'done' as const,
      upload: 'done' as const,
      create: 'done' as const,
      ratio: 1,
    }))
    .exhaustive();
}
