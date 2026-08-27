import { zodResolver } from '@hookform/resolvers/zod';
import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { isApiError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { Box, Button, HStack, SendIcon, Text, TextArea, TextButton, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  FormProvider,
  useController,
  useFieldArray,
  useForm,
  useFormContext,
  useFormState,
} from 'react-hook-form';
import { ScrollView, useWindowDimensions } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';

import type { TodoCommentAuthor, TodoComment } from '../../../models/todo-comment.model';
import { TodoCommentDraftPolicy } from '../../../models/todo-comment.model';
import { COMMENT_COMPOSER_INPUT_NATIVE_ID } from '../../constants/comment-composer.constants';
import { useCommentRouteState } from '../../hooks/use-comment-route-state';
import { useIsTodoCommentComposerMutating } from '../../hooks/use-is-todo-comment-composer-mutating';
import { useCancelTodoCommentScreenTransition } from '../../providers/todo-comment-screen-transition';
import { useUpdateTodoCommentMutationOptions } from '../../queries/use-update-todo-comment-mutation-options';
import { useWriteTodoCommentsMutationOptions } from '../../queries/use-write-todo-comments-mutation-options';
import {
  type TodoCommentFormInput,
  todoCommentFormSchema,
} from '../../schemas/todo-comment-form.schema';
import { getCommentComposerChainFieldLayout } from '../../utils/comment-composer-chain-layout';
import { getFocusedCommentFieldIndexAfterRemoval } from '../../utils/comment-composer-fields';
import { getCommentComposerMaxHeight } from '../../utils/comment-composer-layout';
import {
  closeMountedCommentComposerSession,
  runCommentComposerSubmissionOnce,
} from '../../utils/comment-composer-submission';
import {
  getWriteTodoCommentsCommand,
  type WriteTodoCommentsCommand,
} from '../../utils/todo-comment-write-command';
import type { TodoCommentComposerSession } from '../../view-models/todo-comment-composer.view-model';
import { TodoCommentAuthorAvatar } from '../TodoCommentAuthorAvatar';

const TARGET_CONTENT_MAX_LINES = 2;
const SEND_ICON_SIZE = 18;
const TEXT_ACTION_TOUCH_TARGET = 'min-h-11 min-w-11';

interface TodoCommentComposerFormProps extends Omit<
  ComponentProps<typeof ScrollView>,
  'children' | 'keyboardShouldPersistTaps' | 'nestedScrollEnabled' | 'showsVerticalScrollIndicator'
> {
  session: TodoCommentComposerSession;
  author: TodoCommentAuthor;
}

export function TodoCommentComposerForm({
  session,
  author,
  style,
  ...scrollViewProps
}: TodoCommentComposerFormProps) {
  const { t } = useTranslation('todoComment');
  const { isSubmitting, submissionGate, close, submitContents } =
    useTodoCommentComposerSubmission(session);
  const { height: viewportHeight } = useWindowDimensions();
  const isEditing = session.mode === 'edit';
  const target = session.mode === 'create' ? null : session.target;
  const initialContent = isEditing ? (session.target.content ?? '') : '';
  const form = useForm<TodoCommentFormInput>({
    resolver: zodResolver(todoCommentFormSchema),
    defaultValues: { items: [{ content: initialContent }] },
    mode: 'onChange',
  });
  const { control, handleSubmit, setFocus } = form;
  const { append, remove, fields } = useFieldArray({
    control,
    name: 'items',
  });
  const { focusedFieldIndex, trackFocusedField, focusFieldAfterLayout, removeFieldAndFocusNext } =
    useCommentComposerFieldFocus({ remove, setFocus });
  const showsAppendAction = !isEditing && TodoCommentDraftPolicy.hasCapacity(fields.length);
  const composerMaxHeight = getCommentComposerMaxHeight(viewportHeight);

  const handleFormSubmit = handleSubmit(({ items }) =>
    runCommentComposerSubmissionOnce({
      gate: submissionGate,
      operation: () => submitContents(items.map((item) => item.content.trim())),
    }),
  );

  return (
    <FormProvider {...form}>
      <ScrollView
        {...scrollViewProps}
        style={[{ maxHeight: composerMaxHeight }, style]}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
        showsVerticalScrollIndicator={fields.length > 2 || target !== null}
      >
        <VStack gap={8}>
          {target !== null && (
            <ComposerTargetContext
              target={target}
              isEditing={isEditing}
              isSubmitting={isSubmitting}
              onRequestClose={close}
            />
          )}

          <CommentDraftChain>
            {fields.map((field, index) => {
              const fieldLayout = getCommentComposerChainFieldLayout(index, fields.length);

              return (
                <CommentDraftChain.Field
                  key={field.id}
                  author={author}
                  connectsToNext={fieldLayout.connectsToNext}
                  input={
                    <CommentComposerField
                      name={`items.${index}.content`}
                      index={index}
                      fieldCount={fields.length}
                      session={session}
                      isEditing={isEditing}
                      isFocused={focusedFieldIndex === index}
                      isSubmitting={isSubmitting}
                      onFocus={() => trackFocusedField(index)}
                    />
                  }
                  removeAction={
                    fieldLayout.showsRemoveAction && (
                      <TextButton
                        size="xsmall"
                        className={TEXT_ACTION_TOUCH_TARGET}
                        isDisabled={isSubmitting}
                        onPress={() => removeFieldAndFocusNext(index)}
                        accessibilityLabel={t('composer.removeFromChain', { index: index + 1 })}
                      >
                        {t('composer.remove')}
                      </TextButton>
                    )
                  }
                  appendAction={
                    fieldLayout.showsSubmissionActions &&
                    showsAppendAction && (
                      <ComposerAppendButton
                        isSubmitting={isSubmitting}
                        onPress={() => {
                          const nextFieldIndex = fields.length;
                          append({ content: '' });
                          focusFieldAfterLayout(nextFieldIndex);
                        }}
                      />
                    )
                  }
                  submitAction={
                    fieldLayout.showsSubmissionActions && (
                      <ComposerSubmitButton
                        isEditing={isEditing}
                        isSubmitting={isSubmitting}
                        onSubmit={handleFormSubmit}
                      />
                    )
                  }
                />
              );
            })}
          </CommentDraftChain>
        </VStack>
      </ScrollView>
    </FormProvider>
  );
}

function useTodoCommentComposerSubmission(session: TodoCommentComposerSession) {
  const { todoId } = useTodoScreenParams();
  const { closeComposer } = useCommentRouteState();
  const cancelTransition = useCancelTodoCommentScreenTransition();
  const isSubmitting = useIsTodoCommentComposerMutating();
  const updateComment = useMutation(useUpdateTodoCommentMutationOptions(todoId));
  const writeComments = useMutation(useWriteTodoCommentsMutationOptions(todoId));
  const mountedSessionRef = useRef(true);
  const submissionGate = useRef(false);
  const writeCommandRef = useRef<WriteTodoCommentsCommand | null>(null);

  const close = useCallback(() => {
    cancelTransition();
    KeyboardController.dismiss({ animated: false }).catch(() => undefined);
    closeComposer();
  }, [cancelTransition, closeComposer]);

  useEffect(() => {
    mountedSessionRef.current = true;
    return () => {
      mountedSessionRef.current = false;
    };
  }, []);

  const submitContents = async (contents: string[]) => {
    if (session.mode === 'edit') {
      const [content] = contents;
      if (content === undefined) {
        return;
      }

      try {
        await updateComment.mutateAsync({
          commentId: session.target.id,
          input: { content },
        });
        closeMountedCommentComposerSession({ session: mountedSessionRef, onClose: close });
      } catch {
        return;
      }
      return;
    }

    const [first, ...rest] = contents;
    if (first === undefined) {
      return;
    }

    const parent = session.mode === 'reply' ? session.target : null;
    const command = getWriteTodoCommentsCommand(writeCommandRef.current, todoId, parent, [
      first,
      ...rest,
    ]);
    writeCommandRef.current = command;

    try {
      await writeComments.mutateAsync(command.variables);
      writeCommandRef.current = null;
      closeMountedCommentComposerSession({ session: mountedSessionRef, onClose: close });
    } catch (error) {
      if (isApiError(error) && error.status >= 400 && error.status < 500) {
        writeCommandRef.current = null;
      }
    }
  };

  return { isSubmitting, submissionGate, close, submitContents };
}

type CommentFieldName = `items.${number}.content`;

function CommentComposerField({
  name,
  index,
  fieldCount,
  session,
  isEditing,
  isFocused,
  isSubmitting,
  onFocus,
}: {
  name: CommentFieldName;
  index: number;
  fieldCount: number;
  session: TodoCommentComposerSession;
  isEditing: boolean;
  isFocused: boolean;
  isSubmitting: boolean;
  onFocus: () => void;
}) {
  const { t } = useTranslation('todoComment');
  const { control } = useFormContext<TodoCommentFormInput>();
  const {
    field: { value, onChange, onBlur, ref },
    fieldState: { error },
  } = useController({ control, name });

  return (
    <TextArea
      ref={ref}
      nativeID={isFocused ? COMMENT_COMPOSER_INPUT_NATIVE_ID : undefined}
      testID={`comment-composer-input-${index}`}
      value={value}
      onChangeText={onChange}
      onBlur={onBlur}
      onFocus={onFocus}
      isDisabled={isSubmitting}
      isInvalid={error !== undefined}
      variant="plain"
      textSize="b3"
      preserveErrorSpace={false}
      errorMessage={resolveValidationMessage(error, {
        default: 'comment.required',
        byType: { too_big: 'comment.tooLong' },
      })}
      growsWithContent
      placeholder={
        index > 0
          ? t('composer.chainPlaceholder')
          : isEditing
            ? t('input.editPlaceholder')
            : session.mode === 'reply'
              ? t('input.replyPlaceholder')
              : t('input.placeholder')
      }
      accessibilityLabel={t('composer.inputLabel', { index: index + 1, count: fieldCount })}
      className="min-h-11 max-h-28"
    />
  );
}

function ComposerAppendButton({
  isSubmitting,
  onPress,
}: {
  isSubmitting: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation('todoComment');
  const { isValid } = useFormState<TodoCommentFormInput>();

  return (
    <TextButton
      size="small"
      className={cn(TEXT_ACTION_TOUCH_TARGET, 'max-w-full self-start')}
      isDisabled={!isValid || isSubmitting}
      onPress={onPress}
      accessibilityLabel={t('composer.addToChain')}
    >
      {t('composer.addToChain')}
    </TextButton>
  );
}

function ComposerSubmitButton({
  isEditing,
  isSubmitting,
  onSubmit,
}: {
  isEditing: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  const { t } = useTranslation('todoComment');
  const { isValid } = useFormState<TodoCommentFormInput>();

  return (
    <Button
      testID="comment-composer-post"
      size="medium"
      display="inline"
      radius="full"
      className="min-h-11 min-w-11 px-0"
      isDisabled={!isValid || isSubmitting}
      isLoading={isSubmitting}
      onPress={onSubmit}
      accessibilityLabel={isEditing ? t('actions.save') : t('composer.post')}
    >
      <SendIcon
        width={SEND_ICON_SIZE}
        height={SEND_ICON_SIZE}
        colorClassName="text-white dark:text-gray-9"
      />
    </Button>
  );
}

interface CommentComposerFieldFocusOptions {
  remove: (index: number) => void;
  setFocus: (name: CommentFieldName) => void;
}

function useCommentComposerFieldFocus({ remove, setFocus }: CommentComposerFieldFocusOptions) {
  const [focusedFieldIndex, setFocusedFieldIndex] = useState(0);
  const pendingFocusFrameRef = useRef<number | null>(null);

  const cancelPendingFocus = useCallback(() => {
    if (pendingFocusFrameRef.current !== null) {
      cancelAnimationFrame(pendingFocusFrameRef.current);
      pendingFocusFrameRef.current = null;
    }
  }, []);

  const focusFieldAfterLayout = useCallback(
    (index: number) => {
      cancelPendingFocus();
      setFocusedFieldIndex(index);
      pendingFocusFrameRef.current = requestAnimationFrame(() => {
        pendingFocusFrameRef.current = null;
        setFocus(`items.${index}.content`);
      });
    },
    [cancelPendingFocus, setFocus],
  );

  useEffect(() => {
    focusFieldAfterLayout(0);
    return cancelPendingFocus;
  }, [cancelPendingFocus, focusFieldAfterLayout]);

  const trackFocusedField = (index: number) => {
    cancelPendingFocus();
    setFocusedFieldIndex(index);
  };

  const removeFieldAndFocusNext = (removedIndex: number) => {
    const nextFocusedIndex = getFocusedCommentFieldIndexAfterRemoval(
      focusedFieldIndex,
      removedIndex,
    );
    remove(removedIndex);
    focusFieldAfterLayout(nextFocusedIndex);
  };

  return {
    focusedFieldIndex,
    trackFocusedField,
    focusFieldAfterLayout,
    removeFieldAndFocusNext,
  };
}

function ComposerTargetContext({
  target,
  isEditing,
  isSubmitting,
  onRequestClose,
}: {
  target: TodoComment;
  isEditing: boolean;
  isSubmitting: boolean;
  onRequestClose: () => void;
}) {
  const { t } = useTranslation('todoComment');
  const targetName = target.author?.name ?? t('list.unknownUser');

  return (
    <VStack gap={2} px={4}>
      <HStack align="center" justify="between" gap={8}>
        <Text size="e1" shade={6} weight="medium" maxLines={2} className="flex-1">
          {isEditing ? t('composer.editingComment') : t('input.replyingTo', { name: targetName })}
        </Text>
        <TextButton
          size="xsmall"
          className={cn(TEXT_ACTION_TOUCH_TARGET, 'shrink-0')}
          isDisabled={isSubmitting}
          onPress={onRequestClose}
          accessibilityLabel={t('actions.cancel')}
        >
          {t('actions.cancel')}
        </TextButton>
      </HStack>
      {!isEditing && (
        <Text
          size="b4"
          shade={7}
          maxLines={TARGET_CONTENT_MAX_LINES}
          accessibilityLabel={target.content ?? t('list.deleted')}
        >
          {target.content ?? t('list.deleted')}
        </Text>
      )}
    </VStack>
  );
}

interface CommentDraftChainProps extends Omit<ComponentProps<typeof VStack>, 'children' | 'gap'> {
  children: ReactNode;
}

interface CommentDraftChainFieldProps extends Omit<ComponentProps<typeof Box>, 'children'> {
  author: TodoCommentAuthor;
  input: ReactNode;
  connectsToNext: boolean;
  removeAction?: ReactNode;
  appendAction?: ReactNode;
  submitAction?: ReactNode;
}

function CommentDraftChain({ children, className, ...stackProps }: CommentDraftChainProps) {
  return (
    <VStack
      {...stackProps}
      gap={8}
      className={cn('min-w-0 rounded-3xl bg-gray-2 px-3 py-3', className)}
    >
      {children}
    </VStack>
  );
}

CommentDraftChain.Field = function Field({
  author,
  input,
  connectsToNext,
  removeAction,
  appendAction,
  submitAction,
  className,
  ...boxProps
}: CommentDraftChainFieldProps) {
  const showsSubmissionActions = appendAction !== undefined || submitAction !== undefined;

  return (
    <Box {...boxProps} className={cn('relative min-w-0', className)}>
      {connectsToNext && (
        <Box
          testID="comment-composer-chain-connector"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute left-[13.5px] top-8 -bottom-2 w-px bg-gray-4"
        />
      )}

      <HStack gap={8} align="start" className="min-w-0">
        <Box className="relative z-10 w-7 shrink-0">
          <TodoCommentAuthorAvatar
            testID="comment-composer-chain-avatar"
            author={author}
            size="sm"
          />
        </Box>

        <VStack flex={1} gap={4} className="min-w-0">
          <HStack gap={4} align="start" className="min-w-0">
            <Box flex={1} className="min-w-0">
              {input}
            </Box>
            {removeAction !== undefined && <Box className="shrink-0">{removeAction}</Box>}
          </HStack>

          {showsSubmissionActions && (
            <HStack
              testID="comment-composer-chain-actions"
              gap={4}
              align="center"
              justify="between"
              className="min-w-0"
            >
              <Box flex={1} className="min-w-0">
                {appendAction}
              </Box>
              {submitAction !== undefined && <Box className="shrink-0">{submitAction}</Box>}
            </HStack>
          )}
        </VStack>
      </HStack>
    </Box>
  );
};
