import { useTodoImportUploadSession } from '@src/bootstrap/providers/di-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useTranslation } from '@src/shared/i18n';
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
import type { TodoImportUploadSnapshot } from '../services/todo-import-upload.session';

type StageStatus = 'pending' | 'active' | 'done';

interface ProgressView {
  read: StageStatus;
  upload: StageStatus;
  create: StageStatus;
  /** 막대가 보이는 단계의 진행(0~1) */
  ratio: number;
  uploadedChunkCount: number;
  chunkCount: number;
  isQueued: boolean;
  isPaused: boolean;
  /** 업로드 중인데 이 기기가 보내고 있지 않다(다른 기기에서 시작했거나 이 기기 상태가 지워졌다) */
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

/** 읽는 중 → 보내는 중(n/N) → 만드는 중. 앱을 나가도 서버가 마저 만들고, 연결이 끊기면 멈췄다 이어 간다 */
export function TodoImportProgress() {
  const { t } = useTranslation('todoImport');
  const [importId] = useTodoImportId();
  const uploadSession = useTodoImportUploadSession();
  const { data: todoImport } = useSuspenseQuery(useGetTodoImportQueryOptions({ importId }));
  const snapshot = useSyncExternalStore(uploadSession.subscribe, uploadSession.getSnapshot);
  const isOnline = useIsOnline();
  const cancelImport = useMutation(useCancelTodoImportMutationOptions({ importId }));

  const view = toProgressView(todoImport, snapshot);

  return (
    <VStack gap={20}>
      <VStack gap={4}>
        <TodoImportProgress.Stage status={view.read} label={t('progress.reading')} />
        <TodoImportProgress.Stage
          status={view.upload}
          label={
            view.chunkCount > 0
              ? t('progress.uploadingCount', {
                  current: view.uploadedChunkCount,
                  total: view.chunkCount,
                })
              : t('progress.uploading')
          }
        />
        <TodoImportProgress.Stage
          status={view.create}
          label={view.isQueued ? t('progress.queued') : t('progress.creating')}
        />
      </VStack>

      <Meter value={Math.round(view.ratio * METER_MAX)} max={METER_MAX} size="medium" />

      {!isOnline && <InlineAlert status="warning" title={t('progress.offline')} />}
      {isOnline && view.isPaused && <InlineAlert status="warning" title={t('progress.paused')} />}
      {view.isSentElsewhere && TodoImportPolicy.canCancel(todoImport) && (
        <VStack gap={8} align="center">
          <InlineAlert status="default" title={t('progress.notOnThisDevice')} />
          <TextButton
            size="medium"
            isDisabled={cancelImport.isPending}
            onPress={() => cancelImport.mutate()}
          >
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
        .with('active', () => <Spinner size="sm" color="accent" />)
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

/** 이 기기가 보내는 단계와 서버 잡 상태를 단계 셋으로 합친다 */
function toProgressView(todoImport: TodoImport, snapshot: TodoImportUploadSnapshot): ProgressView {
  // 시작 직후(아직 가져오기 id를 모르는 순간)도 이 기기가 보내는 중이다
  const isThisImport =
    snapshot.stage === 'starting' ||
    ('importId' in snapshot && snapshot.importId === todoImport.id);
  const localSnapshot: TodoImportUploadSnapshot = isThisImport ? snapshot : { stage: 'idle' };
  const base = {
    uploadedChunkCount: 0,
    chunkCount: 0,
    isQueued: false,
    isPaused: localSnapshot.stage === 'paused',
    isSentElsewhere: localSnapshot.stage === 'idle',
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
          uploadedChunkCount,
          chunkCount,
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
