import { useGetTodoDetailsQueryOptions } from '@src/features/todo/queries/get-todo-details-query-options';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { blockUserConfirmHref, todoReportSheetHref } from '../utils/navigation/moderation-href';

/**
 * 친구 할 일 상세의 신고·차단. 내 할 일이거나 상세를 아직 못 불러왔으면 쓸 수 없다.
 * 할 일 상세 캐시를 함께 읽어 주인 이름을 차단 확인 문구에 넣는다.
 */
export function useTodoModerationActions({ todoId }: { todoId: number }) {
  const { t } = useTranslation('moderation');
  const push = useSingleTap(router.push);
  const { data: detail } = useQuery(useGetTodoDetailsQueryOptions({ todoId }));

  if (detail == null || detail.permissions.canEdit) {
    return { isAvailable: false, report: () => undefined, block: () => undefined } as const;
  }

  const owner = { userId: detail.owner.id, displayName: detail.owner.name ?? t('fallbackName') };
  return {
    isAvailable: true,
    report: () => push(todoReportSheetHref({ todoId })),
    block: () => push(blockUserConfirmHref(owner)),
  } as const;
}
