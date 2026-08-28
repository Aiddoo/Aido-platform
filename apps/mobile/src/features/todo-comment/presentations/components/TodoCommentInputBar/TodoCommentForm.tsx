import { zodResolver } from '@hookform/resolvers/zod';
import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { isApiError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { Box, Button, HStack, SendIcon, Text, TextArea, TextButton, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
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
import { TODO_COMMENT_INPUT_NATIVE_ID } from '../../constants/todo-comment-input.constants';
import { useIsTodoCommentSubmitting } from '../../hooks/use-is-todo-comment-submitting';
import { useTodoCommentRoute } from '../../hooks/use-todo-comment-route';
import { useCancelTodoCommentScreenTransition } from '../../providers/todo-comment-screen-transition-provider';
import { useCreateTodoCommentChainMutationOptions } from '../../queries/use-create-todo-comment-chain-mutation-options';
import { useUpdateTodoCommentMutationOptions } from '../../queries/use-update-todo-comment-mutation-options';
import {
  type TodoCommentFormInput,
  todoCommentFormSchema,
} from '../../schemas/todo-comment-form.schema';
import { getCommentFormChainFieldLayout } from '../../utils/comment-form-chain-layout';
import { getFocusedCommentFieldIndexAfterRemoval } from '../../utils/comment-form-fields';
import { getCommentFormMaxHeight } from '../../utils/comment-form-layout';
import {
  prepareTodoCommentSubmission,
  type PreparedTodoCommentSubmission,
} from '../../utils/todo-comment-submission';
import type { TodoCommentFormSession } from '../../view-models/todo-comment-form.view-model';
import { TodoCommentAuthorAvatar } from '../TodoCommentAuthorAvatar';

const TARGET_CONTENT_MAX_LINES = 2;
const SEND_ICON_SIZE = 18;
const TEXT_ACTION_TOUCH_TARGET = 'min-h-11 min-w-11';

interface TodoCommentFormProps extends Omit<
  ComponentProps<typeof ScrollView>,
  'children' | 'keyboardShouldPersistTaps' | 'nestedScrollEnabled' | 'showsVerticalScrollIndicator'
> {
  session: TodoCommentFormSession;
  author: TodoCommentAuthor;
}

export function TodoCommentForm({
  session,
  author,
  style,
  ...scrollViewProps
}: TodoCommentFormProps) {
  const { t } = useTranslation('todoComment');
  const { isSubmitting, cancel, submit } = useTodoCommentFormSubmission(session);
  const { height: viewportHeight } = useWindowDimensions();
  const isEditing = session.type === 'edit';
  const target = session.type === 'new' ? null : session.target;
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
    useCommentFormFieldFocus({ remove, setFocus });
  const showsAppendAction = !isEditing && TodoCommentDraftPolicy.hasCapacity(fields.length);
  const formMaxHeight = getCommentFormMaxHeight(viewportHeight);

  const handleFormSubmit = handleSubmit(({ items }) =>
    submit(items.map((item) => item.content.trim())),
  );

  return (
    <FormProvider {...form}>
      <ScrollView
        {...scrollViewProps}
        style={[{ maxHeight: formMaxHeight }, style]}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
        showsVerticalScrollIndicator={fields.length > 2 || target !== null}
      >
        <VStack gap={8}>
          {target !== null && (
            <CommentTargetPreview
              target={target}
              isEditing={isEditing}
              isSubmitting={isSubmitting}
              onRequestClose={cancel}
            />
          )}

          <CommentFormFields>
            {fields.map((field, index) => {
              const fieldLayout = getCommentFormChainFieldLayout(index, fields.length);

              return (
                <CommentFormFields.Field
                  key={field.id}
                  author={author}
                  connectsToNext={fieldLayout.connectsToNext}
                  input={
                    <CommentFormField
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
                        accessibilityLabel={t('form.removeFromChain', { index: index + 1 })}
                      >
                        {t('form.remove')}
                      </TextButton>
                    )
                  }
                  appendAction={
                    fieldLayout.showsSubmissionActions &&
                    showsAppendAction && (
                      <AppendCommentButton
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
                      <CommentSubmitButton
                        isEditing={isEditing}
                        isSubmitting={isSubmitting}
                        onSubmit={handleFormSubmit}
                      />
                    )
                  }
                />
              );
            })}
          </CommentFormFields>
        </VStack>
      </ScrollView>
    </FormProvider>
  );
}

function useTodoCommentFormSubmission(session: TodoCommentFormSession) {
  const { todoId } = useTodoScreenParams();
  const [, updateCommentRoute] = useTodoCommentRoute();
  const cancelPendingTransition = useCancelTodoCommentScreenTransition();
  const isSubmitting = useIsTodoCommentSubmitting();
  const updateComment = useMutation(useUpdateTodoCommentMutationOptions({ todoId }));
  const createCommentChain = useMutation(useCreateTodoCommentChainMutationOptions({ todoId }));
  const isMountedRef = useRef(true);
  const isSubmittingRef = useRef(false);
  const preparedSubmissionRef = useRef<PreparedTodoCommentSubmission | null>(null);

  const dismissKeyboard = useCallback(() => {
    KeyboardController.dismiss({ animated: false }).catch(() => undefined);
  }, []);

  const cancel = useCallback(() => {
    cancelPendingTransition();
    dismissKeyboard();
    updateCommentRoute.cancelForm();
  }, [cancelPendingTransition, dismissKeyboard, updateCommentRoute]);

  const complete = useCallback(() => {
    cancelPendingTransition();
    dismissKeyboard();
    updateCommentRoute.completeForm();
  }, [cancelPendingTransition, dismissKeyboard, updateCommentRoute]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const submit = useCallback(
    async (contents: string[]) => {
      if (isSubmittingRef.current) {
        return;
      }

      isSubmittingRef.current = true;
      try {
        if (session.type === 'edit') {
          const [content] = contents;
          if (content === undefined) {
            return;
          }

          await updateComment.mutateAsync({
            commentId: session.target.id,
            input: { content },
          });

          if (isMountedRef.current) {
            complete();
          }
          return;
        }

        const [firstContent, ...remainingContents] = contents;
        if (firstContent === undefined) {
          return;
        }

        const submission = prepareTodoCommentSubmission({
          previousSubmission: preparedSubmissionRef.current,
          todoId,
          parentId: session.type === 'reply' ? session.target.id : null,
          contents: [firstContent, ...remainingContents],
          createClientRequestId: Crypto.randomUUID,
        });
        preparedSubmissionRef.current = submission;

        await createCommentChain.mutateAsync(submission.input);
        preparedSubmissionRef.current = null;

        if (isMountedRef.current) {
          complete();
        }
      } catch (error) {
        if (isApiError(error) && error.status >= 400 && error.status < 500) {
          preparedSubmissionRef.current = null;
        }
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [complete, createCommentChain, session, todoId, updateComment],
  );

  return { isSubmitting, cancel, submit };
}

type CommentFieldName = `items.${number}.content`;

function CommentFormField({
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
  session: TodoCommentFormSession;
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
      nativeID={isFocused ? TODO_COMMENT_INPUT_NATIVE_ID : undefined}
      testID={`todo-comment-input-${index}`}
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
          ? t('form.chainPlaceholder')
          : isEditing
            ? t('input.editPlaceholder')
            : session.type === 'reply'
              ? t('input.replyPlaceholder')
              : t('input.placeholder')
      }
      accessibilityLabel={t('form.inputLabel', { index: index + 1, count: fieldCount })}
      className="min-h-11 max-h-28"
    />
  );
}

function AppendCommentButton({
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
      accessibilityLabel={t('form.addToChain')}
    >
      {t('form.addToChain')}
    </TextButton>
  );
}

function CommentSubmitButton({
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
      testID="todo-comment-submit"
      size="medium"
      display="inline"
      radius="full"
      className="min-h-11 min-w-11 px-0"
      isDisabled={!isValid || isSubmitting}
      isLoading={isSubmitting}
      onPress={onSubmit}
      accessibilityLabel={isEditing ? t('actions.save') : t('form.post')}
    >
      <SendIcon
        width={SEND_ICON_SIZE}
        height={SEND_ICON_SIZE}
        colorClassName="text-white dark:text-gray-9"
      />
    </Button>
  );
}

interface CommentFormFieldFocusOptions {
  remove: (index: number) => void;
  setFocus: (name: CommentFieldName) => void;
}

function useCommentFormFieldFocus({ remove, setFocus }: CommentFormFieldFocusOptions) {
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

function CommentTargetPreview({
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
          {isEditing ? t('form.editingComment') : t('input.replyingTo', { name: targetName })}
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

interface CommentFormFieldsProps extends Omit<ComponentProps<typeof VStack>, 'children' | 'gap'> {
  children: ReactNode;
}

interface CommentFormFieldRowProps extends Omit<ComponentProps<typeof Box>, 'children'> {
  author: TodoCommentAuthor;
  input: ReactNode;
  connectsToNext: boolean;
  removeAction?: ReactNode;
  appendAction?: ReactNode;
  submitAction?: ReactNode;
}

function CommentFormFields({ children, className, ...stackProps }: CommentFormFieldsProps) {
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

CommentFormFields.Field = function Field({
  author,
  input,
  connectsToNext,
  removeAction,
  appendAction,
  submitAction,
  className,
  ...boxProps
}: CommentFormFieldRowProps) {
  const showsSubmissionActions = appendAction !== undefined || submitAction !== undefined;

  return (
    <Box {...boxProps} className={cn('relative min-w-0', className)}>
      {connectsToNext && (
        <Box
          testID="todo-comment-form-connector"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute left-[13.5px] top-8 -bottom-2 w-px bg-gray-4"
        />
      )}

      <HStack gap={8} align="start" className="min-w-0">
        <Box className="relative z-10 w-7 shrink-0">
          <TodoCommentAuthorAvatar testID="todo-comment-form-avatar" author={author} size="sm" />
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
              testID="todo-comment-form-actions"
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
