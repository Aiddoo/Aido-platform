import {
  selectAccountId,
  useGetMeQueryOptions,
} from '@src/features/identity/user/queries/user.queries';
import {
  selectHasListedTodo,
  selectHasTodo,
  useGetTodoOverviewQueryOptions,
  useGetTodosByDateQueryOptions,
} from '@src/features/planning/todo/queries/todo.queries';
import { useTrack, useTrackView } from '@src/shared/analytics';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { CalendarImportDuoIcon, InlineAlert } from '@src/shared/ui';
import { getOsPermissionAccess } from '@src/shared/utils/get-os-permission-access';
import { useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { type ComponentProps, useEffect } from 'react';

import {
  type TodoImportFeedEntry,
  TodoImportFeedEntryPolicy,
} from '../domains/todo-import-feed-entry.model';
import { useGetCalendarPermissionQueryOptions } from '../queries/todo-import-source.queries';
import { todoImportFeedEntryStoredValue } from '../schemas/todo-import-feed-entry-storage.schema';

const ICON_SIZE = 24;

type TodoImportEntryNoticeProps = Pick<ComponentProps<typeof InlineAlert>, 'className' | 'testID'>;

/** 할 일이 하나도 없는 계정에 캘린더 일정 가져오기를 권한다. 닫거나 할 일이 있다고 확인되면 그 계정에서 다시 띄우지 않는다 */
export function TodoImportEntryNotice(props: TodoImportEntryNoticeProps) {
  const { t } = useTranslation('todoImport');
  const router = useRouter();
  const todayKey = useTodayKey();
  const fontScaledSize = useFontScaledSize();
  const { trackEvent } = useTrack();
  // 오늘 목록 키는 내 피드가 이미 읽는다(오늘을 보면 할 일 목록이, 다른 날을 보면 알림 꺼짐 안내가 읽는다)
  const [{ data: accountId }, { data: permission }, { data: hasTodayTodo }] = useSuspenseQueries({
    queries: [
      { ...useGetMeQueryOptions(), select: selectAccountId },
      useGetCalendarPermissionQueryOptions(),
      { ...useGetTodosByDateQueryOptions({ date: todayKey }), select: selectHasListedTodo },
    ],
  });
  const [closedReason, setClosedReason] = useStoredValue(todoImportFeedEntryStoredValue, accountId);
  // 서버 기록을 물을지는 기록 없이 정해진다
  const entryBeforeRecord: TodoImportFeedEntry = {
    closedReason,
    calendarAccess: getOsPermissionAccess(permission),
    hasTodayTodo,
    hasTodoRecord: null,
  };
  const { data: hasTodoRecord } = useQuery({
    ...useGetTodoOverviewQueryOptions(),
    select: selectHasTodo,
    enabled: TodoImportFeedEntryPolicy.shouldAskTodoRecord(entryBeforeRecord),
  });

  const entry: TodoImportFeedEntry = { ...entryBeforeRecord, hasTodoRecord: hasTodoRecord ?? null };
  // 기록을 읽는 동안·읽지 못했으면 자리를 잡지 않는다
  const isVisible = TodoImportFeedEntryPolicy.shouldShow(entry);
  const shouldRememberHasTodo = TodoImportFeedEntryPolicy.shouldRememberHasTodo(entry);

  // 서버 답을 기기 저장소에 남겨 할 일이 있는 계정은 피드를 다시 열어도 할 일 기록을 묻지 않는다
  useEffect(() => {
    if (shouldRememberHasTodo) {
      setClosedReason('hasTodo');
    }
  }, [shouldRememberHasTodo, setClosedReason]);

  useTrackView(
    'todo_import_entry_shown',
    isVisible ? { key: 'feed_card', params: { source: 'feed_card' } } : null,
  );

  // 진행 중인 가져오기가 있으면 가져오기 화면이 진행 화면으로 보낸다
  const handleOpenPress = useSingleTap(() => {
    trackEvent('todo_import_entry_tapped', { source: 'feed_card' });
    router.push('/todo-import');
  });

  if (!isVisible) {
    return null;
  }

  const dismiss = () => {
    trackEvent('todo_import_entry_dismissed', { source: 'feed_card' });
    setClosedReason('dismissed');
  };

  return (
    <InlineAlert
      image={
        <CalendarImportDuoIcon
          width={fontScaledSize(ICON_SIZE)}
          height={fontScaledSize(ICON_SIZE)}
          colorClassName="text-main"
        />
      }
      title={t('entry.feedTitle')}
      description={t('entry.feedDescription')}
      onPress={handleOpenPress}
      pressLabel={t('entry.feedOpenLabel')}
      onClose={dismiss}
      closeLabel={t('entry.feedDismissLabel')}
      {...props}
    />
  );
}
