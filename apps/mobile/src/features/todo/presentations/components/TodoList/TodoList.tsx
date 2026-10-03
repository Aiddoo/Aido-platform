import { useGetPreferenceQueryOptions } from '@src/features/auth/presentations/queries/get-preference-query-options';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  PlusIcon,
  Result,
  Text,
  VStack,
  type QueryErrorFallbackProps,
  useOverlay,
  BottomSheet,
  ChatBubbleIcon,
  ICON_COUNT_BUTTON_ICON_SIZE,
  IconCountButton,
  LockIcon,
  MoreIcon,
} from '@src/shared/ui';
import { formatDate } from '@src/shared/utils/date';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import times from 'es-toolkit/compat/times';
import { router } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { Suspense, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { NestableDraggableFlatList, ScaleDecorator } from 'react-native-draggable-flatlist';
import { match } from 'ts-pattern';

import { useDraggableReorderList } from '../../hooks/use-draggable-reorder-list';
import { useFeedDate } from '../../hooks/use-feed-date';
import { useSubTodoActions } from '../../hooks/use-sub-todo-actions';
import { useTodoActions } from '../../hooks/use-todo-actions';
import { useGetTodoCategoriesQueryOptions } from '../../queries/get-todo-categories-query-options';
import { useGetTodosByDateQueryOptions } from '../../queries/get-todos-by-date-query-options';
import { useReorderTodoMutationOptions } from '../../queries/use-reorder-todo-mutation-options';
import { toTodoCategoryGroups } from '../../view-models/todo-category-group.view-model';
import { type TodoItemViewModel } from '../../view-models/todo-item.view-model';
import { AddSubTodoBottomSheet } from '../AddSubTodoBottomSheet';
import { AddTodoBottomSheet } from '../AddTodoBottomSheet';
import { CategorySelectBottomSheet } from '../CategorySelectBottomSheet';
import { ReorderCoachmark } from '../ReorderCoachmark';
import { SubTodoActionsBottomSheet } from '../SubTodoList/SubTodoActionsBottomSheet';
import { SubTodoList } from '../SubTodoList/SubTodoList';
import { TodoDatePickerContent } from '../TodoDatePickerContent';
import { TodoCheckbox, TodoLabel, TodoProgress, TodoRow } from '../TodoRow';
import { TodoTimePickerContent } from '../TodoTimePickerContent';
import { TodoActionsBottomSheet } from './TodoActionsBottomSheet';

export function TodoList() {
  const [selectedDate] = useFeedDate();
  const [{ data: preference }, { data: categoriesData }, { data: user }, { data: todosData }] =
    useSuspenseQueries({
      queries: [
        useGetPreferenceQueryOptions(),
        useGetTodoCategoriesQueryOptions(),
        useGetMeQueryOptions(),
        useGetTodosByDateQueryOptions(formatDate(selectedDate)),
      ],
    });
  const categoryGroups = toTodoCategoryGroups(
    todosData.todos,
    categoriesData.categories,
    preference.timeFormat,
  );
  const canReorderTodos = categoryGroups.some((group) => group.todos.length >= 2);

  return (
    <Box gap={16}>
      {canReorderTodos && <ReorderCoachmark accountId={user.id} kind="todo" />}
      {categoryGroups.map((group) => (
        <Box key={group.category.id} gap={8}>
          <CategoryHeader
            label={group.category.name}
            color={group.category.color}
            categoryId={group.category.id}
          />

          <TodoDraggableList items={group.todos} />
        </Box>
      ))}
    </Box>
  );
}

TodoList.Loading = function Loading() {
  return (
    <VStack gap={12}>
      {times(5, (i) => (
        <HStack key={`todo-skeleton-${i}`} gap={12} align="center" className="py-3">
          <Skeleton className="size-5 rounded" />

          <VStack flex={1} gap={2}>
            <Skeleton className="h-5 w-3/4 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </VStack>
        </HStack>
      ))}
    </VStack>
  );
};

TodoList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todo', 'common']);
  return (
    <Result
      title={t('list.loadError')}
      button={<Result.Button onPress={reset}>{t('common:errorBoundary.retry')}</Result.Button>}
    />
  );
};

interface CategoryHeaderProps {
  label: string;
  color: string;
  categoryId: number;
}

