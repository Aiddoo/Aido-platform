import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import {
  useSubTodoSheetParams,
  useTodoSheetDateParam,
} from '@src/features/todo/hooks/use-todo-sheet-params';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useSpeechRecognition } from '@src/shared/hooks/use-speech-recognition';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import {
  ArrowUpIcon,
  BottomSheetInput,
  Box,
  HStack,
  InfoIcon,
  KeyboardBottomSheet,
  MicIcon,
  PauseIcon,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  Text,
  TrashIcon,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Popover, PressableFeedback, Skeleton, Spinner } from 'heroui-native';
import type { ComponentProps, ComponentRef } from 'react';
import { Suspense, useEffect, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { Keyboard } from 'react-native';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import type { SubTodo } from '../domains/sub-todo.model';
import type { Todo } from '../domains/todo.model';
import { useGetTodosByDateQueryOptions } from '../queries/get-todos-by-date-query-options';
import { useAddSubTodoMutationOptions } from '../queries/use-add-sub-todo-mutation-options';
import { useDeleteSubTodoMutationOptions } from '../queries/use-delete-sub-todo-mutation-options';
import { useUpdateSubTodoMutationOptions } from '../queries/use-update-sub-todo-mutation-options';
import { TODO_SHEET_FALLBACK_HREF } from '../utils/navigation/todo-sheet-href';
import { findSheetSubTodo, findSheetTodo } from '../utils/view-models/todo-sheet-target.view-model';

type AddSubTodoBottomSheetProps = Omit<
  ComponentProps<typeof KeyboardBottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
> & {
  mode: 'create' | 'edit';
};

/**
 * 하위 항목 추가·수정 시트. 부모 할 일은 `/todo/[todoId]/sub-todos/…` route에서,
 * 수정할 하위 항목은 `[subTodoId]` 세그먼트에서 읽는다.
 */
export function AddSubTodoBottomSheet({ mode, ...props }: AddSubTodoBottomSheetProps) {
  const sheet = useSheetRoute(TODO_SHEET_FALLBACK_HREF);

  return (
    <KeyboardBottomSheet {...props} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      <QueryErrorBoundary fallback={AddSubTodoBottomSheet.Error}>
        <Suspense fallback={<AddSubTodoBottomSheet.Loading />}>
          {match(mode)
            .with('create', () => <AddSubTodoBottomSheet.Create onClose={() => sheet.close()} />)
            .with('edit', () => <AddSubTodoBottomSheet.Edit onClose={() => sheet.close()} />)
            .exhaustive()}
        </Suspense>
      </QueryErrorBoundary>
    </KeyboardBottomSheet>
  );
}

interface SheetContentProps {
  onClose: () => void;
}

AddSubTodoBottomSheet.Create = function Create({ onClose }: SheetContentProps) {
  const { todoId } = useTodoScreenParams();
  const [date] = useTodoSheetDateParam();
  const { data } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(findSheetTodo(data.todos, todoId));

  useEffect(() => {
    if (todo == null) {
      onClose();
    }
  }, [todo, onClose]);

  if (todo == null) {
    return null;
  }

  return <SubTodoForm todo={todo} subTodo={null} onClose={onClose} />;
};

AddSubTodoBottomSheet.Edit = function Edit({ onClose }: SheetContentProps) {
  const { todoId } = useTodoScreenParams();
  const { subTodoId } = useSubTodoSheetParams();
  const [date] = useTodoSheetDateParam();
  const { data } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(findSheetTodo(data.todos, todoId));
  const subTodo = useRetainedValue(findSheetSubTodo(todo, subTodoId));

  useEffect(() => {
    if (todo == null || subTodo == null) {
      onClose();
    }
  }, [todo, subTodo, onClose]);

  if (todo == null || subTodo == null) {
    return null;
  }

  return <SubTodoForm todo={todo} subTodo={subTodo} onClose={onClose} />;
};

AddSubTodoBottomSheet.Loading = function Loading() {
  return (
    <VStack gap={12}>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Box className="h-px bg-gray-2" />
      <Skeleton className="h-9 w-24 self-end rounded-4xl" />
    </VStack>
  );
};

AddSubTodoBottomSheet.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');
  return (
    <Result
      title={t('errorBoundary.title')}
      button={<Result.Button onPress={reset}>{t('errorBoundary.retry')}</Result.Button>}
    />
  );
};

interface SubTodoFormProps {
  todo: Todo;
  subTodo: SubTodo | null;
  onClose: () => void;
}

