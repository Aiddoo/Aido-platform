import { type CommentThreadEntry, useTrack } from '@src/shared/analytics';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { ArrowRightIcon, HStack, Text, VStack } from '@src/shared/ui';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';

import type { TodoComment } from '../../models/todo-comment.model';
import { CommentActionMenu } from './CommentActionMenu';
import { CommentArticle } from './CommentArticle';
import { CommentAuthorAvatar } from './CommentAuthorAvatar';
import { CommentLikeButton } from './CommentLikeButton';
import { ReplyButton } from './ReplyButton';
import { ELBOW_REACHES_AVATAR, ThreadBranch } from './ThreadLine';

/** 맛보기 답글은 두 줄까지만 — 전문은 스레드에서 읽는다. */
const PREVIEW_CONTENT_MAX_LINES = 2;

/** 굽이가 휘는 높이 — 답글 아바타(28px)와 더 보기 글자의 중심. */
const ELBOW_TURN_AT_AVATAR = 15;
const ELBOW_TURN_AT_TEXT = 10;

/** 맛보기 답글의 아바타(size-7)와 그 뒤 간격. 더 보기 문구를 답글 본문 선에 맞추는 데 쓴다. */
const PREVIEW_AVATAR_WIDTH = 28;
const PREVIEW_AVATAR_GAP = 8;
const REPLY_TEXT_OFFSET = PREVIEW_AVATAR_WIDTH + PREVIEW_AVATAR_GAP;

interface ReplyPreviewProps {
  comment: TodoComment;
}

/**
 * 목록에서 댓글 아래에 매달려 보이는 답글 맛보기 — 한 겹만 보여준다.
 * 답글을 '읽으러' 가는 유일한 길이다 (쓰는 건 각 행의 답글 버튼이 그 자리에서 맡는다).
 * 어디를 눌러도 그 댓글의 스레드로 간다 — 목록 안에서 펼치지 않아 스크롤 길이가 예측 가능하다.
 *
 * 선은 하나로 흐르며 답글마다 가지를 뻗고, 마지막 줄에서 한 번만 휜다.
 * 행 사이 여백은 내용 쪽에서 준다 — 왼쪽 열에 여백이 끼면 선이 끊긴다.
 */
export function ReplyPreview({ comment }: ReplyPreviewProps) {
  const { trackEvent } = useTrack();
  const push = useSingleTap(router.push);

  const openThread = (entry: CommentThreadEntry) => {
    trackEvent('comment_thread_opened', {
      todo_id: comment.todoId,
      entry,
      depth: comment.depth,
    });
    push({
      pathname: '/todo/[todoId]/comment/[commentId]',
      params: { todoId: comment.todoId, commentId: comment.id },
    });
  };

  if (!comment.hasReplies) {
    return null;
  }

  const replies = comment.replyPreview;

  return (
    <VStack>
      {replies.map((reply, index) => {
        const endsThread = !comment.hasMoreReplies && index === replies.length - 1;

        return (
          <PressableFeedback key={reply.id} onPress={() => openThread('reply_preview')}>
            <HStack gap={10}>
              <ThreadBranch turnAt={ELBOW_TURN_AT_AVATAR} continuesBelow={!endsThread} />

              <HStack flex={1} gap={PREVIEW_AVATAR_GAP} pb={12}>
                <CommentAuthorAvatar author={reply.author} size="sm" />
                <CommentArticle
                  comment={reply}
                  menu={<CommentActionMenu comment={reply} />}
                  contentMaxLines={PREVIEW_CONTENT_MAX_LINES}
                  // 답글도 댓글이다 — 깊이와 상관없이 좋아요와 답글을 열어 둔다.
                  footer={
                    <HStack align="center">
                      <CommentLikeButton comment={reply} />
                      <ReplyButton comment={reply} />
                    </HStack>
                  }
                />
              </HStack>
            </HStack>
          </PressableFeedback>
        );
      })}

      {comment.hasMoreReplies && (
        <MoreRepliesRow comment={comment} onPress={() => openThread('more_replies')} />
      )}
    </VStack>
  );
}

interface MoreRepliesRowProps {
  comment: TodoComment;
  onPress: () => void;
}

/** 남은 답글로 들어가는 줄. 스레드의 마지막이라 여기서 선이 휘어 맺힌다. */
function MoreRepliesRow({ comment, onPress }: MoreRepliesRowProps) {
  const { t } = useTranslation('todoComment');

  return (
    <PressableFeedback onPress={onPress} accessibilityRole="button">
      <HStack gap={10}>
        {/* 굽이의 팔도 답글 본문까지 뻗어, 문구를 가리키며 맺힌다. */}
        <ThreadBranch
          turnAt={ELBOW_TURN_AT_TEXT}
          reachesTo={ELBOW_REACHES_AVATAR + REPLY_TEXT_OFFSET}
          continuesBelow={false}
        />

        {/* 답글 아바타가 서던 자리를 비워, 문구가 답글 본문과 같은 선에서 시작한다. */}
        <HStack flex={1} gap={4} align="center" pl={REPLY_TEXT_OFFSET}>
          <Text size="b4" shade={6} weight="medium">
            {t('list.moreReplies', { count: comment.replyCount })}
          </Text>
          <ArrowRightIcon width={13} height={13} colorClassName="text-gray-5" />
        </HStack>
      </HStack>
    </PressableFeedback>
  );
}
