import { useDraftService, useLogger } from '@src/bootstrap/providers/di-context';
import { useTodoScreenParams } from '@src/features/planning/todo/hooks/use-todo-screen-params';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { getErrorMessage, isApiError } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  Box,
  Button,
  CloseIcon,
  HStack,
  SendIcon,
  Text,
  TextArea,
  TextButton,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { PressableFeedback } from 'heroui-native';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { useFieldArray, useFormContext, useFormState, useWatch } from 'react-hook-form';
import { ScrollView, useWindowDimensions } from 'react-native';
import { KeyboardController, KeyboardEvents } from 'react-native-keyboard-controller';
import { match } from 'ts-pattern';

import { TODO_COMMENT_LOG_EVENT } from '../../constants/todo-comment-log-events';
import { TODO_COMMENT_INPUT_NATIVE_ID } from '../../constants/todo-comment.constants';
import {
  type PreparedTodoCommentSubmission,
  type TodoCommentComposerForm,
  type TodoCommentComposerMode,
  TodoCommentComposer,
} from '../../domains/todo-comment-composer.model';
import type { TodoCommentAuthor } from '../../domains/todo-comment.model';
import { useIsTodoCommentSubmitting } from '../../hooks/use-is-todo-comment-submitting';
import { useCreateTodoCommentChainMutationOptions } from '../../queries/use-create-todo-comment-chain-mutation-options';
import { useUpdateTodoCommentMutationOptions } from '../../queries/use-update-todo-comment-mutation-options';
import { getFocusedCommentFieldIndexAfterRemoval } from '../../utils/comment-form-fields';
import { getCommentFormMaxHeight } from '../../utils/comment-form-layout';
import { createTodoCommentDraftKey } from '../../utils/todo-comment-draft';
import { TodoCommentAuthorAvatar } from '../todo-comment-author-avatar';
import { useExpandThread } from '../todo-comment-expansion';

const SEND_ICON_SIZE = 18;
const CLOSE_ICON_SIZE = 16;
const CLOSE_HIT_SLOP = 12;
const TARGET_CONTENT_MAX_LINES = 1;
const CLIENT_ERROR_STATUS = { min: 400, max: 500 } as const;

type CommentFieldName = `items.${number}.content`;

interface TodoCommentFormProps extends Omit<
  ComponentProps<typeof ScrollView>,
  'children' | 'keyboardShouldPersistTaps' | 'nestedScrollEnabled'
> {
  author: Pick<TodoCommentAuthor, 'name' | 'profileImage'>;
  userId: string;
}

/**
 * 키보드 위 작성기. 모드(새 댓글·답글·수정)와 입력값은 화면이 소유한 폼에 있고, 이 컴포넌트는 필요한 필드만 구독한다.
 * 이어 쓴 글은 같은 묶음에 차례로 붙는다.
 */
