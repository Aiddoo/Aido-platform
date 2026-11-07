import { zodResolver } from '@hookform/resolvers/zod';
import { SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { useTodoParams } from '@src/features/planning/todo/hooks/use-todo-params';
import {
  useSubTodoParams,
  useTodoSheetDateParam,
} from '@src/features/planning/todo/hooks/use-todo-sheet-params';
import { useDeleteSubTodoMutationOptions } from '@src/features/planning/todo/queries/sub-todo.mutations';
import { useGetTodosByDateQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import type { SubTodo } from '@src/features/planning/todo/schemas/sub-todo.schema';
import type { Todo } from '@src/features/planning/todo/schemas/todo.schema';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, IconButton, TrashIcon, VStack } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { type ComponentProps, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { useUpdateSubTodoMutationOptions } from '../queries/todo-composer.mutations';
import { subTodoFormSchema } from '../schemas/sub-todo-form.schema';
import { SubTodoBottomSheet, SubTodoDictation, SubTodoTitleInput } from './sub-todo-bottom-sheet';
import { TodoComposerSubmitButton } from './todo-composer-fields';

type EditSubTodoBottomSheetProps = Omit<ComponentProps<typeof SubTodoBottomSheet>, 'children'>;

export function EditSubTodoBottomSheet(props: EditSubTodoBottomSheetProps) {
  return (
    <SubTodoBottomSheet {...props}>
      {(close) => <EditSubTodoBottomSheet.Contents onClose={close} />}
    </SubTodoBottomSheet>
  );
}

EditSubTodoBottomSheet.Contents = function Contents({ onClose }: { onClose: () => void }) {
  const { todoId } = useTodoParams();
  const { subTodoId } = useSubTodoParams();
  const date = useTodoSheetDateParam();
  const { data: todosByDate } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(TodoPolicy.findTodo(todosByDate.todos, todoId));
  const subTodo = useRetainedValue(TodoPolicy.findSubTodo(todo, subTodoId));

  useEffect(() => {
    if (todo == null || subTodo == null) {
      onClose();
    }
  }, [todo, subTodo, onClose]);

  if (todo == null || subTodo == null) {
    return null;
  }

  return <EditSubTodoForm todo={todo} subTodo={subTodo} onClose={onClose} />;
};

interface EditSubTodoFormProps {
  todo: Todo;
  subTodo: SubTodo;
  onClose: () => void;
}

function EditSubTodoForm({ todo, subTodo, onClose }: EditSubTodoFormProps) {
  const { t } = useTranslation('todo');
  const date = useTodoSheetDateParam();
  const fontScaledSize = useFontScaledSize();
  const form = useForm({
    resolver: zodResolver(subTodoFormSchema),
    defaultValues: { title: subTodo.title },
  });
  const title = useWatch({ control: form.control, name: 'title' });
  const updateSubTodo = useMutation(useUpdateSubTodoMutationOptions());
  const deleteSubTodo = useMutation(useDeleteSubTodoMutationOptions());
  const reportUnexpectedError = useReportUnexpectedError('todo');
  const isBusy = updateSubTodo.isPending || deleteSubTodo.isPending;
  const isSubmitDisabled = !title.trim() || isBusy;

  const submit = form.handleSubmit(async (values) => {
    const trimmedTitle = values.title.trim();
    if (!trimmedTitle || isBusy) {
      return;
    }
    if (!SubTodoPolicy.hasTitleChanged(subTodo, trimmedTitle)) {
      onClose();

      return;
    }

    try {
      await updateSubTodo.mutateAsync({
        todoId: todo.id,
        subTodoId: subTodo.id,
        title: trimmedTitle,
        date,
      });
      onClose();
    } catch (error) {
      reportUnexpectedError(error);
    }
  });

  const handleDelete = async () => {
    if (isBusy) {
      return;
    }

    try {
      await deleteSubTodo.mutateAsync({ todoId: todo.id, subTodoId: subTodo.id, date });
      onClose();
    } catch (error) {
      reportUnexpectedError(error);
    }
  };

  return (
    <VStack gap={12}>
      <SubTodoTitleInput
        form={form}
        onSubmitEditing={() => (isSubmitDisabled ? onClose() : submit())}
      />

      <Separator thickness={1} className="bg-gray-2" />

      <HStack gap={8} align="center">
        <IconButton
          testID="sub-todo-delete"
          accessibilityLabel={t('actions.delete')}
          icon={
            <TrashIcon
              width={fontScaledSize(18)}
              height={fontScaledSize(18)}
              colorClassName="text-error"
            />
          }
          className="size-9 min-h-0 min-w-0 rounded-full bg-error/10"
          isDisabled={isBusy}
          onPress={handleDelete}
        />

        <Box className="flex-1" />

        <SubTodoDictation form={form} />
        <TodoComposerSubmitButton
          testID="sub-todo-submit"
          isDisabled={isSubmitDisabled}
          isSubmitting={updateSubTodo.isPending}
          onPress={() => submit()}
        />
      </HStack>
    </VStack>
  );
}
