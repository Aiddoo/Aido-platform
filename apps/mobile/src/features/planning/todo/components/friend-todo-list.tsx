import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { CategoryHeaderPill } from '@src/features/planning/category/components/category-header-pill';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import type { QueryErrorFallbackProps } from '@src/shared/ui';
import {
  Box,
  ChatBubbleIcon,
  HStack,
  ICON_COUNT_BUTTON_ICON_SIZE,
  IconCountButton,
  QueryErrorFallback,
  Result,
  Text,
  TodoIllustration,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { groupBy, range } from 'es-toolkit';
import { type ComponentType, useState } from 'react';

import { SubTodoPolicy } from '../domains/sub-todo.model';
import { isFriendFeedUnavailableError } from '../domains/todo.error';
import type { Todo, TodoListResult } from '../domains/todo.model';
import { useFeedDateKey, useFeedFriendId } from '../hooks/use-feed-params';
import { useFeedSelectedTodoId } from '../hooks/use-feed-selected-todo-id';
import { useGetFriendTodosQueryOptions } from '../queries/todo.queries';
import { formatTodoTime } from '../utils/format-todo-time';
import { SubTodoIndent } from './sub-todo-indent';
import { TodoCheckbox, TodoLabel, TodoProgress, TodoRow } from './todo-row';

interface FriendTodoRowActionProps {
  todo: Todo;
  /** 보고 있는 피드 날짜 */
  dateKey: string;
}

interface FriendTodoListProps {
  /** 피드가 친구 목록에서 확인한 친구의 id. route 값은 더는 친구가 아닌 사람일 수 있어 그대로 읽지 않는다 */
  friendId: string;
  /** 할 일 줄 오른쪽에 붙는 행동(콕 등). 다시 마운트되지 않도록 모듈 수준 컴포넌트를 넘긴다 */
  rowAction: ComponentType<FriendTodoRowActionProps>;
  /** 친구에게 할 일이 없는 오늘 빈 화면에 붙는 행동(독촉 콕 등) */
  emptyAction: ComponentType;
}

export function FriendTodoList({ friendId, rowAction, emptyAction }: FriendTodoListProps) {
  // 행마다 route 훅을 부르면 URL이 바뀔 때마다 행 수만큼 params를 다시 파싱한다. 목록이 한 번 읽어 넘긴다
  const [dateKey] = useFeedDateKey();
  const [_selectedTodoId, openTodoDetail] = useFeedSelectedTodoId();
  const [{ data: categoryGroups }] = useSuspenseQueries({
    queries: [
      {
        ...useGetFriendTodosQueryOptions({ friendUserId: friendId, date: dateKey }),
        select: (result: TodoListResult) => groupFriendTodosByCategory(result.todos),
      },
      useGetPreferenceQueryOptions(),
    ],
  });

  if (categoryGroups.length === 0) {
    return <FriendTodoList.Empty action={emptyAction} />;
  }

  return (
    <Box gap={16}>
      {categoryGroups.map((group) => (
        <VStack key={group.category.id} gap={8}>
          <CategoryHeaderPill label={group.category.name} color={group.category.color} />
          <Box>
            {group.todos.map((todo) => (
              <FriendTodoList.Item
                key={todo.id}
                todo={todo}
                dateKey={dateKey}
                action={rowAction}
                onOpenDetail={openTodoDetail}
              />
            ))}
          </Box>
        </VStack>
      ))}
    </Box>
  );
}

FriendTodoList.Item = function Item({
  todo,
  dateKey,
  action: RowAction,
  onOpenDetail,
}: FriendTodoRowActionProps & {
  action: ComponentType<FriendTodoRowActionProps>;
  onOpenDetail: (todoId: number) => void;
}) {
  const { t } = useTranslation('todo');
  const selectTodo = useSingleTap(onOpenDetail);
  // 접거나 펴기 전에는 서브투두 유무를 따른다. 처음 값으로만 두면 나중에 생긴 서브투두가 접힌 채 남는다
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const isExpanded = userExpanded ?? SubTodoPolicy.hasSubTodos(todo.subTodos);
  const subTodoStats = SubTodoPolicy.getSubTodoStats(todo.subTodos);
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const formattedTime = formatTodoTime(todo, preference.timeFormat, dateFormatContext);
  const showDateTime = formattedTime != null;

  const openComments = () => selectTodo(todo.id);

  return (
    <TodoRow
      left={<TodoCheckbox isSelected={todo.completed} />}
      top={<TodoLabel isCompleted={todo.completed}>{todo.title}</TodoLabel>}
      middle={
        showDateTime && (
          <Text size="e1" shade={6}>
            {formattedTime}
          </Text>
        )
      }
      bottom={
        SubTodoPolicy.hasSubTodos(todo.subTodos) && (
          <TodoProgress value={subTodoStats.completed} total={subTodoStats.total} />
        )
      }
      right={
        <HStack gap={4} align="center">
          <IconCountButton
            className="min-h-0"
            icon={
              <ChatBubbleIcon
                width={ICON_COUNT_BUTTON_ICON_SIZE}
                height={ICON_COUNT_BUTTON_ICON_SIZE}
                colorClassName="text-gray-6"
              />
            }
            count={todo.commentCount}
            onPress={openComments}
            accessibilityRole="button"
            accessibilityLabel={t('detail.open')}
          />
          <RowAction todo={todo} dateKey={dateKey} />
        </HStack>
      }
      onPress={
        SubTodoPolicy.hasSubTodos(todo.subTodos) ? () => setUserExpanded(!isExpanded) : undefined
      }
    >
      {isExpanded && (
        <SubTodoIndent>
          {todo.subTodos.map((subTodo) => (
            <TodoRow
              key={subTodo.id}
              left={<TodoCheckbox isSelected={subTodo.completed} />}
              top={<TodoLabel isCompleted={subTodo.completed}>{subTodo.title}</TodoLabel>}
            />
          ))}
        </SubTodoIndent>
      )}
    </TodoRow>
  );
};

FriendTodoList.Loading = function Loading() {
  return (
    <VStack gap={8}>
      <CategoryHeaderPill.Loading />
      <Box>
        {range(3).map((index) => (
          <TodoRow.Loading key={index} />
        ))}
      </Box>
    </VStack>
  );
};

FriendTodoList.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todo', 'common']);
  const [_friendId, selectFriend] = useFeedFriendId();

  if (isFriendFeedUnavailableError(error)) {
    return (
      <HStack flex={1} justify="center" align="center">
        <Result
          testID="friend-feed-unavailable"
          icon={<TodoIllustration />}
          title={t('todo:friendTodo.unavailableTitle')}
          description={t('todo:friendTodo.unavailableDescription')}
          button={
            <Result.Button onPress={() => selectFriend(undefined)}>
              {t('todo:friendTodo.backToMyFeed')}
            </Result.Button>
          }
        />
      </HStack>
    );
  }

  return (
    <HStack flex={1} justify="center" align="center">
      <QueryErrorFallback title={t('todo:list.loadError')} reset={reset} />
    </HStack>
  );
};

FriendTodoList.Empty = function Empty({ action: EmptyAction }: { action: ComponentType }) {
  const { t } = useTranslation('todo');
  const [selectedDateKey] = useFeedDateKey();
  const isToday = selectedDateKey === useTodayKey();

  return (
    <HStack flex={1} justify="center" align="center">
      <Result
        icon={<TodoIllustration />}
        title={t('friendTodo.emptyTitle')}
        description={isToday ? t('friendTodo.emptyDescription') : undefined}
        button={isToday ? <EmptyAction /> : undefined}
      />
    </HStack>
  );
};

function groupFriendTodosByCategory(todos: readonly Todo[]) {
  return Object.values(groupBy(todos, (todo) => todo.category.id)).flatMap((items) => {
    const first = items[0];
    return first ? [{ category: first.category, todos: items }] : [];
  });
}
