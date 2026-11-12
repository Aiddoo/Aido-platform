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
  usePaneSizeClass,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { groupBy, range } from 'es-toolkit';
import { Link } from 'expo-router';
import { type ReactNode, useState } from 'react';

import { SubTodoPolicy } from '../domains/sub-todo.model';
import { isFriendFeedUnavailableError } from '../domains/todo.error';
import type { Todo, TodoListResult } from '../domains/todo.model';
import { useFeedDateKey, useFeedFriendId } from '../hooks/use-feed-params';
import { useFeedSelectedTodoId } from '../hooks/use-feed-selected-todo-id';
import { useGetFriendTodosQueryOptions } from '../queries/todo.queries';
import { formatTodoTime } from '../utils/todo-time.view-model';
import { SubTodoIndent } from './sub-todo-indent';
import { TodoCheckbox, TodoLabel, TodoProgress, TodoRow } from './todo-row';

interface FriendTodoListProps {
  /** 피드가 친구 목록에서 확인한 친구의 id. route 값은 더는 친구가 아닌 사람일 수 있어 그대로 읽지 않는다 */
  friendId: string;
  /** 할 일 줄 오른쪽에 붙는 행동(콕 등). 친구·날짜 같은 화면 값은 부모가 한 번 읽어 담는다 */
  renderRowAction: (todo: Todo) => ReactNode;
  /** 친구에게 할 일이 없는 오늘 빈 화면에 붙는 행동(독촉 콕 등) */
  emptyAction: ReactNode;
}

export function FriendTodoList({ friendId, renderRowAction, emptyAction }: FriendTodoListProps) {
  // 행마다 route 훅을 부르면 URL이 바뀔 때마다 행 수만큼 params를 다시 파싱한다. 목록이 한 번 읽어 넘긴다
  const [dateKey] = useFeedDateKey();
  const [_selectedTodoId, openTodoDetail] = useFeedSelectedTodoId();
  const paneSizeClass = usePaneSizeClass();
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
                isLinked={paneSizeClass === 'compact'}
                renderAction={renderRowAction}
                onOpenDetail={openTodoDetail}
              />
            ))}
          </Box>
        </VStack>
      ))}
    </Box>
  );
}

interface FriendTodoListItemProps {
  todo: Todo;
  /** 접힌 화면에서만 Link다. 펼친 화면은 같은 화면의 칸을 바꿔 미리볼 상세 화면이 없다 */
  isLinked: boolean;
  renderAction: (todo: Todo) => ReactNode;
  onOpenDetail: (todoId: number) => void;
}

FriendTodoList.Item = function Item({
  todo,
  isLinked,
  renderAction,
  onOpenDetail,
}: FriendTodoListItemProps) {
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
  const hasSubTodos = SubTodoPolicy.hasSubTodos(todo.subTodos);

  return (
    <FriendTodoList.ItemLink
      todo={todo}
      isLinked={isLinked}
      isTapOpening={!hasSubTodos}
      onOpen={openComments}
    >
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
            {renderAction(todo)}
          </HStack>
        }
        onPress={hasSubTodos ? () => setUserExpanded(!isExpanded) : undefined}
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
    </FriendTodoList.ItemLink>
  );
};

interface FriendTodoListItemLinkProps {
  todo: Todo;
  isLinked: boolean;
  /** 하위 항목이 없는 행은 탭으로 상세를 연다. 하위 항목이 있으면 탭은 펼치기다 */
  isTapOpening: boolean;
  onOpen: () => void;
  children: ReactNode;
}

/** 친구 할 일 행을 길게 눌러 상세를 미리보고 메뉴로 연다(iOS). 미리보기를 눌러 가는 이동은 Link가 맡는다 */
FriendTodoList.ItemLink = function ItemLink({
  todo,
  isLinked,
  isTapOpening,
  onOpen,
  children,
}: FriendTodoListItemLinkProps) {
  const { t } = useTranslation('todo');

  if (!isLinked) {
    return children;
  }

  return (
    <Link
      href={{ pathname: '/todo/[todoId]', params: { todoId: todo.id } }}
      asChild
      onPress={(event) => {
        if (!isTapOpening) {
          event.preventDefault();
        }
      }}
    >
      <Link.Trigger>{children}</Link.Trigger>
      <Link.Preview />
      <Link.Menu>
        <Link.MenuAction icon="text.bubble" onPress={onOpen}>
          {t('detail.open')}
        </Link.MenuAction>
      </Link.Menu>
    </Link>
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

FriendTodoList.Empty = function Empty({ action }: { action: ReactNode }) {
  const { t } = useTranslation('todo');
  const [selectedDateKey] = useFeedDateKey();
  const isToday = selectedDateKey === useTodayKey();

  return (
    <HStack flex={1} justify="center" align="center">
      <Result
        icon={<TodoIllustration />}
        title={t('friendTodo.emptyTitle')}
        description={isToday ? t('friendTodo.emptyDescription') : undefined}
        button={isToday ? action : undefined}
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
