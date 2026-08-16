import { TODO_COMMENT_SORT } from '@aido/validators';
import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { ArrowRightIcon, HStack, Text } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Menu, type MenuKey, PressableFeedback, Spinner } from 'heroui-native';
import { useState } from 'react';

import type { TodoCommentSort } from '../../models/todo-comment.model';
import { useCommentSort } from '../hooks/use-comment-sort';
import { useThreadParentId } from '../hooks/use-thread-parent-id';
import { useTodoCommentsQueryOptions } from '../queries/use-todo-comment-query-options';

/**
 * 정렬 바. 바꾸기 전에 대상 정렬을 먼저 받아두고 URL을 바꾼다 —
 * 키가 바뀌는 순간 캐시가 이미 차 있어 목록이 폴백으로 깜빡이지 않는다.
 */
export function CommentSortBar() {
  const { t } = useTranslation('todoComment');
  const { todoId } = useTodoScreenParams();
  const parentId = useThreadParentId();
  const [sort, setSort] = useCommentSort();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const [isSwitching, setIsSwitching] = useState(false);

  // 정렬은 지금 보고 있는 목록에만 적용된다 — 상세면 최상위, 스레드면 그 댓글의 답글.
  const commentsOptionsBySort = {
    [TODO_COMMENT_SORT.POPULAR]: useTodoCommentsQueryOptions(
      todoId,
      parentId,
      TODO_COMMENT_SORT.POPULAR,
    ),
    [TODO_COMMENT_SORT.LATEST]: useTodoCommentsQueryOptions(
      todoId,
      parentId,
      TODO_COMMENT_SORT.LATEST,
    ),
  };

  const switchSort = async (next: TodoCommentSort) => {
    if (next === sort || isSwitching) {
      return;
    }

    setIsSwitching(true);

    try {
      // 캐시가 신선하면 no-op. 실패하더라도 전환은 진행해 평소의 에러 경계로 흘려보낸다.
      await queryClient.prefetchInfiniteQuery(commentsOptionsBySort[next]);
    } finally {
      setIsSwitching(false);
      setSort(next);
      trackEvent('todo_comment_sorted', { todo_id: todoId, sort: next });
    }
  };

  const selectSort = (selectedKeys: Set<MenuKey>) => {
    const [selected] = selectedKeys;

    if (selected === TODO_COMMENT_SORT.POPULAR || selected === TODO_COMMENT_SORT.LATEST) {
      switchSort(selected);
    }
  };

  return (
    <Menu>
      <Menu.Trigger asChild>
        <PressableFeedback className="flex-row items-center gap-1 py-1 pr-3">
          <Text size="b2" weight="bold">
            {sort === TODO_COMMENT_SORT.POPULAR ? t('sort.popular') : t('sort.latest')}
          </Text>
          {isSwitching ? (
            <Spinner size="sm" />
          ) : (
            <HStack className="rotate-90">
              <ArrowRightIcon width={15} height={15} colorClassName="text-gray-6" />
            </HStack>
          )}
        </PressableFeedback>
      </Menu.Trigger>
      <Menu.Portal disableFullWindowOverlay={false}>
        <Menu.Overlay />
        <Menu.Content
          presentation="popover"
          placement="bottom"
          align="start"
          width={208}
          className="rounded-2xl border border-gray-2 bg-gray-1"
        >
          <Menu.Group
            selectionMode="single"
            selectedKeys={new Set([sort])}
            onSelectionChange={selectSort}
            shouldCloseOnSelect
          >
            <Menu.Item id={TODO_COMMENT_SORT.LATEST}>
              <Menu.ItemIndicator />
              <Menu.ItemTitle>{t('sort.latest')}</Menu.ItemTitle>
            </Menu.Item>
            <Menu.Item id={TODO_COMMENT_SORT.POPULAR}>
              <Menu.ItemIndicator />
              <Menu.ItemTitle>{t('sort.popular')}</Menu.ItemTitle>
            </Menu.Item>
          </Menu.Group>
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}
