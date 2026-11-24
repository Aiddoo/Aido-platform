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
import { type ComponentProps, Suspense, useEffect, useEffectEvent } from 'react';

import { TodoImportPolicy } from '../domains/todo-import.model';
import { useGetTodoImportQueryOptions } from '../queries/todo-import.queries';
import { lastTodoImportIdStoredValue } from '../schemas/todo-import-last-storage.schema';
import { toUnbreakableLabel } from '../utils/todo-import.view-model';

type LastTodoImportRowProps = Omit<ComponentProps<typeof SettingsListGroup>, 'children'>;

/** 결과 화면을 떠난 뒤 되돌리러 돌아오는 길. 되돌릴 수 있는 동안만 보이고 아니면 자리도 차지하지 않는다 */
export function LastTodoImportRow(props: LastTodoImportRowProps) {
  const accountId = useMyAccountId();
  const [lastImportId, setLastImportId] = useStoredValue(lastTodoImportIdStoredValue, accountId);

  if (lastImportId == null) {
    return null;
  }

  return (
    <QueryErrorBoundary fallback={LastTodoImportRow.Error} resetKeys={[lastImportId]}>
      {/* 기한이 지난 가져오기는 줄이 그려지지 않아, 스켈레톤을 보였다 걷으면 아래 글이 들썩인다 */}
      <Suspense fallback={null}>
        <LastTodoImportRow.Undoable
          importId={lastImportId}
          onExpired={() => setLastImportId(null)}
          {...props}
        />
      </Suspense>
    </QueryErrorBoundary>
  );
}

interface UndoableProps extends LastTodoImportRowProps {
  importId: string;
  /** 끝났는데 되돌릴 수 없으면 부른다. 다음에 열 때 조회하지 않게 기억을 지운다 */
  onExpired: () => void;
}

LastTodoImportRow.Undoable = function Undoable({ importId, onExpired, ...props }: UndoableProps) {
  const { t } = useTranslation('todoImport');
  const now = useMinuteNow();
  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const push = useSingleTap(router.push);
  const { data: todoImport } = useSuspenseQuery(useGetTodoImportQueryOptions({ importId }));
  // 처리 중인 가져오기는 끝나는 것을 기다리는 조회가 같은 기억을 쓰므로 끝난 뒤에만 지운다
  const isExpired =
    TodoImportPolicy.isTerminal(todoImport) && !TodoImportPolicy.canUndo(todoImport, now);
  const forgetExpired = useEffectEvent(onExpired);

  useEffect(() => {
    if (isExpired) {
      forgetExpired();
    }
  }, [isExpired]);

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

/** 지난 가져오기를 읽지 못해도 새로 가져오는 데는 지장이 없어 줄을 숨긴다 */
LastTodoImportRow.Error = function ErrorFallback() {
  return null;
};
