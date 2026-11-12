import { useDraftService, useIdGenerator, useLogger } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { getErrorMessage } from '@src/shared/errors';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
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
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { CloseButton } from 'heroui-native';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useFormState, useWatch } from 'react-hook-form';
import { ScrollView, useWindowDimensions } from 'react-native';
import { KeyboardController, KeyboardEvents } from 'react-native-keyboard-controller';
import { match } from 'ts-pattern';

import { TODO_COMMENT_LOG_EVENT } from '../constants/todo-comment-log-events';
import { TODO_COMMENT_INPUT_NATIVE_ID } from '../constants/todo-comment.constants';
import {
  type PreparedTodoCommentSubmission,
  TodoCommentComposerPolicy,
} from '../domains/todo-comment-composer.model';
import {
  findTodoCommentErrorStatus,
  isTodoCommentRejectedError,
} from '../domains/todo-comment.error';
import { useIsTodoCommentSubmitting } from '../hooks/use-is-todo-comment-submitting';
import { useTodoCommentForm } from '../hooks/use-todo-comment-form';
import {
  useCreateTodoCommentChainMutationOptions,
  useUpdateTodoCommentMutationOptions,
} from '../queries/todo-comment.mutations';
import {
  type TodoCommentFormValues,
  type TodoCommentComposerMode,
  EMPTY_TODO_COMMENT_FORM_VALUES,
  toReplyFormValues,
  toEditFormValues,
} from '../schemas/todo-comment-form.schema';
import {
  createTodoCommentDraftKey,
  getTodoCommentDraftSourceUpdatedAt,
} from '../utils/todo-comment-draft';
import { getCommentFormMaxHeight } from '../utils/todo-comment-form.geometry';
import {
  getFocusedCommentFieldIndexAfterRemoval,
  getTrimmedContents,
  isComposerBlank,
  findComposerTarget,
} from '../utils/todo-comment-form.view-model';
import { TodoCommentAuthorAvatar } from './todo-comment-author-avatar';
import { useExpandThread } from './todo-comment-expansion';

const SEND_ICON_SIZE = 18;
const CLOSE_ICON_SIZE = 16;
const CLOSE_HIT_SLOP = 12;
const TARGET_CONTENT_MAX_LINES = 1;

type TodoCommentFormProps = Omit<
  ComponentProps<typeof ScrollView>,
  'children' | 'keyboardShouldPersistTaps' | 'nestedScrollEnabled'
>;

/**
 * 키보드 위 작성기. 모드(새 댓글·답글·수정)와 입력값은 화면이 소유한 폼에 있고, 이 컴포넌트는 필요한 필드만 구독한다.
 * 이어 쓴 글은 같은 묶음에 차례로 붙는다.
 */
