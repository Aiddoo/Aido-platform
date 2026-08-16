import { useTranslation } from '@src/shared/i18n';
import { Button, HStack, KeyboardBottomSheet, Text, TextButton, VStack } from '@src/shared/ui';
import { BottomSheetTextArea } from '@src/shared/ui/TextArea/BottomSheetTextArea';
import { PressableFeedback } from 'heroui-native';
import { type ComponentProps, type ReactNode, useState } from 'react';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';

import { TodoCommentDraftPolicy } from '../../models/todo-comment.model';
import type { TodoCommentAuthor, TodoCommentPreview } from '../../models/todo-comment.model';
import { useCommentForm } from '../hooks/use-comment-form';
import { CommentArticle } from './CommentArticle';
import { CommentAuthorAvatar } from './CommentAuthorAvatar';
import { THREAD_COLUMN_WIDTH, ThreadConnectorDown, ThreadConnectorUp } from './ThreadLine';

/** '답글 또 달기' 줄의 작은 아바타(size-5) 지름. 위에서 내려온 선이 이 한가운데서 맺힌다. */
const ADD_ROW_AVATAR_SIZE = 20;

/** 대상 글은 맥락이라 짧게만 보여준다. */
const TARGET_CONTENT_MAX_LINES = 2;

/** 입력 글꼴을 댓글 본문(size="b3", shade 9)과 맞춘다 — 쓰는 글과 읽는 글이 같아 보여야 한다. */
const INPUT_TEXT = 'min-h-0 rounded-none border-0 bg-transparent px-0 py-0 text-b3 text-gray-9';

interface CommentComposerSheetProps extends Omit<
  ComponentProps<typeof KeyboardBottomSheet>,
  'children'
> {
  /** 지금 쓰는 사람. 시트는 라우트 밖에서 그려져 라우트 훅을 쓸 수 없으므로 여는 쪽이 알려 준다. */
  author: TodoCommentAuthor | null;
  /** 어떤 글에 이어 붙는지. 없으면 할 일에 바로 다는 첫 댓글이다. */
  target: TodoCommentPreview | null;
  /** 고칠 글의 원문. 주면 수정이 되어 이어 쓰기가 닫힌다. */
  defaultContent?: string;
  /**
   * 위에서 아래 순서의 글 묶음. 빈 묶음은 나갈 수 없고, 수정이면 언제나 하나다.
   *
   * 보내는 동안의 상태는 이 시트가 스스로 안다 — 오버레이는 열릴 때의 화면을 스냅샷으로
   * 들고 있어서, 밖에서 넘긴 진행 중 플래그는 갱신되지 않고 얼어붙는다.
   */
  onSubmit: (contents: [string, ...string[]]) => Promise<void> | void;
}

/**
 * 글을 쓰는 유일한 자리. 새 댓글·답글·수정이 모두 이 시트를 거친다.
 * 열려 있는 칸이 하나라도 비어 있으면 게시가 열리지 않는다.
 */