export function TodoCommentForm({
  author,
  userId,
  style,
  ...scrollViewProps
}: TodoCommentFormProps) {
  const { todoId } = useTodoScreenParams();
  const { height: viewportHeight } = useWindowDimensions();
  const { control, setFocus, getValues, reset } = useFormContext<TodoCommentComposerForm>();
  const mode = useWatch({ control, name: 'mode' });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const isSubmitting = useIsTodoCommentSubmitting();
  const [focusedFieldIndex, setFocusedFieldIndex] = useState(0);
  const pendingFocusFrameRef = useRef<number | null>(null);
  const submit = useTodoCommentSubmit({ userId });
  const targetId = TodoCommentComposer.getComposerTarget(mode)?.id;

  const focusFieldAfterLayout = (index: number) => {
    if (pendingFocusFrameRef.current != null) {
      cancelAnimationFrame(pendingFocusFrameRef.current);
    }
    setFocusedFieldIndex(index);
    pendingFocusFrameRef.current = requestAnimationFrame(() => {
      pendingFocusFrameRef.current = null;
      setFocus(`items.${index}.content`);
    });
  };

  // 답글·수정을 고르면 화면 이동 없이 같은 입력창에 바로 쓴다
  useEffect(() => {
    if (targetId == null) {
      return;
    }
    const frame = requestAnimationFrame(() => setFocus('items.0.content'));
    return () => cancelAnimationFrame(frame);
  }, [mode.type, setFocus, targetId]);

  useEffect(() => {
    const subscription = KeyboardEvents.addListener('keyboardDidHide', () => {
      if (TodoCommentComposer.shouldCloseOnKeyboardHide(getValues())) {
        reset(TodoCommentComposer.new());
      }
    });
    return () => subscription.remove();
  }, [getValues, reset]);

  useEffect(
    () => () => {
      if (pendingFocusFrameRef.current != null) {
        cancelAnimationFrame(pendingFocusFrameRef.current);
      }
    },
    [],
  );

  return (
    <ScrollView
      {...scrollViewProps}
      style={[{ maxHeight: getCommentFormMaxHeight(viewportHeight) }, style]}
      keyboardShouldPersistTaps="always"
      nestedScrollEnabled
      showsVerticalScrollIndicator={fields.length > 2}
    >
      <ComposerDraft
        userId={userId}
        mode={mode}
        key={createTodoCommentDraftKey({ userId, todoId, mode }).id}
      />
      <VStack gap={6}>
        <TargetBanner mode={mode} isSubmitting={isSubmitting} />
        <HStack gap={10} align="end" className="min-w-0 rounded-3xl bg-gray-2 py-1.5 ps-3 pe-1.5">
          <Box className="self-start pt-2">
            <TodoCommentAuthorAvatar author={author} size="sm" />
          </Box>
          <VStack flex={1} className="min-w-0">
            {fields.map((field, index) => (
              <HStack key={field.id} gap={4} align="start" className="min-w-0">
                <Box flex={1} className="min-w-0">
                  <CommentField
                    name={`items.${index}.content`}
                    index={index}
                    fieldCount={fields.length}
                    mode={mode}
                    isFocused={focusedFieldIndex === index}
                    isSubmitting={isSubmitting}
                    onFocus={() => setFocusedFieldIndex(index)}
                  />
                </Box>
                {index > 0 && (
                  <RemoveFieldButton
                    index={index}
                    isSubmitting={isSubmitting}
                    onPress={() => {
                      remove(index);
                      focusFieldAfterLayout(
                        getFocusedCommentFieldIndexAfterRemoval(focusedFieldIndex, index),
                      );
                    }}
                  />
                )}
              </HStack>
            ))}
            {TodoCommentComposer.canChain(mode, fields.length) && (
              <AppendButton
                isSubmitting={isSubmitting}
                onPress={() => {
                  append({ content: '' });
                  focusFieldAfterLayout(fields.length);
                }}
              />
            )}
          </VStack>
          <SubmitButton mode={mode} isSubmitting={isSubmitting} onSubmit={submit} />
        </HStack>
      </VStack>
    </ScrollView>
  );
}

