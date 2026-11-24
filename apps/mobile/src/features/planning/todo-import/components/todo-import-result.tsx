import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  DashedDivider,
  H3,
  HStack,
  Mascot,
  ScallopedContainer,
  Text,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { match } from 'ts-pattern';

import { TodoImportPolicy } from '../domains/todo-import.model';
import { useTodoImportId } from '../hooks/use-todo-import-id';
import { useGetTodoImportQueryOptions } from '../queries/todo-import.queries';
import { TodoImportUndoButton } from './todo-import-undo-button';

const MASCOT_SIZE = 120;

export function TodoImportResult() {
  const { t } = useTranslation(['todoImport', 'common']);
  const [importId] = useTodoImportId();
  const now = useMinuteNow();
  const { data: todoImport } = useSuspenseQuery(useGetTodoImportQueryOptions({ importId }));

  const { counts, status, firstDate } = todoImport;
  const canUndo = TodoImportPolicy.canUndo(todoImport, now);
  const title = match(status)
    .with('UNDOING', () => t('result.undoingTitle'))
    .with('UNDONE', () => t('result.undoneTitle', { count: counts.undone }))
    .otherwise(() =>
      counts.created === 0
        ? t('result.alreadyImportedTitle')
        : t('result.completedTitle', { count: counts.created }),
    );

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
        <WordWrapText size="b4" shade={6} className="px-5 pb-5">
          {canUndo ? t('result.undoNotice') : t('result.duplicateNotice')}
        </WordWrapText>
      </ScallopedContainer>

      <VStack gap={8}>
        <Button
          size="large"
          onPress={() =>
            router.navigate(
              firstDate == null ? '/feed' : { pathname: '/feed', params: { date: firstDate } },
            )
          }
        >
          {t('result.viewTodos')}
        </Button>
        <TodoImportUndoButton size="large" variant="weak">
          {t('result.undo')}
        </TodoImportUndoButton>
      </VStack>
    </VStack>
  );
}

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
      <WordWrapText size="b3" shade={8} className="flex-1">
        {label}
      </WordWrapText>
      <Text size="b3" weight="semibold" shade={9} className="tabular-nums">
        {count}
      </Text>
    </HStack>
  );
}
