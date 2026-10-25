import { zodResolver } from '@hookform/resolvers/zod';
import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { isApiError } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { Box, Button, HStack, SendIcon, Text, TextArea, TextButton, VStack } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
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
  useFieldArray,
  useForm,
  useFormContext,
  useFormState,
} from 'react-hook-form';
import { ScrollView, useWindowDimensions } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';
import { match } from 'ts-pattern';

import { TODO_COMMENT_INPUT_NATIVE_ID } from '../../constants/todo-comment-input';
import {
  type TodoCommentFormInput,
  todoCommentFormSchema,
} from '../../domains/todo-comment-form.schema';
import type { TodoCommentAuthor, TodoComment } from '../../domains/todo-comment.model';
import { TodoCommentDraftPolicy } from '../../domains/todo-comment.model';
import { useIsTodoCommentSubmitting } from '../../hooks/use-is-todo-comment-submitting';
import { usePrepareTodoCommentConversation } from '../../hooks/use-prepare-todo-comment-conversation';
import { useTodoCommentRoute } from '../../hooks/use-todo-comment-route';
import { useCreateTodoCommentChainMutationOptions } from '../../queries/use-create-todo-comment-chain-mutation-options';
import { useUpdateTodoCommentMutationOptions } from '../../queries/use-update-todo-comment-mutation-options';
import { getCommentFormChainFieldLayout } from '../../utils/comment-form-chain-layout';
import { getFocusedCommentFieldIndexAfterRemoval } from '../../utils/comment-form-fields';
import { getCommentFormMaxHeight } from '../../utils/comment-form-layout';
import {
  createTodoCommentDraftKey,
  getTodoCommentDraftSourceUpdatedAt,
} from '../../utils/todo-comment-draft';
import {
  prepareTodoCommentSubmission,
  type PreparedTodoCommentSubmission,
} from '../../utils/todo-comment-submission';
import type { TodoCommentFormSession } from '../../utils/view-models/todo-comment-form.view-model';
import { useHasEnteredTodoCommentScreen } from '../providers/todo-comment-presentation-provider';
import { useCancelTodoCommentScreenTransition } from '../providers/todo-comment-screen-transition-provider';
import { TodoCommentAuthorAvatar } from '../todo-comment-author-avatar';

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
  const toast = useAppToast();
  const { todoId } = useTodoScreenParams();
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const { height: viewportHeight } = useWindowDimensions();
  const isEditing = session.type === 'edit';
  const target = session.type === 'new' ? null : session.target;
  const initialValues = { items: [{ content: isEditing ? (session.target.content ?? '') : '' }] };
  const {
    restoredDraft: restoredCommentDraft,
    saveDraft: saveCommentDraft,
    clearDraft: clearCommentDraft,
  } = useDraftStorage(createTodoCommentDraftKey({ userId: user.id, todoId, session }), {
    sourceUpdatedAt: getTodoCommentDraftSourceUpdatedAt(session),
    onOutdatedDiscard: () => toast.warning(t('toasts.draftOutdated')),
  });
  const form = useForm({
    resolver: zodResolver(todoCommentFormSchema),
    defaultValues: restoredCommentDraft ?? initialValues,
    mode: 'onChange',
  });
  const { control, handleSubmit, setFocus, subscribe } = form;
  const discardCommentDraft = useFormDraftAutosave(subscribe, {
    initialValues,
    saveDraft: saveCommentDraft,
    clearDraft: clearCommentDraft,
  });
  const { isSubmitting, cancel, submit } = useTodoCommentFormSubmission(session, {
    onFinish: discardCommentDraft,
  });
  const { append, remove, fields } = useFieldArray({
    control,
    name: 'items',
  });
  const { focusedFieldIndex, trackFocusedField, focusFieldAfterLayout, removeFieldAndFocusNext } =
    useCommentFormFieldFocus({
      remove,
      setFocus,
      initialFieldIndex: (restoredCommentDraft?.items.length ?? 1) - 1,
    });
  const canAppendField = !isEditing && TodoCommentDraftPolicy.hasCapacity(fields.length);
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
        showsVerticalScrollIndicator={fields.length > 2 || target != null}
      >
        <VStack gap={8}>
          {target != null && (
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
                  isConnectedToNext={fieldLayout.isConnectedToNext}
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
                    fieldLayout.shouldShowRemoveAction ? (
                      <TextButton
                        size="xsmall"
                        className={TEXT_ACTION_TOUCH_TARGET}
                        isDisabled={isSubmitting}
                        onPress={() => removeFieldAndFocusNext(index)}
                        accessibilityLabel={t('form.removeFromChain', { index: index + 1 })}
                      >
                        {t('form.remove')}
                      </TextButton>
                    ) : undefined
                  }
                  appendAction={
                    fieldLayout.shouldShowSubmissionActions && canAppendField ? (
                      <AppendCommentButton
                        isSubmitting={isSubmitting}
                        onPress={() => {
                          const nextFieldIndex = fields.length;
                          append({ content: '' });
                          focusFieldAfterLayout(nextFieldIndex);
                        }}
                      />
                    ) : undefined
                  }
                  submitAction={
                    fieldLayout.shouldShowSubmissionActions ? (
                      <CommentSubmitButton
                        isEditing={isEditing}
                        isSubmitting={isSubmitting}
                        onSubmit={handleFormSubmit}
                      />
                    ) : undefined
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

interface TodoCommentFormSubmissionOptions {
  /** 제출 성공·명시적 취소로 작성을 끝낼 때 호출한다. 화면이 이미 사라졌어도 호출한다. */
  onFinish: () => void;
}

function useTodoCommentFormSubmission(
  session: TodoCommentFormSession,
  { onFinish }: TodoCommentFormSubmissionOptions,
) {
  const { todoId } = useTodoScreenParams();
  const [_commentRoute, updateCommentRoute] = useTodoCommentRoute();
  const cancelPendingTransition = useCancelTodoCommentScreenTransition();
  const prepareConversation = usePrepareTodoCommentConversation();
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
    onFinish();
    cancelPendingTransition();
    dismissKeyboard();
    updateCommentRoute.cancelForm();
  }, [cancelPendingTransition, dismissKeyboard, onFinish, updateCommentRoute]);

  const complete = useCallback(
    (focusCommentId?: string) => {
      cancelPendingTransition();
      dismissKeyboard();
      updateCommentRoute.completeForm(focusCommentId);
    },
    [cancelPendingTransition, dismissKeyboard, updateCommentRoute],
  );

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
          if (content == null) {
            return;
          }

          await updateComment.mutateAsync({
            commentId: session.target.id,
            input: { content },
          });
          onFinish();

          if (isMountedRef.current) {
            complete();
          }
          return;
        }

        const [firstContent, ...remainingContents] = contents;
        if (firstContent == null) {
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

        const chain = await createCommentChain.mutateAsync(submission.input);
        preparedSubmissionRef.current = null;
        onFinish();

        if (!isMountedRef.current) {
          return;
        }

        const postedReply = session.type === 'reply' ? chain.comments.at(-1) : undefined;
        if (postedReply == null) {
          complete();
          return;
        }

        // 새 답글을 focus한 대화 window를 먼저 확정하고 URL을 바꿔 목록이 skeleton 없이 그 답글로 이동한다.
        const hasPreparedReply = await prepareConversation(postedReply.id).then(
          () => true,
          () => false,
        );
        if (isMountedRef.current) {
          complete(hasPreparedReply ? postedReply.id : undefined);
        }
      } catch (error) {
        if (isApiError(error) && error.status >= 400 && error.status < 500) {
          preparedSubmissionRef.current = null;
        }
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [complete, createCommentChain, onFinish, prepareConversation, session, todoId, updateComment],
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
  return (
    <FormField control={control} name={name}>
      {({ value, onChange, onBlur, ref }, { error }) => (
        <TextArea
          ref={ref}
          nativeID={isFocused ? TODO_COMMENT_INPUT_NATIVE_ID : undefined}
          testID={`todo-comment-input-${index}`}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          isDisabled={isSubmitting}
          isInvalid={error != null}
          variant="plain"
          textSize="b3"
          preserveErrorSpace={false}
          errorMessage={resolveValidationMessage(error, {
            default: 'comment.required',
            byType: { too_big: 'comment.tooLong' },
          })}
          growsWithContent
          placeholder={match({ isChain: index > 0, isEditing, sessionType: session.type })
            .with({ isChain: true }, () => t('form.chainPlaceholder'))
            .with({ isEditing: true }, () => t('input.editPlaceholder'))
            .with({ sessionType: 'reply' }, () => t('input.replyPlaceholder'))
            .otherwise(() => t('input.placeholder'))}
          accessibilityLabel={t('form.inputLabel', { index: index + 1, count: fieldCount })}
          className="min-h-11 max-h-28"
        />
      )}
    </FormField>
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
      onPress={() => onSubmit()}
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
  /** 복원한 초안은 마지막으로 쓰던 이어 쓰기 칸에서 이어 쓴다. */
  initialFieldIndex: number;
}

function useCommentFormFieldFocus({
  remove,
  setFocus,
  initialFieldIndex,
}: CommentFormFieldFocusOptions) {
  const [mountedFieldIndex] = useState(initialFieldIndex);
  const [focusedFieldIndex, setFocusedFieldIndex] = useState(mountedFieldIndex);
  const hasEnteredScreen = useHasEnteredTodoCommentScreen();
  const pendingFocusFrameRef = useRef<number | null>(null);

  const cancelPendingFocus = useCallback(() => {
    if (pendingFocusFrameRef.current != null) {
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
    if (!hasEnteredScreen) {
      return;
    }
    focusFieldAfterLayout(mountedFieldIndex);
    return cancelPendingFocus;
  }, [cancelPendingFocus, focusFieldAfterLayout, hasEnteredScreen, mountedFieldIndex]);

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

interface CommentFormFieldsProps {
  children: ReactNode;
}

interface CommentFormFieldRowProps {
  author: TodoCommentAuthor;
  input: ReactNode;
  isConnectedToNext: boolean;
  removeAction?: ReactNode;
  appendAction?: ReactNode;
  submitAction?: ReactNode;
}

function CommentFormFields({ children }: CommentFormFieldsProps) {
  return (
    <VStack gap={8} className="min-w-0 rounded-3xl bg-gray-2 px-3 py-3">
      {children}
    </VStack>
  );
}

CommentFormFields.Field = function Field({
  author,
  input,
  isConnectedToNext,
  removeAction,
  appendAction,
  submitAction,
}: CommentFormFieldRowProps) {
  const shouldShowSubmissionActions = appendAction != null || submitAction != null;

  return (
    <Box className="relative min-w-0">
      {isConnectedToNext && (
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
            {removeAction != null && <Box className="shrink-0">{removeAction}</Box>}
          </HStack>

          {shouldShowSubmissionActions && (
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
              {submitAction != null && <Box className="shrink-0">{submitAction}</Box>}
            </HStack>
          )}
        </VStack>
      </HStack>
    </Box>
  );
};