export function TodoCommentForm({ style, ...scrollViewProps }: TodoCommentFormProps) {
  const [todoId] = useTodoId();
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const { height: viewportHeight } = useWindowDimensions();
  const { control, setFocus, getValues, reset } = useTodoCommentForm();
  const mode = useWatch({ control, name: 'mode' });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const isSubmitting = useIsTodoCommentSubmitting();
  const [focusedFieldIndex, setFocusedFieldIndex] = useState(0);
  const pendingFocusFrameRef = useRef<number | null>(null);
  const submit = useTodoCommentSubmit({ userId: user.id });
  const targetId = findComposerTarget(mode)?.id;

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
      const { mode: currentMode, items } = getValues();
      if (currentMode.type !== 'new' && isComposerBlank({ items })) {
        reset(EMPTY_TODO_COMMENT_FORM_VALUES);
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
      <TodoCommentDraftAutosave
        userId={user.id}
        mode={mode}
        key={createTodoCommentDraftKey({ userId: user.id, todoId, mode }).id}
      />
      <VStack gap={6}>
        <TargetBanner mode={mode} isSubmitting={isSubmitting} />
        <HStack gap={10} align="end" className="min-w-0 rounded-3xl bg-gray-2 py-1.5 ps-3 pe-1.5">
          <Box className="self-start pt-2">
            <TodoCommentAuthorAvatar author={user} size="sm" />
          </Box>
          <VStack flex={1} className="min-w-0">
            {fields.map((field, index) => (
              <HStack key={field.id} gap={4} align="start" className="min-w-0">
                <Box flex={1} className="min-w-0">
                  <CommentField
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
            {TodoCommentComposerPolicy.canChain(mode, fields.length) && (
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
  const [todoId] = useTodoId();
  const logger = useLogger();
  const draftService = useDraftService();
  const idGenerator = useIdGenerator();
  const expandThread = useExpandThread();
  const { handleSubmit, reset } = useTodoCommentForm();
  const createCommentChain = useMutation(useCreateTodoCommentChainMutationOptions({ todoId }));
  const updateComment = useMutation(useUpdateTodoCommentMutationOptions({ todoId }));
  const preparedSubmissionRef = useRef<PreparedTodoCommentSubmission | null>(null);

  const finish = (mode: TodoCommentComposerMode) => {
    draftService.remove(createTodoCommentDraftKey({ userId, todoId, mode }));
    reset(EMPTY_TODO_COMMENT_FORM_VALUES);
    KeyboardController.dismiss().catch((error) =>
      logger.warn(TODO_COMMENT_LOG_EVENT.KEYBOARD_DISMISS_FAILED, {
        error: getErrorMessage(error),
      }),
    );
  };

  return () =>
    handleSubmit(async ({ mode, items }) => {
      const contents = getTrimmedContents(items);
      if (contents == null) {
        return;
      }

      try {
        await match(mode)
          .with({ type: 'edit' }, async ({ target }) => {
            if (!TodoCommentComposerPolicy.isSameAsOriginal(target, contents[0])) {
              await updateComment.mutateAsync({ target, input: { content: contents[0] } });
            }
          })
          .with({ type: 'new' }, { type: 'reply' }, async (writeMode) => {
            const submission = TodoCommentComposerPolicy.prepareSubmission({
              previousSubmission: preparedSubmissionRef.current,
              todoId,
              parentId: TodoCommentComposerPolicy.getReplyParentId(writeMode),
              contents,
              createClientRequestId: () => idGenerator.create(),
            });
            preparedSubmissionRef.current = submission;
            const chain = await createCommentChain.mutateAsync({
              input: submission.input,
              target: findComposerTarget(writeMode),
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
        if (isTodoCommentRejectedError(error)) {
          preparedSubmissionRef.current = null;
        }
        logger.info(TODO_COMMENT_LOG_EVENT.SUBMIT_FAILED, {
          status: findTodoCommentErrorStatus(error),
        });
      }
    })();
}

/** 작성 중인 글을 모드별 초안으로 저장하고 다시 열면 이어 쓴다 */
function TodoCommentDraftAutosave({
  userId,
  mode,
}: {
  userId: string;
  mode: TodoCommentComposerMode;
}) {
  const [todoId] = useTodoId();
  const { t } = useTranslation('todoComment');
  const toast = useAppToast();
  const { subscribe, setValue } = useTodoCommentForm();
  const draftKey = createTodoCommentDraftKey({ userId, todoId, mode });
  const { restoredDraft, saveDraft, clearDraft } = useDraftStorage(draftKey, {
    sourceUpdatedAt: getTodoCommentDraftSourceUpdatedAt(mode),
    onOutdatedDiscard: () => toast.warning(t('toasts.draftOutdated')),
  });
  const [initialValues] = useState(() =>
    match(mode)
      .with({ type: 'new' }, () => EMPTY_TODO_COMMENT_FORM_VALUES)
      .with({ type: 'reply' }, ({ target }) => toReplyFormValues(target))
      .with({ type: 'edit' }, ({ target }) => toEditFormValues(target))
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
  const fontScaledSize = useFontScaledSize();
  const logger = useLogger();
  const { reset } = useTodoCommentForm();

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
    <HStack align="center" gap={8} className="min-w-0 px-2" testID="todo-comment-composer-target">
      <VStack flex={1} className="min-w-0">
        <Text size="e1" shade={7} weight="medium" numberOfLines={1}>
          {label}
        </Text>
        {mode.type === 'reply' && mode.target.content != null && (
          <Text size="e1" shade={6} numberOfLines={TARGET_CONTENT_MAX_LINES}>
            {mode.target.content}
          </Text>
        )}
      </VStack>
      <CloseButton
        variant="ghost"
        hitSlop={CLOSE_HIT_SLOP}
        isDisabled={isSubmitting}
        accessibilityLabel={t('actions.closeComposer')}
        onPress={() => {
          reset(EMPTY_TODO_COMMENT_FORM_VALUES);
          KeyboardController.dismiss().catch((error) =>
            logger.warn(TODO_COMMENT_LOG_EVENT.KEYBOARD_DISMISS_FAILED, {
              error: getErrorMessage(error),
            }),
          );
        }}
      >
        <CloseIcon
          width={fontScaledSize(CLOSE_ICON_SIZE)}
          height={fontScaledSize(CLOSE_ICON_SIZE)}
          colorClassName="text-gray-6"
        />
      </CloseButton>
    </HStack>
  );
}

function CommentField({
  index,
  fieldCount,
  mode,
  isFocused,
  isSubmitting,
  onFocus,
}: {
  index: number;
  fieldCount: number;
  mode: TodoCommentComposerMode;
  isFocused: boolean;
  isSubmitting: boolean;
  onFocus: () => void;
}) {
  const { t } = useTranslation('todoComment');
  const { control } = useTodoCommentForm();

  return (
    <Controller
      control={control}
      name={`items.${index}.content`}
      render={({ field: { value, onChange, onBlur, ref }, fieldState: { error } }) => (
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
          className="max-h-28 min-h-11"
        />
      )}
    />
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
  const { control } = useTodoCommentForm();
  const { isValid } = useFormState({ control, name: 'items' });
  const hasContent = useWatch({ control, name: 'items', compute: hasEveryContent });

  if (!hasContent) {
    return null;
  }

  return (
    <TextButton
      size="small"
      className="min-h-11 max-w-full min-w-11 self-start"
      isDisabled={!isValid || isSubmitting}
      onPress={onPress}
      accessibilityLabel={t('form.addToChain')}
    >
      {t('form.addToChain')}
    </TextButton>
  );
}

function hasEveryContent(items: TodoCommentFormValues['items']) {
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
  const fontScaledSize = useFontScaledSize();
  const { control } = useTodoCommentForm();
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
        onSubmit().catch(noop);
      }}
      accessibilityLabel={mode.type === 'edit' ? t('actions.save') : t('form.post')}
    >
      <SendIcon
        width={fontScaledSize(SEND_ICON_SIZE)}
        height={fontScaledSize(SEND_ICON_SIZE)}
        colorClassName="text-white dark:text-gray-9"
      />
    </Button>
  );
}