export function CommentComposerSheet({
  author,
  target,
  defaultContent,
  onSubmit,
  ...sheetProps
}: CommentComposerSheetProps) {
  const { t } = useTranslation('todoComment');
  const isEditing = defaultContent !== undefined;

  const { control } = useCommentForm(isEditing ? [defaultContent] : ['']);
  const { fields, append } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' });

  const contents = items.map((item) => item.content);
  const canAddMore = TodoCommentDraftPolicy.canAddMore({ contents, isEditing });
  const canPost = TodoCommentDraftPolicy.canPost(contents);
  const showsTarget = target !== null && !isEditing;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    const [first, ...rest] = contents.map((content) => content.trim());
    if (first === undefined) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit([first, ...rest]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardBottomSheet {...sheetProps}>
      <VStack gap={16}>
        <Header
          title={target === null ? t('composer.commentTitle') : t('composer.replyTitle')}
          left={
            <TextButton size="small" onPress={() => sheetProps.onOpenChange(false)}>
              {t('actions.cancel')}
            </TextButton>
          }
        />

        <VStack>
          {showsTarget && (
            <ThreadRow
              avatar={<CommentAuthorAvatar author={target.author} size="md" />}
              continuesBelow
            >
              <CommentArticle comment={target} contentMaxLines={TARGET_CONTENT_MAX_LINES} />
            </ThreadRow>
          )}

          {fields.map((field, index) => (
            <ThreadRow
              key={field.id}
              avatar={<CommentAuthorAvatar author={author} size="md" />}
              continuesBelow={index < fields.length - 1 || canAddMore}
            >
              <VStack flex={1} gap={3}>
                <Heading
                  name={author?.name ?? t('list.unknownUser')}
                  hint={fields.length > 1 ? `${index + 1}/${fields.length}` : null}
                />
                <Controller
                  control={control}
                  name={`items.${index}.content`}
                  render={({ field: { value, onChange, onBlur } }) => (
                    <BottomSheetTextArea
                      testID={`comment-composer-input-${index}`}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      autoFocus={index === fields.length - 1}
                      placeholder={
                        target === null ? t('input.placeholder') : t('input.replyPlaceholder')
                      }
                      className={INPUT_TEXT}
                    />
                  )}
                />
              </VStack>
            </ThreadRow>
          ))}

          {canAddMore && (
            <PressableFeedback
              testID="comment-composer-add"
              onPress={() => append({ content: '' })}
            >
              <ThreadRow
                avatar={<CommentAuthorAvatar author={author} size="xs" />}
                endsAt={ADD_ROW_AVATAR_SIZE / 2}
              >
                <Text size="e1" shade={5}>
                  {t('composer.addToChain')}
                </Text>
              </ThreadRow>
            </PressableFeedback>
          )}
        </VStack>

        <HStack justify="end">
          <Button
            testID="comment-composer-post"
            size="small"
            display="inline"
            radius="full"
            isDisabled={!canPost}
            isLoading={isSubmitting}
            onPress={submit}
          >
            {t('composer.post')}
          </Button>
        </HStack>
      </VStack>
    </KeyboardBottomSheet>
  );
}

/** 제목이 가운데 오도록 양옆을 같은 무게로 둔다. */
function Header({ title, left }: { title: string; left: ReactNode }) {
  return (
    <HStack align="center">
      <HStack flex={1}>{left}</HStack>
      <Text size="b3" weight="semibold">
        {title}
      </Text>
      <HStack flex={1} />
    </HStack>
  );
}

interface ThreadRowProps {
  /** 왼쪽 열에 놓일 것. 선은 이 뒤를 지나며 시작하거나 맺힌다. */
  avatar: ReactNode;
  /** 이 행의 아바타에서 아래 행까지 선이 이어진다. */
  continuesBelow?: boolean;
  /** 위에서 내려온 선이 맺히는 높이 — 아바타 반지름. */
  endsAt?: number;
  children: ReactNode;
}

/**
 * 아바타 열 + 본문의 한 행. 목록·스레드와 같은 축(17px)을 써서
 * 지금 쓰는 글이 어디에 이어 붙는지가 선 하나로 읽힌다.
 */
function ThreadRow({ avatar, continuesBelow = false, endsAt, children }: ThreadRowProps) {
  return (
    <HStack gap={10} pb={12} align="stretch" className="relative">
      {continuesBelow && <ThreadConnectorDown />}
      {endsAt !== undefined && <ThreadConnectorUp endsAt={endsAt} />}

      {/* 아바타는 언제나 행의 맨 위에 붙는다 — 선이 아바타 중심을 기준으로 그려지므로,
          세로 가운데 정렬하면 글이 길어질수록(글꼴 확대 포함) 아바타가 내려가 선과 어긋난다.
          목록의 CommentAvatarColumn과 같은 규칙이다. */}
      <VStack align="center" className={THREAD_COLUMN_WIDTH}>
        {avatar}
      </VStack>

      {/* 선이 맺히는 행은 글을 아바타 높이 안에서 가운데 맞춘다 — 아바타는 위에 붙어 있어야
          하므로 행 전체를 가운데 정렬할 수는 없다. */}
      {endsAt === undefined ? (
        children
      ) : (
        <VStack flex={1} justify="center" style={{ minHeight: endsAt * 2 }}>
          {children}
        </VStack>
      )}
    </HStack>
  );
}

/** 이름과, 이어 쓰는 중일 때만 붙는 순번. 하나뿐이면 굳이 세지 않는다. */
function Heading({ name, hint }: { name: string; hint: string | null }) {
  return (
    <HStack gap={6} align="center">
      <Text size="b4" weight="semibold">
        {name}
      </Text>
      {hint !== null && (
        <Text size="e1" shade={5}>
          {hint}
        </Text>
      )}
    </HStack>
  );
}