function SubTodoForm({ todo, subTodo, onClose }: SubTodoFormProps) {
  const fontScaledSize = useFontScaledSize();
  const { color: spinnerColor } = useResolveClassNames('text-white');

  const [value, setValue] = useState(subTodo?.title ?? '');
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const addSubTodo = useMutation(useAddSubTodoMutationOptions());
  const updateSubTodo = useMutation(useUpdateSubTodoMutationOptions());
  const deleteSubTodo = useMutation(useDeleteSubTodoMutationOptions());
  const isSubmitting = addSubTodo.isPending || updateSubTodo.isPending;
  const isBusy = isSubmitting || deleteSubTodo.isPending;

  const isSubmitDisabled = !value.trim() || isBusy;

  const handleSubmit = async () => {
    const title = value.trim();
    if (!title || isBusy) {
      return;
    }

    const saved = await (
      subTodo == null
        ? addSubTodo.mutateAsync({ todoId: todo.id, title, startDate: todo.startDate })
        : updateSubTodo.mutateAsync({
            todoId: todo.id,
            subTodoId: subTodo.id,
            title,
            startDate: todo.startDate,
          })
    ).catch(() => null);

    if (saved == null) {
      return;
    }

    if (subTodo == null) {
      setValue('');
    }
    onClose();
  };

  const handleDelete = async (target: SubTodo) => {
    if (isBusy) {
      return;
    }

    const removed = await deleteSubTodo
      .mutateAsync({ todoId: todo.id, subTodoId: target.id, startDate: todo.startDate })
      .catch(() => null);

    if (removed != null) {
      onClose();
    }
  };

  return (
    <VStack gap={12}>
      <BottomSheetInput
        ref={inputRef}
        testID="sub-todo-input"
        autoFocus
        placeholder={tGlobal('todo:subTodo.placeholder')}
        value={value}
        onChange={setValue}
        maxLength={200}
        size="medium"
        renderErrorMessage={false}
        returnKeyType="done"
        onSubmitEditing={isSubmitDisabled ? onClose : handleSubmit}
      />

      <Box className="h-px bg-gray-2" />

      <HStack gap={8} align="center">
        {subTodo != null && (
          <PressableFeedback
            testID="sub-todo-delete"
            onPress={() => handleDelete(subTodo)}
            isDisabled={isBusy}
            className="size-9 items-center justify-center rounded-full bg-error/10"
          >
            <TrashIcon
              width={fontScaledSize(18)}
              height={fontScaledSize(18)}
              colorClassName="text-error"
            />
          </PressableFeedback>
        )}

        <Box className="flex-1" />

        <SpeechTooltip />
        <SpeechButton onResult={setValue} />
        <PressableFeedback
          testID="sub-todo-submit"
          isDisabled={isSubmitDisabled}
          onPress={handleSubmit}
          style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
          className={cn(
            'items-center justify-center rounded-4xl',
            isSubmitDisabled ? 'bg-gray-3' : 'bg-main',
          )}
        >
          {isSubmitting ? (
            <Spinner
              size="sm"
              color={typeof spinnerColor === 'string' ? spinnerColor : undefined}
            />
          ) : (
            <ArrowUpIcon
              width={fontScaledSize(18)}
              height={fontScaledSize(18)}
              colorClassName="text-white"
            />
          )}
        </PressableFeedback>
      </HStack>
    </VStack>
  );
}

function SpeechTooltip() {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('todo');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <PressableFeedback onPress={() => setIsOpen(true)} className="items-center justify-center">
          <HStack gap={4} align="center">
            <Text size="e2" weight="medium" shade={6}>
              {t('subTodo.voiceInput')}
            </Text>

            <InfoIcon
              width={fontScaledSize(16)}
              height={fontScaledSize(16)}
              colorClassName="text-gray-6"
            />
          </HStack>
        </PressableFeedback>
      </Popover.Trigger>
      <Popover.Portal disableFullWindowOverlay={false}>
        <Popover.Overlay />
        <Popover.Content
          presentation="popover"
          placement="top"
          align="end"
          avoidCollisions={false}
          className="rounded-2xl border border-border px-4 py-3"
        >
          <Popover.Arrow />
          <VStack gap={4}>
            <HStack gap={4} align="center">
              <MicIcon
                width={fontScaledSize(18)}
                height={fontScaledSize(18)}
                colorClassName="text-main"
              />

              <Text size="b3" weight="semibold">
                {t('subTodo.voiceTitle')}
              </Text>
            </HStack>

            <Text size="b3" shade={6}>
              {t('subTodo.voiceHint')}
            </Text>
          </VStack>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}

interface SpeechButtonProps {
  onResult: (text: string) => void;
}

function SpeechButton({ onResult }: SpeechButtonProps) {
  const fontScaledSize = useFontScaledSize();
  const toast = useAppToast();

  const { isRecognizing, start, stop } = useSpeechRecognition({
    onResult,
    onEnd: () => {},
    onError: toast.error,
  });

  const handlePress = () => {
    if (isRecognizing) {
      stop();
      return;
    }
    Keyboard.dismiss();
    start();
  };

  return (
    <PressableFeedback
      onPress={handlePress}
      style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
      className="items-center justify-center rounded-full bg-main/10"
    >
      {isRecognizing ? (
        <PauseIcon
          width={fontScaledSize(20)}
          height={fontScaledSize(20)}
          colorClassName="text-error"
        />
      ) : (
        <MicIcon
          width={fontScaledSize(20)}
          height={fontScaledSize(20)}
          colorClassName="text-main"
        />
      )}
    </PressableFeedback>
  );
}