function useTodoCommentSubmit({ userId }: { userId: string }) {
  const { todoId } = useTodoScreenParams();
  const logger = useLogger();
  const draftService = useDraftService();
  const expandThread = useExpandThread();
  const { handleSubmit, reset } = useFormContext<TodoCommentComposerForm>();
  const createCommentChain = useMutation(useCreateTodoCommentChainMutationOptions({ todoId }));
  const updateComment = useMutation(useUpdateTodoCommentMutationOptions({ todoId }));
  const preparedSubmissionRef = useRef<PreparedTodoCommentSubmission | null>(null);

  const finish = (mode: TodoCommentComposerMode) => {
    draftService.remove(createTodoCommentDraftKey({ userId, todoId, mode }));
    reset(TodoCommentComposer.new());
    KeyboardController.dismiss().catch((error) =>
      logger.warn(TODO_COMMENT_LOG_EVENT.KEYBOARD_DISMISS_FAILED, {
        error: getErrorMessage(error),
      }),
    );
  };

  return handleSubmit(async ({ mode, items }) => {
    const contents = TodoCommentComposer.getTrimmedContents(items);
    if (contents == null) {
      return;
    }

    try {
      await match(mode)
        .with({ type: 'edit' }, async ({ target }) => {
          await updateComment.mutateAsync({ target, input: { content: contents[0] } });
        })
        .with({ type: 'new' }, { type: 'reply' }, async (writeMode) => {
          const submission = TodoCommentComposer.prepareSubmission({
            previousSubmission: preparedSubmissionRef.current,
            todoId,
            parentId: TodoCommentComposer.getReplyParentId(writeMode),
            contents,
            createClientRequestId: Crypto.randomUUID,
          });
          preparedSubmissionRef.current = submission;
          const chain = await createCommentChain.mutateAsync({
            input: submission.input,
            target: TodoCommentComposer.getComposerTarget(writeMode),
          });
          preparedSubmissionRef.current = null;
          const threadCommentId = chain.comments[0]?.threadCommentId;
          if (threadCommentId != null) {
            expandThread(threadCommentId);
          }
        })
        .exhaustive();
      finish(mode);
    } catch (error) {
      // 4xx는 같은 글을 다시 보내도 같은 결과라 새 멱등 키로 다시 보낼 수 있게 한다
      if (
        isApiError(error) &&
        error.status >= CLIENT_ERROR_STATUS.min &&
        error.status < CLIENT_ERROR_STATUS.max
      ) {
        preparedSubmissionRef.current = null;
      }
      logger.info(TODO_COMMENT_LOG_EVENT.SUBMIT_FAILED, {
        status: isApiError(error) ? error.status : null,
      });
    }
  });
}

/** 작성 중인 글을 모드별 초안으로 저장하고 다시 열면 이어 쓴다 */
function ComposerDraft({ userId, mode }: { userId: string; mode: TodoCommentComposerMode }) {
  const { todoId } = useTodoScreenParams();
  const { t } = useTranslation('todoComment');
  const toast = useAppToast();
  const { subscribe, setValue } = useFormContext<TodoCommentComposerForm>();
  const draftKey = createTodoCommentDraftKey({ userId, todoId, mode });
  const { restoredDraft, saveDraft, clearDraft } = useDraftStorage(draftKey, {
    sourceUpdatedAt: TodoCommentComposer.getDraftSourceUpdatedAt(mode),
    onOutdatedDiscard: () => toast.warning(t('toasts.draftOutdated')),
  });
  const [initialValues] = useState(() =>
    match(mode)
      .with({ type: 'new' }, () => TodoCommentComposer.new())
      .with({ type: 'reply' }, ({ target }) => TodoCommentComposer.reply(target))
      .with({ type: 'edit' }, ({ target }) => TodoCommentComposer.edit(target))
      .exhaustive(),
  );

  useEffect(() => {
    if (restoredDraft != null) {
      setValue('items', restoredDraft.items);
    }
  }, [restoredDraft, setValue]);

  useFormDraftAutosave(subscribe, {
    initialValues,
    saveDraft: (values) => {
      // 다른 모드로 바뀐 직후의 값은 이 초안이 아니다
      if (createTodoCommentDraftKey({ userId, todoId, mode: values.mode }).id !== draftKey.id) {
        return;
      }
      saveDraft({ items: values.items });
    },
    clearDraft,
  });

  return null;
}

function TargetBanner({
  mode,
  isSubmitting,
}: {
  mode: TodoCommentComposerMode;
  isSubmitting: boolean;
}) {
  const { t } = useTranslation('todoComment');
  const { reset } = useFormContext<TodoCommentComposerForm>();

  if (mode.type === 'new') {
    return null;
  }

  const label = match(mode)
    .with({ type: 'reply' }, ({ target }) =>
      t('input.replyingTo', { name: target.author?.name ?? t('list.unknownUser') }),
    )
    .with({ type: 'edit' }, () => t('input.editing'))
    .exhaustive();

  return (
    <HStack align="center" gap={8} px={8} className="min-w-0" testID="todo-comment-composer-target">
      <VStack flex={1} className="min-w-0">
        <Text size="e1" shade={7} weight="medium" maxLines={1}>
          {label}
        </Text>
        {mode.type === 'reply' && mode.target.content != null && (
          <Text size="e1" shade={6} maxLines={TARGET_CONTENT_MAX_LINES}>
            {mode.target.content}
          </Text>
        )}
      </VStack>
      <PressableFeedback
        hitSlop={CLOSE_HIT_SLOP}
        isDisabled={isSubmitting}
        className="size-8 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={t('actions.closeComposer')}
        onPress={() => {
          reset(TodoCommentComposer.new());
          KeyboardController.dismiss().catch(() => undefined);
        }}
      >
        <CloseIcon width={CLOSE_ICON_SIZE} height={CLOSE_ICON_SIZE} colorClassName="text-gray-6" />
      </PressableFeedback>
    </HStack>
  );
}

