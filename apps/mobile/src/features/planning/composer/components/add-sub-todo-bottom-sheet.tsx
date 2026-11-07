import { zodResolver } from '@hookform/resolvers/zod';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { useTodoSheetDateKey } from '@src/features/planning/todo/hooks/use-todo-sheet-date-key';
import { useGetTodosByDateQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import type { Todo } from '@src/features/planning/todo/schemas/todo.schema';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { Box, HStack, VStack } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { type ComponentProps, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { useAddSubTodoMutationOptions } from '../queries/todo-composer.mutations';
import { subTodoFormSchema } from '../schemas/sub-todo-form.schema';
import { SubTodoBottomSheet, SubTodoDictation, SubTodoTitleInput } from './sub-todo-bottom-sheet';
import { TodoComposerSubmitButton } from './todo-composer-fields';

type AddSubTodoBottomSheetProps = Omit<ComponentProps<typeof SubTodoBottomSheet>, 'children'>;

export function AddSubTodoBottomSheet(props: AddSubTodoBottomSheetProps) {
  return (
    <SubTodoBottomSheet {...props}>
      {(close) => <AddSubTodoBottomSheet.Contents onClose={close} />}
    </SubTodoBottomSheet>
  );
}

AddSubTodoBottomSheet.Contents = function Contents({ onClose }: { onClose: () => void }) {
  const [todoId] = useTodoId();
  const [date] = useTodoSheetDateKey();
  const { data: todosByDate } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(TodoPolicy.findTodo(todosByDate.todos, todoId));

  useEffect(() => {
    if (todo == null) {
      onClose();
    }
  }, [todo, onClose]);

  if (todo == null) {
    return null;
  }

  return <AddSubTodoForm todo={todo} onClose={onClose} />;
};

function AddSubTodoForm({ todo, onClose }: { todo: Todo; onClose: () => void }) {
  const [date] = useTodoSheetDateKey();
  const form = useForm({
    resolver: zodResolver(subTodoFormSchema),
    defaultValues: { title: '' },
  });
  const title = useWatch({ control: form.control, name: 'title' });
  const addSubTodo = useMutation(useAddSubTodoMutationOptions());
  const reportUnexpectedError = useReportUnexpectedError('todo');
  const isSubmitDisabled = !title.trim() || addSubTodo.isPending;

  const submit = form.handleSubmit(async (values) => {
    const trimmedTitle = values.title.trim();
    if (!trimmedTitle || addSubTodo.isPending) {
      return;
    }

    try {
      await addSubTodo.mutateAsync({ todoId: todo.id, title: trimmedTitle, date });
    } catch (error) {
      reportUnexpectedError(error);

      return;
    }

    form.reset();
    onClose();
  });

  return (
    <VStack gap={12}>
      <SubTodoTitleInput
        form={form}
        onSubmitEditing={() => (isSubmitDisabled ? onClose() : submit())}
      />

      <Separator thickness={1} className="bg-gray-2" />

      <HStack gap={8} align="center">
        <Box className="flex-1" />

        <SubTodoDictation form={form} />
        <TodoComposerSubmitButton
          testID="sub-todo-submit"
          isDisabled={isSubmitDisabled}
          isSubmitting={addSubTodo.isPending}
          onPress={() => submit()}
        />
      </HStack>
    </VStack>
  );
}
