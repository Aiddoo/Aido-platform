import { useTranslation } from '@src/shared/i18n';
import { BottomSheet, HStack, LockIcon, MoreIcon, Text, useOverlay } from '@src/shared/ui';
import { formatDate } from '@src/shared/utils/date';
import { PressableFeedback } from 'heroui-native';
import { Suspense, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { NestableDraggableFlatList, ScaleDecorator } from 'react-native-draggable-flatlist';
import { match } from 'ts-pattern';

import { useSubTodoActions } from '../../hooks/use-sub-todo-actions';
import { useTodoActions } from '../../hooks/use-todo-actions';
import type { TodoItemViewModel } from '../../view-models/todo-item.view-model';
import { AddSubTodoBottomSheet } from '../AddSubTodoBottomSheet';
import { AddTodoBottomSheet } from '../AddTodoBottomSheet';
import { CategorySelectBottomSheet } from '../CategorySelectBottomSheet';
import { SubTodoActionsBottomSheet } from '../SubTodoList/SubTodoActionsBottomSheet';
import { SubTodoList } from '../SubTodoList/SubTodoList';
import { TodoDatePickerContent } from '../TodoDatePickerContent';
import { TodoCheckbox, TodoLabel, TodoProgress, TodoRow } from '../TodoRow';
import { TodoTimePickerContent } from '../TodoTimePickerContent';
import { TodoActionsBottomSheet } from './TodoActionsBottomSheet';

interface TodoItemProps {
  todo: TodoItemViewModel;
  drag?: () => void;
  isActive?: boolean;
  isDragDisabled?: boolean;
}

export function TodoItem({ todo, drag, isActive, isDragDisabled }: TodoItemProps) {
  const { t } = useTranslation('todo');
  const todoActions = useTodoActions(todo);
  const subTodoActions = useSubTodoActions(todo);
  const overlay = useOverlay();
  const [isExpanded, setIsExpanded] = useState(todo.hasSubTodos);
  const showDateTime = todo.formattedTime && !todo.isAllDay;
  const isOptimistic = todo.optimistic;

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
        onSelect={(categoryId) => {
          todoActions.changeCategory(categoryId, {
            onSuccess: () => {
              close();
              exit();
            },
          });
        }}
        submitLabel={t('actions.changeSubmit')}
        isLoading={todoActions.isCategoryPending}
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
        onSubmit={(value) => subTodoActions.add(value, { onSuccess: () => close() })}
        isSubmitting={subTodoActions.isAddPending}
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
              onSubmit={(value) =>
                subTodoActions.update(subTodoId, value, { onSuccess: () => editClose() })
              }
              onDelete={() => subTodoActions.remove(subTodoId, { onSuccess: () => editClose() })}
              isSubmitting={subTodoActions.isUpdatePending}
            />
          ));
        }}
        onDelete={() => subTodoActions.remove(subTodoId, { onSuccess: () => close() })}
        isDeleting={subTodoActions.isRemovePending}
      />
    ));
  };

  return (
    <TodoRow
      left={
        <TodoCheckbox
          isChecked={todo.completed}
          onCheckedChange={todoActions.toggle}
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
        <PressableFeedback onPress={isOptimistic ? undefined : openActionsSheet} hitSlop={8}>
          <MoreIcon width={20} height={20} colorClassName="text-gray-5" />
        </PressableFeedback>
      }
      onPress={isOptimistic ? undefined : () => setIsExpanded((prev) => !prev)}
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
                  isChecked={item.completed}
                  onCheckedChange={(checked) => subTodoActions.toggle(item.id, checked)}
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
}
