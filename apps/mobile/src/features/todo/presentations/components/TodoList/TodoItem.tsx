import { BottomSheet, HStack, LockIcon, MoreIcon, Text, useOverlay, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatDate } from '@src/shared/utils/date';
import { useMutation } from '@tanstack/react-query';
import { Checkbox, PressableFeedback } from 'heroui-native';
import { Suspense, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import {
  type DragEndParams,
  NestableDraggableFlatList,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { match } from 'ts-pattern';
import { type SubTodo, SubTodoPolicy } from '../../../models/sub-todo.model';
import { useAddSubTodoMutationOptions } from '../../queries/use-add-sub-todo-mutation-options';
import { useChangeTodoCategoryMutationOptions } from '../../queries/use-change-todo-category-mutation-options';
import { useDeleteSubTodoMutationOptions } from '../../queries/use-delete-sub-todo-mutation-options';
import { useReorderSubTodosMutationOptions } from '../../queries/use-reorder-sub-todos-mutation-options';
import { useToggleSubTodoMutationOptions } from '../../queries/use-toggle-sub-todo-mutation-options';
import { useToggleTodoMutationOptions } from '../../queries/use-toggle-todo-mutation-options';
import { useUpdateSubTodoMutationOptions } from '../../queries/use-update-sub-todo-mutation-options';
import { useUpdateTodoScheduleMutationOptions } from '../../queries/use-update-todo-schedule-mutation-options';
import type { TodoItemViewModel } from '../../view-models/todo-item.view-model';
import { AddSubTodoBottomSheet } from '../AddSubTodoBottomSheet';
import { AddTodoBottomSheet } from '../AddTodoBottomSheet';
import { CategorySelectBottomSheet } from '../CategorySelectBottomSheet';
import { SubTodoActionsBottomSheet } from '../SubTodoList/SubTodoActionsBottomSheet';
import { SubTodoList, SubTodoProgressIndicator } from '../SubTodoList/SubTodoList';
import { TodoDatePickerContent } from '../TodoDatePickerContent';
import { TodoTimePickerContent } from '../TodoTimePickerContent';
import { TodoActionsBottomSheet } from './TodoActionsBottomSheet';

interface TodoItemProps {
  todo: TodoItemViewModel;
  drag?: () => void;
  isActive?: boolean;
  isDragDisabled?: boolean;
}

export const TodoItem = ({ todo, drag, isActive, isDragDisabled }: TodoItemProps) => {
  const actionsOverlay = useOverlay();
  const subTodoActionsOverlay = useOverlay();
  const overlay = useOverlay();
  const toggleMutation = useMutation(useToggleTodoMutationOptions());
  const updateScheduleMutation = useMutation(useUpdateTodoScheduleMutationOptions());
  const changeCategoryMutation = useMutation(useChangeTodoCategoryMutationOptions());
  const addSubTodoMutation = useMutation(useAddSubTodoMutationOptions());
  const toggleSubTodoMutation = useMutation(useToggleSubTodoMutationOptions());
  const updateSubTodoMutation = useMutation(useUpdateSubTodoMutationOptions());
  const deleteSubTodoMutation = useMutation(useDeleteSubTodoMutationOptions());
  const reorderSubTodosMutation = useMutation(useReorderSubTodosMutationOptions());
  const [isExpanded, setIsExpanded] = useState(false);
  const showDateTime = todo.formattedTime && !todo.isAllDay;
  const isOptimistic = todo.optimistic;

  const handleSubTodoDragEnd = ({ data, from, to }: DragEndParams<SubTodo>) => {
    if (from === to || reorderSubTodosMutation.isPending) return;
    reorderSubTodosMutation.mutate({
      todoId: todo.id,
      subTodoIds: data.map((item) => item.id),
      startDate: todo.startDate,
    });
  };

  const openEditBottomSheet = () => {
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

  const openDatePickerBottomSheet = () => {
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
              updateScheduleMutation.mutate({
                todoId: todo.id,
                input: {
                  startDate: formatDate(startDate),
                  endDate: null,
                  scheduledTime: todo.isAllDay ? null : (todo.scheduledTime24 ?? null),
                  isAllDay: todo.isAllDay,
                },
              });
              close();
            }}
          />
        )}
      </BottomSheet>
    ));
  };

  const openTimePickerBottomSheet = () => {
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
                updateScheduleMutation.mutate({
                  todoId: todo.id,
                  input: {
                    startDate: formatDate(todo.startDateObj),
                    endDate: todo.endDateObj ? formatDate(todo.endDateObj) : null,
                    scheduledTime: isAllDay ? null : (scheduledTime ?? null),
                    isAllDay,
                  },
                });
                close();
              }}
            />
          </Suspense>
        )}
      </BottomSheet>
    ));
  };

  const openCategoryBottomSheet = () => {
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
        onSelect={(categoryId) => {
          changeCategoryMutation.mutate(
            { todoId: todo.id, input: { categoryId } },
            {
              onSuccess: () => {
                close();
                exit();
              },
            },
          );
        }}
        submitLabel="변경하기"
        isLoading={changeCategoryMutation.isPending}
      />
    ));
  };

  const openActionsBottomSheet = () => {
    actionsOverlay.open(({ isOpen, close, exit }) => (
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
            .with('edit', () => openEditBottomSheet())
            .with('date', () => openDatePickerBottomSheet())
            .with('time', () => openTimePickerBottomSheet())
            .with('category', () => openCategoryBottomSheet())
            .exhaustive();
        }}
      />
    ));
  };

  const openAddSubTodoBottomSheet = () => {
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
        onSubmit={(value) => {
          addSubTodoMutation.mutate(
            { todoId: todo.id, title: value, startDate: todo.startDate },
            { onSuccess: () => close() },
          );
        }}
        isSubmitting={addSubTodoMutation.isPending}
      />
    ));
  };

  const openEditSubTodoBottomSheet = (subTodoId: number, currentValue: string) => {
    overlay.open(({ isOpen, close, exit }) => (
      <AddSubTodoBottomSheet
        mode="edit"
        initialValue={currentValue}
        isOpen={isOpen}
        onClose={close}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
        onSubmit={(value) => {
          updateSubTodoMutation.mutate(
            { todoId: todo.id, subTodoId, title: value, startDate: todo.startDate },
            { onSuccess: () => close() },
          );
        }}
        onDelete={() => {
          deleteSubTodoMutation.mutate(
            { todoId: todo.id, subTodoId, startDate: todo.startDate },
            { onSuccess: () => close() },
          );
        }}
        isSubmitting={updateSubTodoMutation.isPending}
      />
    ));
  };

  const openSubTodoActionsSheet = (subTodoId: number, currentValue: string) => {
    subTodoActionsOverlay.open(({ isOpen, close, exit }) => (
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
          openEditSubTodoBottomSheet(subTodoId, currentValue);
        }}
        onDelete={() => {
          deleteSubTodoMutation.mutate(
            { todoId: todo.id, subTodoId, startDate: todo.startDate },
            { onSuccess: () => close() },
          );
        }}
        isDeleting={deleteSubTodoMutation.isPending}
      />
    ));
  };

  const handleTodoPress = () => {
    if (isOptimistic) return;
    setIsExpanded((prev) => !prev);
  };

  return (
    <>
      <PressableFeedback
        onPress={handleTodoPress}
        onLongPress={isOptimistic || isDragDisabled ? undefined : drag}
        isDisabled={isActive || isOptimistic}
        className={cn('py-2 rounded-xl', isActive && 'bg-gray-1', isOptimistic && 'opacity-50')}
      >
        <HStack gap={12} align="center">
          <Checkbox
            className="shadow-none border border-main size-5 rounded-md"
            isSelected={todo.completed}
            onSelectedChange={() =>
              toggleMutation.mutate({
                todoId: todo.id,
                body: { completed: !todo.completed },
                startDate: todo.startDate,
              })
            }
            isDisabled={toggleMutation.isPending || isOptimistic}
          />

          <VStack flex={1} gap={2}>
            <HStack gap={4} align="center">
              <Text
                size="b3"
                weight="medium"
                strikethrough={todo.completed}
                shade={todo.completed ? 5 : undefined}
              >
                {todo.title}
              </Text>
              {todo.visibility === 'PRIVATE' && (
                <LockIcon width={14} height={14} colorClassName="text-gray-5" />
              )}
            </HStack>
            {showDateTime && (
              <Text size="e1" shade={6}>
                {todo.formattedTime}
              </Text>
            )}
            {todo.hasSubTodos && (
              <SubTodoProgressIndicator
                value={todo.subTodoStats.completed}
                total={todo.subTodoStats.total}
              />
            )}
          </VStack>

          <PressableFeedback
            onPress={isOptimistic ? undefined : openActionsBottomSheet}
            hitSlop={8}
          >
            <MoreIcon width={20} height={20} colorClassName="text-gray-5" />
          </PressableFeedback>
        </HStack>
      </PressableFeedback>

      {isExpanded && (
        <SubTodoList
          onAddPress={openAddSubTodoBottomSheet}
          isAddDisabled={!SubTodoPolicy.canAddSubTodo(todo)}
        >
          <NestableDraggableFlatList
            data={todo.subTodos}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item, drag: itemDrag, isActive: itemIsActive }) => (
              <ScaleDecorator activeScale={1.015}>
                <SubTodoList.Item
                  label={item.title}
                  isChecked={item.completed}
                  onCheckedChange={(checked) =>
                    toggleSubTodoMutation.mutate({
                      todoId: todo.id,
                      subTodoId: item.id,
                      completed: checked,
                      startDate: todo.startDate,
                    })
                  }
                  onMorePress={() => openSubTodoActionsSheet(item.id, item.title)}
                  drag={itemDrag}
                  isActive={itemIsActive}
                  isDragDisabled={reorderSubTodosMutation.isPending}
                />
              </ScaleDecorator>
            )}
            onDragEnd={handleSubTodoDragEnd}
          />
        </SubTodoList>
      )}
    </>
  );
};
