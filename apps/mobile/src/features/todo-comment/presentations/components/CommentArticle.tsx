import { useTranslation } from '@src/shared/i18n';
import { HStack, ICON_COUNT_BUTTON_INK_INSET, Text, VStack } from '@src/shared/ui';
import { formatRelativeTime } from '@src/shared/utils/date';
import type { ReactNode } from 'react';

import {
  type TodoCommentPreview,
  TodoCommentPolicy,
  mentionedAuthorName,
} from '../../models/todo-comment.model';

interface CommentArticleProps {
  comment: TodoCommentPreview;
  /** 작성자 줄 오른쪽 끝. 비워 두면 손댈 수 없는 읽기 전용 글이 된다. */
  menu?: ReactNode;
  /** 본문 아래에 붙는 액션 줄. 어떤 버튼을 놓을지는 이 댓글을 놓는 화면이 정한다. */
  footer?: ReactNode;
  /** 본문을 몇 줄까지 보여줄지. 목록에서는 줄여 두고, 스레드에서는 전문을 보여준다. */
  contentMaxLines?: number;
}

/**
 * 댓글 한 건의 글 — 작성자 줄, 본문(수정 중이면 수정 폼), 그리고 액션 슬롯.
 * 아바타와 바깥 여백은 이 컴포넌트를 놓는 리스트가 소유한다.
 */
export function CommentArticle({ comment, menu, footer, contentMaxLines }: CommentArticleProps) {
  return (
    <VStack flex={1} gap={3}>
      <CommentAuthorLine comment={comment} menu={menu} />

      <CommentText comment={comment} maxLines={contentMaxLines} />

      {/* 버튼이 품고 있는 여백만큼 되돌려, 아이콘의 잉크가 위 본문의 왼쪽 선과 맞물리게 한다. */}
      {TodoCommentPolicy.canAct(comment) && footer !== undefined && (
        <VStack pt={2} ml={-ICON_COUNT_BUTTON_INK_INSET}>
          {footer}
        </VStack>
      )}
    </VStack>
  );
}

type CommentAuthorLineProps = Pick<CommentArticleProps, 'comment' | 'menu'>;

/** 작성자 이름 · 작성자 뱃지 · 작성 시각 · 수정됨, 그리고 오른쪽 끝의 메뉴 자리. */
function CommentAuthorLine({ comment, menu }: CommentAuthorLineProps) {
  const { t } = useTranslation('todoComment');

  return (
    <HStack align="center" justify="between" gap={8}>
      <HStack gap={4} align="center" className="flex-1 flex-wrap">
        <Text size="b4" weight="semibold">
          {comment.author?.name ?? t('list.unknownUser')}
        </Text>
        {comment.author?.isTodoOwner === true && (
          <Text size="e2" tone="brand">
            {t('list.authorBadge')}
          </Text>
        )}
        <Text size="e1" shade={5}>
          {formatRelativeTime(comment.createdAt)}
        </Text>
        {comment.isEdited && (
          <Text size="e1" shade={5}>
            {t('list.edited')}
          </Text>
        )}
      </HStack>
      {menu}
    </HStack>
  );
}

type CommentTextProps = Pick<CommentArticleProps, 'comment'> & { maxLines?: number };

/** 댓글 내용. 삭제된 댓글은 자리만 남기고, 답글이면 @멘션이 앞에 붙는다. */
function CommentText({ comment, maxLines }: CommentTextProps) {
  const { t } = useTranslation('todoComment');

  if (comment.isDeleted) {
    return (
      <Text size="b4" shade={6}>
        {t('list.deleted')}
      </Text>
    );
  }

  const mention = mentionedAuthorName(comment);

  // 멘션과 본문은 나란히 흐르되 서로 다른 Text다 — 중첩 Text는 글꼴 배율을 깨뜨린다.
  return (
    <HStack gap={4} className="flex-wrap">
      {mention !== null && (
        <Text size="b3" tone="brand">
          {`@${mention}`}
        </Text>
      )}
      <Text size="b3" shade={9} maxLines={maxLines} className="flex-1">
        {comment.content}
      </Text>
    </HStack>
  );
}
