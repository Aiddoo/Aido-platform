import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import { dismissToTab } from '@src/shared/navigation/open-entry-href';
import {
  Box,
  Button,
  DashedDivider,
  H3,
  HStack,
  Mascot,
  ScallopedContainer,
  Spacing,
  Text,
  TextSkeleton,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { match } from 'ts-pattern';

import { TodoImportPolicy } from '../domains/todo-import.model';
import { useTodoImportId } from '../hooks/use-todo-import-id';
import { useUndoTodoImportMutationOptions } from '../queries/todo-import.mutations';
import { useGetTodoImportQueryOptions } from '../queries/todo-import.queries';

const MASCOT_SIZE = 120;

/** 만든 수와 건너뛴 이유를 영수증으로 보이고, 7일 안이면 한 번에 되돌릴 수 있다고 알린다 */
export function TodoImportResult() {
  const { t } = useTranslation(['todoImport', 'common']);
  const [importId] = useTodoImportId();
  const now = useMinuteNow();
  const confirmDialog = useConfirmDialog();
  const { data: todoImport } = useSuspenseQuery(useGetTodoImportQueryOptions({ importId }));
  const undo = useMutation(useUndoTodoImportMutationOptions({ importId }));

  const { counts, status, firstDate } = todoImport;
  const canUndo = TodoImportPolicy.canUndo(todoImport, now);
  const title = match(status)
    .with('UNDOING', () => t('result.undoingTitle'))
    .with('UNDONE', () => t('result.undoneTitle', { count: counts.undone }))
    .otherwise(() => t('result.completedTitle', { count: counts.created }));

  const handleUndoPress = () =>
    confirmDialog.openAsync({
      title: t('result.undoConfirmTitle'),
      description: t('result.undoConfirmDescription'),
      confirmLabel: t('result.undo'),
      confirmColor: 'danger',
      cancelLabel: t('common:actions.cancel'),
      onConfirm: () => undo.mutateAsync(),
    });

  return (
    <VStack gap={20}>
      <VStack align="center" gap={12}>
        <Mascot name="catHi" size={MASCOT_SIZE} isCentered accessibilityElementsHidden />
        <H3 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
          {title}
        </H3>
      </VStack>

      <ScallopedContainer>
        <VStack className="gap-1 px-5 pt-5">
          <Count label={t('result.counts.created')} count={counts.created} isShownWhenZero />
          <Count label={t('result.counts.skippedDuplicate')} count={counts.skippedDuplicate} />
          <Count label={t('result.counts.skippedCapacity')} count={counts.skippedCapacity} />
          <Count
            label={t('result.counts.skippedCategoryMissing')}
            count={counts.skippedCategoryMissing}
          />
          <Count label={t('result.counts.skippedInvalid')} count={counts.skippedInvalid} />
        </VStack>
        {status === 'UNDONE' && (
          <>
            <DashedDivider className="mx-5 my-4" />
            <VStack className="gap-1 px-5">
              <Count label={t('result.counts.undone')} count={counts.undone} />
              <Count label={t('result.counts.keptCompleted')} count={counts.keptCompleted} />
            </VStack>
          </>
        )}
        <DashedDivider className="mx-5 my-4" />
        <Text size="b4" shade={6} className="px-5 pb-5" lineBreakStrategyIOS="hangul-word">
          {canUndo ? t('result.undoNotice') : t('result.duplicateNotice')}
        </Text>
      </ScallopedContainer>

      <VStack gap={8}>
        <Button
          size="large"
          onPress={() =>
            dismissToTab(
              firstDate == null ? '/feed' : { pathname: '/feed', params: { date: firstDate } },
            )
          }
        >
          {t('result.viewTodos')}
        </Button>
        {canUndo && (
          <Button size="large" variant="weak" isLoading={undo.isPending} onPress={handleUndoPress}>
            {t('result.undo')}
          </Button>
        )}
      </VStack>
    </VStack>
  );
}

TodoImportResult.Loading = function Loading() {
  return (
    <VStack gap={20}>
      <VStack align="center" gap={12}>
        <Skeleton className="rounded-full" style={{ width: MASCOT_SIZE, height: MASCOT_SIZE }} />
        <TextSkeleton size="t1" className="w-48" />
      </VStack>
      <ScallopedContainer>
        <Box className="p-5">
          <TextSkeleton size="b3" className="w-40" />
          <Spacing size={8} />
          <TextSkeleton size="b3" className="w-36" />
        </Box>
      </ScallopedContainer>
    </VStack>
  );
};

interface CountProps {
  label: string;
  count: number;
  /** 만든 수는 0이어도 보인다. 건너뛴 이유는 있을 때만 보인다 */
  isShownWhenZero?: boolean;
}

function Count({ label, count, isShownWhenZero = false }: CountProps) {
  if (count === 0 && !isShownWhenZero) {
    return null;
  }

  return (
    <HStack align="center" justify="between" gap={12} className="py-1">
      <Text size="b3" shade={8} className="flex-1" lineBreakStrategyIOS="hangul-word">
        {label}
      </Text>
      <Text size="b3" weight="semibold" shade={9} className="tabular-nums">
        {count}
      </Text>
    </HStack>
  );
}
