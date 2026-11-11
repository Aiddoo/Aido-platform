import { zodResolver } from '@hookform/resolvers/zod';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { useSheetTodo } from '@src/features/planning/todo/hooks/use-sheet-todo';
import { useTodoSheetDateKey } from '@src/features/planning/todo/hooks/use-todo-sheet-date-key';
import { Box, HStack, VStack } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { type ComponentProps } from 'react';
import { useForm, useFormState } from 'react-hook-form';

import { useAddSubTodoMutationOptions } from '../queries/todo-composer.mutations';
import { subTodoFormSchema } from '../schemas/sub-todo-form.schema';
import { SubTodoBottomSheet, SubTodoDictation, SubTodoTitleInput } from './sub-todo-bottom-sheet';
import { TodoComposerSubmitButton } from './todo-composer-fields';

type AddSubTodoBottomSheetProps = Omit<ComponentProps<typeof SubTodoBottomSheet>, 'children'>;

export function AddSubTodoBottomSheet(props: AddSubTodoBottomSheetProps) {
  return (
    <SubTodoBottomSheet {...props}>
      {(close) => <AddSubTodoBottomSheet.Form onClose={close} />}
    </SubTodoBottomSheet>
  );
}

AddSubTodoBottomSheet.Form = function Form({ onClose }: { onClose: () => void }) {
  const todo = useSheetTodo({ onMissing: onClose });

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
