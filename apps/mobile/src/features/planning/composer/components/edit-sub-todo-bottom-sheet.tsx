import { zodResolver } from '@hookform/resolvers/zod';
import { type SubTodo, SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { useSuspenseSheetSubTodo } from '@src/features/planning/todo/hooks/use-suspense-sheet-todo';
import { useTodoSheetDateKey } from '@src/features/planning/todo/hooks/use-todo-sheet-date-key';
import {
  useDeleteSubTodoMutationOptions,
  useUpdateSubTodoMutationOptions,
} from '@src/features/planning/todo/queries/sub-todo.mutations';
import { SERVER_VALUES_RESET_OPTIONS } from '@src/shared/constants/server-values-reset-options';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, IconButton, TrashIcon, VStack } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { Separator } from 'heroui-native';
import { type ComponentProps } from 'react';
import { Controller, FormState, useForm, Watch } from 'react-hook-form';

import { subTodoFormSchema } from '../schemas/sub-todo-form.schema';
import { SubTodoBottomSheet, SubTodoDictation, SubTodoTitleInput } from './sub-todo-bottom-sheet';
import { TodoComposerSubmitButton } from './todo-composer-submit-button';

type EditSubTodoBottomSheetProps = Omit<ComponentProps<typeof SubTodoBottomSheet>, 'children'>;

export function EditSubTodoBottomSheet(props: EditSubTodoBottomSheetProps) {
  return (
    <SubTodoBottomSheet {...props}>
      {(close) => <EditSubTodoBottomSheet.Form onClose={close} />}
    </SubTodoBottomSheet>
  );
}

EditSubTodoBottomSheet.Form = function Form({ onClose }: { onClose: () => void }) {
  const target = useSuspenseSheetSubTodo({ onMissing: onClose });

  if (target == null) {
    return null;
  }
  const { todo, subTodo } = target;

  return <EditSubTodoForm todo={todo} subTodo={subTodo} onClose={onClose} />;
};

interface EditSubTodoFormProps {
  todo: Todo;
  subTodo: SubTodo;
  onClose: () => void;
}

function EditSubTodoForm({ todo, subTodo, onClose }: EditSubTodoFormProps) {
  const { t } = useTranslation('todo');
  const [date] = useTodoSheetDateKey();
  const fontScaledSize = useFontScaledSize();
  // 다시 받은 제목으로 비교 기준을 맞춘다. 고치던 제목은 남는다
  const form = useForm({
    resolver: zodResolver(subTodoFormSchema),
    values: { title: subTodo.title },
    resetOptions: SERVER_VALUES_RESET_OPTIONS,
  });
  const updateSubTodo = useMutation(useUpdateSubTodoMutationOptions());
  const deleteSubTodo = useMutation(useDeleteSubTodoMutationOptions());
  const isBusy = updateSubTodo.isPending || deleteSubTodo.isPending;

  const saveSubTodo = form.handleSubmit(async ({ title }) => {
    if (isBusy) {
      return;
    }
    if (!SubTodoPolicy.hasTitleChanged(subTodo, title)) {
      onClose();

      return;
    }
    await updateSubTodo.mutateAsync({
      todoId: todo.id,
      subTodoId: subTodo.id,
      title,
      date,
    });
    onClose();
  });

  // isPending은 다음 렌더에야 켜져 같은 프레임의 두 번째 탭·완료 키가 한 번 더 보낸다.
  // 실패 안내와 보고는 mutation의 meta.errorFeedback이 맡고 고친 제목은 그대로 둔다
  const handleSavePress = useSingleTap(() => {
    saveSubTodo().catch(noop);
  });

  // 저장 중에는 아무 일도 하지 않는다. 시트를 닫으면 저장 결과를 볼 수 없다. 빈 제목은 저장 대신 닫는다
  const handleTitleSubmit = (isValid: boolean) => {
    if (isBusy) {
      return;
    }
    if (!isValid) {
      onClose();

      return;
    }
    handleSavePress();
  };

  // 실패 안내와 보고는 mutation의 meta.errorFeedback이 맡는다
  const handleDelete = () => {
    if (isBusy) {
      return;
    }
    deleteSubTodo
      .mutateAsync({ todoId: todo.id, subTodoId: subTodo.id, date })
      .then(() => onClose())
      .catch(noop);
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
          hitSlop={4}
          className="size-9 min-h-0 min-w-0 rounded-full bg-error/10"
          isDisabled={isBusy}
          onPress={handleDelete}
        />

        <Box className="flex-1" />

        <Watch
          control={form.control}
          name="title"
          render={(title) => (
            <SubTodoDictation
              value={title}
              // 적은 글자처럼 고친 칸으로 두고 바로 검사해 다시 받은 값이 덮지 않고 전송·완료 키가 따른다
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
              isDisabled={!isValid || isBusy}
              isSubmitting={updateSubTodo.isPending}
              onPress={() => handleSavePress()}
            />
          )}
        />
      </HStack>
    </VStack>
  );
}
