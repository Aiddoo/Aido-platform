import { zodResolver } from '@hookform/resolvers/zod';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { useTodoSheetDateKey } from '@src/features/planning/todo/hooks/use-todo-sheet-date-key';
import { useGetTodosByDateQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { Box, HStack, VStack } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { type ComponentProps, useEffect } from 'react';
import { useForm, useFormState } from 'react-hook-form';

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
  const { isValid } = useFormState({ control: form.control });
  const addSubTodo = useMutation(useAddSubTodoMutationOptions());
  const isSubmitDisabled = !isValid || addSubTodo.isPending;

  // 저장 중에는 아무 일도 하지 않는다. 시트를 닫으면 저장 결과를 볼 수 없다. 빈 제목은 저장 대신 닫는다
  const handleTitleSubmit = () => {
    if (addSubTodo.isPending) {
      return;
    }
    if (!isValid) {
      onClose();

      return;
    }
    submit();
  };

  const submit = form.handleSubmit(async ({ title }) => {
    if (addSubTodo.isPending) {
      return;
    }

    try {
      await addSubTodo.mutateAsync({ todoId: todo.id, title, date });
    } catch {
      return;
    }

    form.reset();
    onClose();
  });

  return (
    <VStack gap={12}>
      <SubTodoTitleInput form={form} onSubmitEditing={handleTitleSubmit} />

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