function CommentField({
  name,
  index,
  fieldCount,
  mode,
  isFocused,
  isSubmitting,
  onFocus,
}: {
  name: CommentFieldName;
  index: number;
  fieldCount: number;
  mode: TodoCommentComposerMode;
  isFocused: boolean;
  isSubmitting: boolean;
  onFocus: () => void;
}) {
  const { t } = useTranslation('todoComment');
  const { control } = useFormContext<TodoCommentComposerForm>();

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
          placeholder={match({ isChain: index > 0, type: mode.type })
            .with({ isChain: true }, () => t('form.chainPlaceholder'))
            .with({ type: 'edit' }, () => t('input.editPlaceholder'))
            .with({ type: 'reply' }, () => t('input.replyPlaceholder'))
            .otherwise(() => t('input.placeholder'))}
          accessibilityLabel={t('form.inputLabel', { index: index + 1, count: fieldCount })}
          className="min-h-11 max-h-28"
        />
      )}
    </FormField>
  );
}

function RemoveFieldButton({
  index,
  isSubmitting,
  onPress,
}: {
  index: number;
  isSubmitting: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation('todoComment');

  return (
    <TextButton
      size="xsmall"
      className="min-h-11 min-w-11 shrink-0"
      isDisabled={isSubmitting}
      onPress={onPress}
      accessibilityLabel={t('form.removeFromChain', { index: index + 1 })}
    >
      {t('form.remove')}
    </TextButton>
  );
}

/** 쓴 글이 있을 때만 이어 쓰기를 보여 작성 바가 평소에는 한 줄로 남는다 */
function AppendButton({ isSubmitting, onPress }: { isSubmitting: boolean; onPress: () => void }) {
  const { t } = useTranslation('todoComment');
  const { control } = useFormContext<TodoCommentComposerForm>();
  const { isValid } = useFormState({ control, name: 'items' });
  const hasContent = useWatch({ control, name: 'items', compute: hasEveryContent });

  if (!hasContent) {
    return null;
  }

  return (
    <TextButton
      size="small"
      className="min-h-11 min-w-11 max-w-full self-start"
      isDisabled={!isValid || isSubmitting}
      onPress={onPress}
      accessibilityLabel={t('form.addToChain')}
    >
      {t('form.addToChain')}
    </TextButton>
  );
}

function hasEveryContent(items: TodoCommentComposerForm['items']) {
  return items.every((item) => item.content.trim().length > 0);
}

function SubmitButton({
  mode,
  isSubmitting,
  onSubmit,
}: {
  mode: TodoCommentComposerMode;
  isSubmitting: boolean;
  onSubmit: () => Promise<void>;
}) {
  const { t } = useTranslation('todoComment');
  const { control } = useFormContext<TodoCommentComposerForm>();
  const hasContent = useWatch({
    control,
    name: 'items',
    compute: hasEveryContent,
  });
  const { isValid } = useFormState({ control });

  return (
    <Button
      testID="todo-comment-submit"
      size="medium"
      display="inline"
      radius="full"
      className="min-h-11 min-w-11 shrink-0 px-0"
      isDisabled={!hasContent || !isValid || isSubmitting}
      isLoading={isSubmitting}
      onPress={() => {
        onSubmit().catch(() => undefined);
      }}
      accessibilityLabel={mode.type === 'edit' ? t('actions.save') : t('form.post')}
    >
      <SendIcon
        width={SEND_ICON_SIZE}
        height={SEND_ICON_SIZE}
        colorClassName="text-white dark:text-gray-9"
      />
    </Button>
  );
}