function CategoryHeader({ label, color, categoryId }: CategoryHeaderProps) {
  const [selectedDate] = useFeedDate();
  const overlay = useOverlay();

  return (
    <PressableFeedback
      onPress={() => {
        overlay.open(({ isOpen, close, exit }) => (
          <AddTodoBottomSheet
            mode="create"
            selectedDate={selectedDate}
            categoryId={categoryId}
            isOpen={isOpen}
            onClose={close}
            onOpenChange={(open) => {
              if (!open) {
                close();
                exit();
              }
            }}
          />
        ));
      }}
      hitSlop={8}
      className="self-start flex-row items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-2"
    >
      <Text size="b4" weight="semibold" style={{ color }}>
        {label}
      </Text>

      <PlusIcon
        width={fontScaledSize(14)}
        height={fontScaledSize(14)}
        colorClassName="text-gray-8"
      />
    </PressableFeedback>
  );
}

interface TodoDraggableListProps {
  items: TodoItemViewModel[];
}

function TodoDraggableList({ items }: TodoDraggableListProps) {
  const reorderMutation = useMutation(useReorderTodoMutationOptions());

  const { items: draggableItems, onDragEnd } = useDraggableReorderList({
    items,
    isPending: reorderMutation.isPending,
    onReorder: ({ movedItemId, targetId, position }) => {
      reorderMutation.mutate({
        id: movedItemId,
        input: { targetTodoId: targetId, position },
      });
    },
  });

  return (
    <NestableDraggableFlatList
      data={draggableItems}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item, drag, isActive }) => (
        <ScaleDecorator activeScale={1.015}>
          <TodoList.Item
            todo={item}
            drag={drag}
            isActive={isActive}
            isDragDisabled={reorderMutation.isPending}
          />
        </ScaleDecorator>
      )}
      onDragEnd={onDragEnd}
    />
  );
}

interface TodoItemProps {
  todo: TodoItemViewModel;
  drag?: () => void;
  isActive?: boolean;
  isDragDisabled?: boolean;
}

