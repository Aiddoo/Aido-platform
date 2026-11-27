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
import type { ComponentProps } from 'react';

import {
  type TodoImportFeedEntry,
  TodoImportFeedEntryPolicy,
} from '../domains/todo-import-feed-entry.model';
import { useGetCalendarPermissionQueryOptions } from '../queries/todo-import-source.queries';
import { todoImportFeedEntryDismissedStoredValue } from '../schemas/todo-import-feed-entry-storage.schema';

const ICON_SIZE = 24;

type TodoImportEntryNoticeProps = Pick<ComponentProps<typeof InlineAlert>, 'className' | 'testID'>;

/** 할 일이 하나도 없는 계정에 캘린더 일정 가져오기를 권한다. 닫으면 그 계정에서 다시 띄우지 않는다 */
export function TodoImportEntryNotice(props: TodoImportEntryNoticeProps) {
  const { t } = useTranslation('todoImport');
  const router = useRouter();
  const todayKey = useTodayKey();
  const fontScaledSize = useFontScaledSize();
  const { trackEvent } = useTrack();
  // 오늘 목록은 피드 목록과 같은 키라 요청이 늘지 않는다
  const [{ data: accountId }, { data: permission }, { data: hasTodayTodo }] = useSuspenseQueries({
    queries: [
      { ...useGetMeQueryOptions(), select: selectAccountId },
      useGetCalendarPermissionQueryOptions(),
      { ...useGetTodosByDateQueryOptions({ date: todayKey }), select: selectHasListedTodo },
    ],
  });
  const [dismissed, setDismissed] = useStoredValue(
    todoImportFeedEntryDismissedStoredValue,
    accountId,
  );
  const entry: TodoImportFeedEntry = {
    isDismissed: dismissed != null,
    calendarAccess: getOsPermissionAccess(permission),
  };
  // 오늘 할 일이 보이면 이미 할 일이 있는 계정이라 서버의 할 일 기록을 묻지 않는다
  const { data: hasTodoRecord } = useQuery({
    ...useGetTodoOverviewQueryOptions(),
    select: selectHasTodo,
    enabled: TodoImportFeedEntryPolicy.canOffer(entry) && !hasTodayTodo,
  });

  // 기록을 읽는 동안·읽지 못했으면 자리를 잡지 않는다
  const isVisible =
    hasTodoRecord != null &&
    TodoImportFeedEntryPolicy.shouldShow(entry, hasTodayTodo || hasTodoRecord);

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
    setDismissed('dismissed');
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
