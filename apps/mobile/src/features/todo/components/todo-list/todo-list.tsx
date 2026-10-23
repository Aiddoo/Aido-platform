import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { type SubTodo, SubTodoPolicy } from '@src/features/todo/domains/sub-todo.model';
import { TodoPolicy } from '@src/features/todo/domains/todo.model';
import { type Todo } from '@src/features/todo/domains/todo.model';
import { formatTodoTime } from '@src/features/todo/utils/format-todo-time';
import { toTodoEditFormValues } from '@src/features/todo/utils/to-todo-edit-form-values';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
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
import { getDateFormatContext } from '@src/shared/utils/date';
import { formatDate } from '@src/shared/utils/date';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { router } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { type ReactNode, Suspense, useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import {
  type DragEndParams,
  NestableDraggableFlatList,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { match } from 'ts-pattern';

import { useDraggableReorderList } from '../../hooks/use-draggable-reorder-list';
import { useFeedDate } from '../../hooks/use-feed-date';
import { useGetTodoCategoriesQueryOptions } from '../../queries/get-todo-categories-query-options';
import { useGetTodosByDateQueryOptions } from '../../queries/get-todos-by-date-query-options';
import { useAddSubTodoMutationOptions } from '../../queries/use-add-sub-todo-mutation-options';
import { useChangeTodoCategoryMutationOptions } from '../../queries/use-change-todo-category-mutation-options';
import { useDeleteSubTodoMutationOptions } from '../../queries/use-delete-sub-todo-mutation-options';
import { useReorderSubTodosMutationOptions } from '../../queries/use-reorder-sub-todos-mutation-options';
import { useReorderTodoMutationOptions } from '../../queries/use-reorder-todo-mutation-options';
import { useToggleSubTodoMutationOptions } from '../../queries/use-toggle-sub-todo-mutation-options';
import { useToggleTodoMutationOptions } from '../../queries/use-toggle-todo-mutation-options';
import { useUpdateSubTodoMutationOptions } from '../../queries/use-update-sub-todo-mutation-options';
import { useUpdateTodoScheduleMutationOptions } from '../../queries/use-update-todo-schedule-mutation-options';
import { toTodoCategoryGroups } from '../../utils/group-todos-by-category';
import { AddSubTodoBottomSheet } from '../add-sub-todo-bottom-sheet';
import { AddTodoBottomSheet } from '../add-todo-bottom-sheet';
import { CategorySelectBottomSheet } from '../category-select-bottom-sheet';
import { ReorderCoachmark } from '../reorder-coachmark';
import { SubTodoActionsBottomSheet } from '../sub-todo-list/sub-todo-actions-bottom-sheet';
import { SubTodoList } from '../sub-todo-list/sub-todo-list';
import { TodoDatePickerContent } from '../todo-date-picker-content';
import { TodoCheckbox, TodoLabel, TodoProgress, TodoRow } from '../todo-row';
import { TodoTimePickerContent } from '../todo-time-picker-content';
import { TodoActionsBottomSheet } from './todo-actions-bottom-sheet';

export function TodoList() {
  const [selectedDate] = useFeedDate();
  const [{ data: categoriesData }, { data: todosData }] = useSuspenseQueries({
    queries: [
      useGetTodoCategoriesQueryOptions(),
      useGetTodosByDateQueryOptions({ date: formatDate(selectedDate) }),
    ],
  });
  const categoryGroups = useMemo(
    () => toTodoCategoryGroups(todosData.todos, categoriesData.categories),
    [todosData.todos, categoriesData.categories],
  );
  const canReorderTodos = categoryGroups.some((group) => group.todos.length >= 2);

  return (
    <Box gap={16}>
      {canReorderTodos && <ReorderCoachmark kind="todo" />}
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
      {range(5).map((i) => (
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
  const fontScaledSize = useFontScaledSize();
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
  items: Todo[];
}

function TodoDraggableList({ items }: TodoDraggableListProps) {
  const reorderMutation = useMutation(useReorderTodoMutationOptions());

  const {
    items: draggableItems,
    onDragBegin,
    onDragEnd,
  } = useDraggableReorderList({
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
      onDragBegin={onDragBegin}
      onDragEnd={onDragEnd}
    />
  );
}

interface TodoListItemProps {
  todo: Todo;
  drag?: () => void;
  isActive?: boolean;
  isDragDisabled?: boolean;
}

TodoList.Item = function Item({ todo, drag, isActive, isDragDisabled }: TodoListItemProps) {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('todo');
  const overlay = useOverlay();
  const toggleTodo = useMutation(useToggleTodoMutationOptions());
  const toggleSubTodo = useMutation(useToggleSubTodoMutationOptions());
  const reorderSubTodos = useMutation(useReorderSubTodosMutationOptions());
  const [isExpanded, setIsExpanded] = useState(TodoPolicy.hasSubTodos(todo));
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const formattedTime = formatTodoTime(todo, preference.timeFormat, getDateFormatContext());
  const isOptimistic = 'optimistic' in todo && todo.optimistic === true;

  /** 행을 누르면 하위 항목이 열리고, 그 안에서 바로 새 항목을 추가할 수 있다. */
  const toggleChecklist = () => setIsExpanded((current) => !current);

  /** 댓글은 말풍선 버튼으로만 들어간다 — 할 일을 다루는 동작과 섞지 않는다. */
  const openComments = () => push({ pathname: '/todo/[todoId]', params: { todoId: todo.id } });

  const openSheet = (render: (props: OverlaySheetProps) => ReactNode) =>
    overlay.open(({ isOpen, close, exit }) =>
      render({
        isOpen,
        onClose: close,
        onOpenChange: (open) => {
          if (!open) {
            close();
            exit();
          }
        },
      }),
    );

  const openActionsSheet = () =>
    openSheet((sheetProps) => (
      <TodoActionsBottomSheet
        {...sheetProps}
        todo={todo}
        onNavigate={(action) =>
          match(action)
            .with('edit', () =>
              openSheet((props) => <AddTodoBottomSheet {...props} mode="edit" todo={todo} />),
            )
            .with('date', () => openSheet((props) => <ScheduleDateSheet {...props} todo={todo} />))
            .with('time', () => openSheet((props) => <ScheduleTimeSheet {...props} todo={todo} />))
            .with('category', () =>
              openSheet((props) => <ChangeCategorySheet {...props} todo={todo} />),
            )
            .exhaustive()
        }
      />
    ));

  const openAddSubTodoSheet = () =>
    openSheet((sheetProps) => <AddSubTodoSheet {...sheetProps} todo={todo} />);

  const openSubTodoActionsSheet = (subTodo: SubTodo) =>
    openSheet((sheetProps) => (
      <SubTodoActionsSheet
        {...sheetProps}
        todo={todo}
        subTodo={subTodo}
        onEdit={() =>
          openSheet((props) => <EditSubTodoSheet {...props} todo={todo} subTodo={subTodo} />)
        }
      />
    ));

  const handleSubTodoDragEnd = ({ data, from, to }: DragEndParams<SubTodo>) => {
    if (from === to || reorderSubTodos.isPending) {
      return;
    }

    reorderSubTodos.mutate({
      todoId: todo.id,
      subTodoIds: data.map((subTodo) => subTodo.id),
      startDate: todo.startDate,
    });
  };

  return (
    <TodoRow
      left={
        <TodoCheckbox
          testID={`todo-checkbox-${todo.id}`}
          accessibilityLabel={todo.title}
          isSelected={todo.completed}
          onSelectedChange={() =>
            toggleTodo.mutate({
              todoId: todo.id,
              body: { completed: !todo.completed },
              startDate: todo.startDate,
            })
          }
          isDisabled={toggleTodo.isPending || isOptimistic}
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
        formattedTime != null ? (
          <Text size="e1" shade={6}>
            {formattedTime}
          </Text>
        ) : undefined
      }
      bottom={
        TodoPolicy.hasSubTodos(todo) ? (
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
        <SubTodoList
          onAddPress={openAddSubTodoSheet}
          isAddDisabled={!SubTodoPolicy.canAddSubTodo(todo)}
        >
          <NestableDraggableFlatList
            data={todo.subTodos}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item, drag: itemDrag, isActive: itemIsActive }) => (
              <ScaleDecorator activeScale={1.015}>
                <SubTodoList.Item
                  label={item.title}
                  isSelected={item.completed}
                  onSelectedChange={(completed) =>
                    toggleSubTodo.mutate({
                      todoId: todo.id,
                      subTodoId: item.id,
                      completed,
                      startDate: todo.startDate,
                    })
                  }
                  onMorePress={() => openSubTodoActionsSheet(item)}
                  drag={itemDrag}
                  isActive={itemIsActive}
                  isDragDisabled={reorderSubTodos.isPending}
                />
              </ScaleDecorator>
            )}
            onDragEnd={handleSubTodoDragEnd}
          />
        </SubTodoList>
      )}
    </TodoRow>
  );
};

interface OverlaySheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChange: (open: boolean) => void;
}

function ScheduleDateSheet({ todo, onClose, ...sheetProps }: OverlaySheetProps & { todo: Todo }) {
  const updateSchedule = useMutation(useUpdateTodoScheduleMutationOptions());
  const editValues = toTodoEditFormValues(todo);

  return (
    <BottomSheet {...sheetProps}>
      {sheetProps.isOpen && (
        <TodoDatePickerContent
          value={editValues.startDate}
          onCancel={onClose}
          onChange={(startDate) => {
            updateSchedule.mutate({
              todoId: todo.id,
              input: {
                startDate: formatDate(startDate),
                endDate: null,
                scheduledTime: todo.isAllDay ? null : (editValues.scheduledTime ?? null),
                isAllDay: todo.isAllDay,
              },
            });
            onClose();
          }}
        />
      )}
    </BottomSheet>
  );
}

function ScheduleTimeSheet({ todo, onClose, ...sheetProps }: OverlaySheetProps & { todo: Todo }) {
  const updateSchedule = useMutation(useUpdateTodoScheduleMutationOptions());
  const editValues = toTodoEditFormValues(todo);

  return (
    <BottomSheet {...sheetProps}>
      {sheetProps.isOpen && (
        <Suspense fallback={<ActivityIndicator />}>
          <TodoTimePickerContent
            date={editValues.startDate}
            value={{
              scheduledTime: editValues.scheduledTime ?? undefined,
              isAllDay: todo.isAllDay,
            }}
            onCancel={onClose}
            onChange={({ scheduledTime, isAllDay }) => {
              updateSchedule.mutate({
                todoId: todo.id,
                input: {
                  startDate: formatDate(editValues.startDate),
                  endDate: editValues.endDate ? formatDate(editValues.endDate) : null,
                  scheduledTime: isAllDay ? null : (scheduledTime ?? null),
                  isAllDay,
                },
              });
              onClose();
            }}
          />
        </Suspense>
      )}
    </BottomSheet>
  );
}

function ChangeCategorySheet({
  todo,
  onClose: _onClose,
  ...sheetProps
}: OverlaySheetProps & { todo: Todo }) {
  const { t } = useTranslation('todo');
  const changeCategory = useMutation(useChangeTodoCategoryMutationOptions());

  return (
    <CategorySelectBottomSheet
      {...sheetProps}
      value={todo.category.id}
      submitLabel={t('actions.changeSubmit')}
      onChange={async (categoryId) => {
        const changed = await changeCategory
          .mutateAsync({ todoId: todo.id, input: { categoryId } })
          .catch(() => null);

        if (changed) {
          sheetProps.onOpenChange(false);
        }
      }}
    />
  );
}

function AddSubTodoSheet({ todo, onClose, ...sheetProps }: OverlaySheetProps & { todo: Todo }) {
  const addSubTodo = useMutation(useAddSubTodoMutationOptions());

  return (
    <AddSubTodoBottomSheet
      {...sheetProps}
      mode="create"
      onClose={onClose}
      onSubmit={async (title) => {
        const added = await addSubTodo
          .mutateAsync({ todoId: todo.id, title, startDate: todo.startDate })
          .catch(() => null);

        if (added) {
          onClose();
        }
      }}
    />
  );
}

function EditSubTodoSheet({
  todo,
  subTodo,
  onClose,
  ...sheetProps
}: OverlaySheetProps & { todo: Todo; subTodo: SubTodo }) {
  const updateSubTodo = useMutation(useUpdateSubTodoMutationOptions());
  const deleteSubTodo = useMutation(useDeleteSubTodoMutationOptions());
  const target = { todoId: todo.id, subTodoId: subTodo.id, startDate: todo.startDate };

  return (
    <AddSubTodoBottomSheet
      {...sheetProps}
      mode="edit"
      initialValue={subTodo.title}
      onClose={onClose}
      onSubmit={async (title) => {
        const updated = await updateSubTodo.mutateAsync({ ...target, title }).catch(() => null);

        if (updated) {
          onClose();
        }
      }}
      onDelete={async () => {
        const removed = await deleteSubTodo.mutateAsync(target).catch(() => null);

        if (removed) {
          onClose();
        }
      }}
    />
  );
}

function SubTodoActionsSheet({
  todo,
  subTodo,
  onClose,
  onEdit,
  ...sheetProps
}: OverlaySheetProps & { todo: Todo; subTodo: SubTodo; onEdit: () => void }) {
  const deleteSubTodo = useMutation(useDeleteSubTodoMutationOptions());

  return (
    <SubTodoActionsBottomSheet
      {...sheetProps}
      onClose={onClose}
      onEdit={onEdit}
      onDelete={async () => {
        const removed = await deleteSubTodo
          .mutateAsync({ todoId: todo.id, subTodoId: subTodo.id, startDate: todo.startDate })
          .catch(() => null);

        if (removed) {
          onClose();
        }
      }}
    />
  );
}
