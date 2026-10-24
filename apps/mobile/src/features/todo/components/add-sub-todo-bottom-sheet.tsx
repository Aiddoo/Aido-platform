import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
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
  Text,
  TrashIcon,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation } from '@tanstack/react-query';
import { Popover, PressableFeedback, Spinner } from 'heroui-native';
import type { ComponentRef } from 'react';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { Keyboard } from 'react-native';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import type { SubTodo } from '../domains/sub-todo.model';
import type { Todo } from '../domains/todo.model';
import { useAddSubTodoMutationOptions } from '../queries/use-add-sub-todo-mutation-options';
import { useDeleteSubTodoMutationOptions } from '../queries/use-delete-sub-todo-mutation-options';
import { useUpdateSubTodoMutationOptions } from '../queries/use-update-sub-todo-mutation-options';

interface BaseProps {
  todo: Todo;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
}

interface CreateProps extends BaseProps {
  mode: 'create';
}

interface EditProps extends BaseProps {
  mode: 'edit';
  subTodo: SubTodo;
}

type AddSubTodoBottomSheetProps = CreateProps | EditProps;

export function AddSubTodoBottomSheet(props: AddSubTodoBottomSheetProps) {
  const fontScaledSize = useFontScaledSize();
  const { color: spinnerColor } = useResolveClassNames('text-white');
  const { todo, isOpen, onOpenChange, onClose } = props;

  const defaultValue = match(props)
    .with({ mode: 'edit' }, ({ subTodo }) => subTodo.title)
    .with({ mode: 'create' }, () => '')
    .exhaustive();

  const [value, setValue] = useState(defaultValue);
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

    const saved = await match(props)
      .with({ mode: 'create' }, () =>
        addSubTodo.mutateAsync({ todoId: todo.id, title, startDate: todo.startDate }),
      )
      .with({ mode: 'edit' }, ({ subTodo }) =>
        updateSubTodo.mutateAsync({
          todoId: todo.id,
          subTodoId: subTodo.id,
          title,
          startDate: todo.startDate,
        }),
      )
      .exhaustive()
      .catch(() => null);

    if (saved == null) {
      return;
    }

    if (props.mode === 'create') {
      setValue('');
    }
    onClose();
  };

  const handleDelete = async (subTodo: SubTodo) => {
    if (isBusy) {
      return;
    }

    const removed = await deleteSubTodo
      .mutateAsync({ todoId: todo.id, subTodoId: subTodo.id, startDate: todo.startDate })
      .catch(() => null);

    if (removed != null) {
      onClose();
    }
  };

  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
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
          {props.mode === 'edit' && (
            <PressableFeedback
              testID="sub-todo-delete"
              onPress={() => handleDelete(props.subTodo)}
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
    </KeyboardBottomSheet>
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
