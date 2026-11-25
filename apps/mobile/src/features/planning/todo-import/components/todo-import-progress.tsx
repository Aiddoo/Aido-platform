import { useTodoImportUploadSession } from '@src/bootstrap/providers/di-context';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useOpenAppSettings } from '@src/shared/hooks/use-open-app-settings';
import { useTranslation } from '@src/shared/i18n';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import {
  Box,
  Button,
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
import { match } from 'ts-pattern';

import { useTodoImportId } from '../hooks/use-todo-import-id';
import { useCancelTodoImportMutationOptions } from '../queries/todo-import.mutations';
import { useGetTodoImportQueryOptions } from '../queries/todo-import.queries';
import { todoImportSessionStoredValue } from '../schemas/todo-import-session-storage.schema';
import { type StageStatus, toProgressView } from '../utils/todo-import-progress.view-model';
import { TodoImportFailureAlert } from './todo-import-failure-alert';

// 막대의 접근성 값이 백분율로 읽히게 0~100으로 그린다
const METER_MAX_PERCENT = 100;

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
  const cancelImport = useMutation(useCancelTodoImportMutationOptions({ importId, accountId }));
  const appSettings = useOpenAppSettings();

  const view = toProgressView(todoImport, snapshot, {
    hasStoredSession: storedSession?.importId === todoImport.id,
    isOnline,
  });

  const handleRetryPress = () => {
    if (accountId != null) {
      uploadSession.resume({ accountId, untitledTitle: t('untitledEvent') });
    }
  };

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

      <TodoImportProgress.Meter ratio={view.ratio} />

      <TodoImportFailureAlert />
      {!isOnline && <InlineAlert status="warning" title={t('progress.offline')} />}
      {view.pauseReason === 'interrupted' && (
        <InlineAlert
          status="warning"
          title={t('progress.paused')}
          action={
            <Button size="small" variant="weak" display="inline" onPress={handleRetryPress}>
              {t('common:actions.retry')}
            </Button>
          }
        />
      )}
      {/* 권한이 꺼진 채 다시 시도하면 같은 자리에서 멈추므로 설정으로 보낸다. 켜고 돌아오면 앱이 이어 간다 */}
      {view.pauseReason === 'permission' && (
        <InlineAlert
          status="warning"
          title={t('progress.pausedPermission')}
          // 설정 화면이 없는 기기(Mac)는 글로 가는 길만 보인다
          description={appSettings.canOpen ? undefined : t('permission.deniedDescriptionMac')}
          action={
            appSettings.canOpen ? (
              <Button size="small" variant="weak" display="inline" onPress={appSettings.open}>
                {t('permission.openSettings')}
              </Button>
            ) : undefined
          }
        />
      )}
      {view.isSentElsewhere && (
        <InlineAlert status="default" title={t('progress.notOnThisDevice')} />
      )}
      {view.canStop && (
        <TextButton
          size="medium"
          className="self-center"
          isDisabled={cancelImport.isPending}
          onPress={handleCancelPress}
        >
          {t('progress.cancel')}
        </TextButton>
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
      accessible
      accessibilityLabel={`${label}, ${t(STAGE_STATUS_LABEL_KEYS[status])}`}
      accessibilityLiveRegion="polite"
      left={
        // 스피너와 아이콘이 바뀌어도 글자가 옆으로 움직이지 않게 같은 칸에 둔다
        <HStack
          align="center"
          justify="center"
          style={{ width: indicatorSize, height: indicatorSize }}
        >
          {match(status)
            .with('done', () => (
              <HStack align="center" justify="center" className="size-full rounded-full bg-main">
                <CheckmarkIcon
                  width={fontScaledSize(STAGE_ICON_SIZE)}
                  height={fontScaledSize(STAGE_ICON_SIZE)}
                  colorClassName="text-white dark:text-gray-9"
                />
              </HStack>
            ))
            .with('active', () => <Spinner size="sm" />)
            .with('pending', () => (
              <Box className="size-full rounded-full border-2 border-gray-3" />
            ))
            .exhaustive()}
        </HStack>
      }
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

interface ProgressMeterProps {
  // 0~1
  ratio: number;
}

// 진행 화면과 새 기능 소개 데모가 같은 막대를 쓴다
TodoImportProgress.Meter = function ProgressMeter({ ratio }: ProgressMeterProps) {
  return (
    <Meter value={Math.round(ratio * METER_MAX_PERCENT)} max={METER_MAX_PERCENT} size="medium" />
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
