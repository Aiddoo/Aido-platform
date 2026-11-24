import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { formatYearAwareDateLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { QueryErrorBoundary, SettingsListGroup } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { type ComponentProps, Suspense } from 'react';

import { TodoImportPolicy } from '../domains/todo-import.model';
import { useGetTodoImportQueryOptions } from '../queries/todo-import.queries';
import { lastTodoImportIdStoredValue } from '../schemas/todo-import-last-storage.schema';
import { toUnbreakableLabel } from '../utils/todo-import.view-model';

type LastTodoImportRowProps = Omit<ComponentProps<typeof SettingsListGroup>, 'children'>;

/** 결과 화면을 떠난 뒤 되돌리러 돌아오는 길. 되돌릴 수 있는 동안만 보이고 아니면 자리도 차지하지 않는다 */
export function LastTodoImportRow(props: LastTodoImportRowProps) {
  const accountId = useMyAccountId();
  const [lastImportId] = useStoredValue(lastTodoImportIdStoredValue, accountId);

  if (lastImportId == null) {
    return null;
  }

  return (
    <QueryErrorBoundary fallback={LastTodoImportRow.Error} resetKeys={[lastImportId]}>
      <Suspense fallback={<LastTodoImportRow.Loading {...props} />}>
        <LastTodoImportRow.Undoable importId={lastImportId} {...props} />
      </Suspense>
    </QueryErrorBoundary>
  );
}

interface UndoableProps extends LastTodoImportRowProps {
  importId: string;
}

LastTodoImportRow.Undoable = function Undoable({ importId, ...props }: UndoableProps) {
  const { t } = useTranslation('todoImport');
  const now = useMinuteNow();
  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const push = useSingleTap(router.push);
  const { data: todoImport } = useSuspenseQuery(useGetTodoImportQueryOptions({ importId }));

  if (!TodoImportPolicy.canUndo(todoImport, now) || todoImport.undoableUntil == null) {
    return null;
  }

  return (
    <SettingsListGroup {...props}>
      <SettingsListGroup.Item
        label={t('lastImport.label')}
        description={t('lastImport.description', {
          count: todoImport.counts.created,
          date: toUnbreakableLabel(
            formatYearAwareDateLabel(todoImport.undoableUntil, todayKey, dateFormatContext),
          ),
        })}
        onPress={() => push({ pathname: '/todo-import/[importId]', params: { importId } })}
      />
    </SettingsListGroup>
  );
};

LastTodoImportRow.Loading = function Loading(props: LastTodoImportRowProps) {
  return (
    <SettingsListGroup {...props}>
      <SettingsListGroup.Item.Loading descriptionLines={1} />
    </SettingsListGroup>
  );
};

/** 지난 가져오기를 읽지 못해도 새로 가져오는 데는 지장이 없어 줄을 숨긴다 */
LastTodoImportRow.Error = function ErrorFallback() {
  return null;
};
