import { zodResolver } from '@hookform/resolvers/zod';
import { SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import type { SubTodo } from '@src/features/planning/todo/domains/sub-todo.model';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { useSheetSubTodo } from '@src/features/planning/todo/hooks/use-sheet-todo';
import { useTodoSheetDateKey } from '@src/features/planning/todo/hooks/use-todo-sheet-date-key';
import { useDeleteSubTodoMutationOptions } from '@src/features/planning/todo/queries/sub-todo.mutations';
import { useUpdateSubTodoMutationOptions } from '@src/features/planning/todo/queries/sub-todo.mutations';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, IconButton, TrashIcon, VStack } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { type ComponentProps } from 'react';
import { useForm, useFormState } from 'react-hook-form';

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
  const target = useSheetSubTodo({ onMissing: onClose });

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
    resetOptions: { keepDirtyValues: true },
  });
  const { isValid } = useFormState({ control: form.control });
  const updateSubTodo = useMutation(useUpdateSubTodoMutationOptions());
  const deleteSubTodo = useMutation(useDeleteSubTodoMutationOptions());
  const isBusy = updateSubTodo.isPending || deleteSubTodo.isPending;
  const isSubmitDisabled = !isValid || isBusy;

  // 저장 중에는 아무 일도 하지 않는다. 시트를 닫으면 저장 결과를 볼 수 없다. 빈 제목은 저장 대신 닫는다
  const handleTitleSubmit = () => {
    if (isBusy) {
      return;
    }
    if (!isValid) {
      onClose();

      return;
    }
    submit();
  };

  const submit = form.handleSubmit(async ({ title }) => {
    if (isBusy) {
      return;
    }
    if (!SubTodoPolicy.hasTitleChanged(subTodo, title)) {
      onClose();

      return;
    }

    try {
      await updateSubTodo.mutateAsync({
        todoId: todo.id,
        subTodoId: subTodo.id,
        title,
        date,
      });
      onClose();
    } catch {
      // 실패 안내와 보고는 mutation의 meta.errorFeedback이 맡는다
    }
  });

  const handleDelete = async () => {
    if (isBusy) {
      return;
    }

    try {
      await deleteSubTodo.mutateAsync({ todoId: todo.id, subTodoId: subTodo.id, date });
      onClose();
    } catch {
      // 실패 안내와 보고는 mutation의 meta.errorFeedback이 맡는다
    }
  };

  return (
    <VStack gap={12}>
      <SubTodoTitleInput form={form} onSubmitEditing={handleTitleSubmit} />

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