TodoList.Item = function Item({ todo, drag, isActive, isDragDisabled }: TodoItemProps) {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('todo');
  const todoActions = useTodoActions(todo);
  const subTodoActions = useSubTodoActions(todo);
  const overlay = useOverlay();
  const [isExpanded, setIsExpanded] = useState(todo.hasSubTodos);
  const showDateTime = todo.formattedTime && !todo.isAllDay;
  const isOptimistic = todo.optimistic;

  /** 행을 누르면 하위 항목이 열리고, 그 안에서 바로 새 항목을 추가할 수 있다. */
  const toggleChecklist = () => setIsExpanded((current) => !current);

  /** 댓글은 말풍선 버튼으로만 들어간다 — 할 일을 다루는 동작과 섞지 않는다. */
  const openComments = () => push({ pathname: '/todo/[todoId]', params: { todoId: todo.id } });

  const openActionsSheet = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <TodoActionsBottomSheet
        isOpen={isOpen}
        todo={todo}
        onClose={close}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
        onNavigate={(action) => {
          match(action)
            .with('edit', () => openEditSheet())
            .with('date', () => openDatePickerSheet())
            .with('time', () => openTimePickerSheet())
            .with('category', () => openCategorySheet())
            .exhaustive();
        }}
      />
    ));
  };

  const openEditSheet = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <AddTodoBottomSheet
        mode="edit"
        todo={todo}
        isOpen={isOpen}
        onClose={close}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
      />
    ));
  };

  const openDatePickerSheet = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <BottomSheet
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
      >
        {isOpen && (
          <TodoDatePickerContent
            startDate={todo.startDateObj}
            onCancel={close}
            onConfirm={(startDate) => {
              todoActions.updateSchedule({
                startDate: formatDate(startDate),
                endDate: null,
                scheduledTime: todo.isAllDay ? null : (todo.scheduledTime24 ?? null),
                isAllDay: todo.isAllDay,
              });
              close();
            }}
          />
        )}
      </BottomSheet>
    ));
  };

  const openTimePickerSheet = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <BottomSheet
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
      >
        {isOpen && (
          <Suspense fallback={<ActivityIndicator />}>
            <TodoTimePickerContent
              draftDate={todo.startDateObj}
              scheduledTime={todo.scheduledTime24}
              isAllDay={todo.isAllDay}
              onCancel={close}
              onConfirm={(scheduledTime, isAllDay) => {
                todoActions.updateSchedule({
                  startDate: formatDate(todo.startDateObj),
                  endDate: todo.endDateObj ? formatDate(todo.endDateObj) : null,
                  scheduledTime: isAllDay ? null : (scheduledTime ?? null),
                  isAllDay,
                });
                close();
              }}
            />
          </Suspense>
        )}
      </BottomSheet>
    ));
  };

  const openCategorySheet = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <CategorySelectBottomSheet
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
        selectedCategoryId={todo.category.id}
        onSelect={async (categoryId) => {
          const changed = await todoActions.changeCategory(categoryId).catch(() => null);

          if (changed) {
            close();
            exit();
          }
        }}
        submitLabel={t('actions.changeSubmit')}
      />
    ));
  };

  const openAddSubTodoSheet = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <AddSubTodoBottomSheet
        mode="create"
        isOpen={isOpen}
        onClose={close}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
        onSubmit={async (value) => {
          const added = await subTodoActions.add(value).catch(() => null);

          if (added) {
            close();
          }
        }}
      />
    ));
  };

  const openSubTodoActionsSheet = (subTodoId: number, currentValue: string) => {
    overlay.open(({ isOpen, close, exit }) => (
      <SubTodoActionsBottomSheet
        isOpen={isOpen}
        onClose={close}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
        onEdit={() => {
          overlay.open(({ isOpen: editIsOpen, close: editClose, exit: editExit }) => (
            <AddSubTodoBottomSheet
              mode="edit"
              initialValue={currentValue}
              isOpen={editIsOpen}
              onClose={editClose}
              onOpenChange={(open) => {
                if (!open) {
                  editClose();
                  editExit();
                }
              }}
              onSubmit={async (value) => {
                const updated = await subTodoActions.update(subTodoId, value).catch(() => null);

                if (updated) {
                  editClose();
                }
              }}
              onDelete={async () => {
                const removed = await subTodoActions.remove(subTodoId).catch(() => null);

                if (removed) {
                  editClose();
                }
              }}
            />
          ));
        }}
        onDelete={async () => {
          const removed = await subTodoActions.remove(subTodoId).catch(() => null);

          if (removed) {
            close();
          }
        }}
      />
    ));
  };

  return (
    <TodoRow
      left={
        <TodoCheckbox
          isSelected={todo.completed}
          onSelectedChange={todoActions.toggle}
          isDisabled={todoActions.isTogglePending || isOptimistic}
        />
      }
      top={
        <HStack gap={4} align="center">
          <TodoLabel isChecked={todo.completed}>{todo.title}</TodoLabel>
          {todo.visibility === 'PRIVATE' && (
            <LockIcon width={14} height={14} colorClassName="text-gray-5" />
          )}
        </HStack>
      }
      middle={
        showDateTime ? (
          <Text size="e1" shade={6}>
            {todo.formattedTime}
          </Text>
        ) : undefined
      }
      bottom={
        todo.hasSubTodos ? (
          <TodoProgress value={todo.subTodoStats.completed} total={todo.subTodoStats.total} />
        ) : undefined
      }
      right={
        <HStack gap={8} align="center">
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
          <PressableFeedback onPress={isOptimistic ? undefined : openActionsSheet} hitSlop={8}>
            <MoreIcon width={20} height={20} colorClassName="text-gray-5" />
          </PressableFeedback>
        </HStack>
      }
      onPress={isOptimistic ? undefined : toggleChecklist}
      onLongPress={isOptimistic || isDragDisabled ? undefined : drag}
      isActive={isActive}
      isDisabled={isOptimistic}
    >
      {isExpanded && (
        <SubTodoList onAddPress={openAddSubTodoSheet} isAddDisabled={!subTodoActions.canAdd}>
          <NestableDraggableFlatList
            data={todo.subTodos}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item, drag: itemDrag, isActive: itemIsActive }) => (
              <ScaleDecorator activeScale={1.015}>
                <SubTodoList.Item
                  label={item.title}
                  isSelected={item.completed}
                  onSelectedChange={(checked) => subTodoActions.toggle(item.id, checked)}
                  onMorePress={() => openSubTodoActionsSheet(item.id, item.title)}
                  drag={itemDrag}
                  isActive={itemIsActive}
                  isDragDisabled={subTodoActions.isReorderPending}
                />
              </ScaleDecorator>
            )}
            onDragEnd={subTodoActions.handleDragEnd}
          />
        </SubTodoList>
      )}
    </TodoRow>
  );
};
