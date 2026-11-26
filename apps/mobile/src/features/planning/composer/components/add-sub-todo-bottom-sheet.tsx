import { zodResolver } from '@hookform/resolvers/zod';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { useSuspenseSheetTodo } from '@src/features/planning/todo/hooks/use-suspense-sheet-todo';
import { useTodoSheetDateKey } from '@src/features/planning/todo/hooks/use-todo-sheet-date-key';
import { useAddSubTodoMutationOptions } from '@src/features/planning/todo/queries/sub-todo.mutations';
import { subTodoFormSchema } from '@src/features/planning/todo/schemas/sub-todo-form.schema';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { Box, HStack, VStack } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { Separator } from 'heroui-native';
import { type ComponentProps } from 'react';
import { Controller, FormState, useForm, Watch } from 'react-hook-form';

import { SubTodoBottomSheet, SubTodoDictation, SubTodoTitleInput } from './sub-todo-bottom-sheet';
import { TodoComposerSubmitButton } from './todo-composer-submit-button';

type AddSubTodoBottomSheetProps = Omit<ComponentProps<typeof SubTodoBottomSheet>, 'children'>;

export function AddSubTodoBottomSheet(props: AddSubTodoBottomSheetProps) {
  return (
    <SubTodoBottomSheet {...props}>
      {(close) => <AddSubTodoBottomSheet.Form onClose={close} />}
    </SubTodoBottomSheet>
  );
}

AddSubTodoBottomSheet.Form = function Form({ onClose }: { onClose: () => void }) {
  const todo = useSuspenseSheetTodo({ onMissing: onClose });

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
  const addSubTodo = useMutation(useAddSubTodoMutationOptions());

  const saveSubTodo = form.handleSubmit(async ({ title }) => {
    if (addSubTodo.isPending) {
      return;
    }
    await addSubTodo.mutateAsync({ todoId: todo.id, title, date });
    form.reset();
    onClose();
  });

  // isPending은 다음 렌더에야 켜져 같은 프레임의 두 번째 탭·완료 키가 하나 더 만든다.
  // 실패 안내와 보고는 mutation의 meta.errorFeedback이 맡고 적은 제목은 그대로 둔다
  const handleSavePress = useSingleTap(() => {
    saveSubTodo().catch(noop);
  });

  // 저장 중에는 아무 일도 하지 않는다. 시트를 닫으면 저장 결과를 볼 수 없다. 빈 제목은 저장 대신 닫는다
  const handleTitleSubmit = (isValid: boolean) => {
    if (addSubTodo.isPending) {
      return;
    }
    if (!isValid) {
      onClose();

      return;
    }
    handleSavePress();
  };

  return (
    <VStack gap={12}>
      <Controller
        control={form.control}
        name="title"
        render={({ field, formState: { isValid } }) => (
          <SubTodoTitleInput
            value={field.value}
            onChange={field.onChange}
            onSubmitEditing={() => handleTitleSubmit(isValid)}
          />
        )}
      />

      <Separator thickness={1} className="bg-gray-2" />

      <HStack gap={8} align="center">
        <Box className="flex-1" />

        <Watch
          control={form.control}
          name="title"
          render={(title) => (
            <SubTodoDictation
              value={title}
              // 적은 글자처럼 고친 칸으로 두고 바로 검사해 전송·완료 키가 따른다
              onChange={(text) =>
                form.setValue('title', text, { shouldDirty: true, shouldValidate: true })
              }
            />
          )}
        />
        <FormState
          control={form.control}
          render={({ isValid }) => (
            <TodoComposerSubmitButton
              testID="sub-todo-submit"
              isDisabled={!isValid || addSubTodo.isPending}
              isSubmitting={addSubTodo.isPending}
              onPress={() => handleSavePress()}
            />
          )}
        />
      </HStack>
    </VStack>
  );
}
