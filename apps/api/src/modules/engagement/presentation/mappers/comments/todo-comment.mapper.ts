import type {
  TodoComment,
  TodoCommentChainResponse,
  TodoCommentMutationResponse,
  TodoCommentOverviewResponse,
  TodoConversationResponse,
  TodoDetailsResponse,
} from "@aido/api";

import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";

const toComment = (comment: TodoComment, appVersion?: string): TodoComment => ({
  ...comment,
  author: comment.author && {
    ...comment.author,
    profileImage: resolveProfileImage(comment.author.profileImage, appVersion),
  },
});

export const TodoCommentMapper = {
  toDetails: (result: TodoDetailsResponse, appVersion?: string): TodoDetailsResponse => ({
    ...result,
    owner: {
      ...result.owner,
      profileImage: resolveProfileImage(result.owner.profileImage, appVersion),
    },
  }),
  toOverview: (
    result: TodoCommentOverviewResponse,
    appVersion?: string,
  ): TodoCommentOverviewResponse => ({
    ...result,
    items: result.items.map((item) => ({
      ...item,
      comment: toComment(item.comment, appVersion),
      previewReply: item.previewReply && toComment(item.previewReply, appVersion),
      replySummary: {
        ...item.replySummary,
        participantAuthors: item.replySummary.participantAuthors.map((author) => ({
          ...author,
          profileImage: resolveProfileImage(author.profileImage, appVersion),
        })),
      },
    })),
  }),
  toConversation: (
    result: TodoConversationResponse,
    appVersion?: string,
  ): TodoConversationResponse => ({
    ...result,
    items: result.items.map((item) => ({ ...item, comment: toComment(item.comment, appVersion) })),
    focus: result.focus && {
      ...result.focus,
      precedingAncestors: result.focus.precedingAncestors.map((item) => ({
        ...item,
        comment: toComment(item.comment, appVersion),
      })),
    },
  }),
  toChain: (result: TodoCommentChainResponse, appVersion?: string): TodoCommentChainResponse => ({
    ...result,
    comments: result.comments.map((comment) => toComment(comment, appVersion)),
  }),
  toMutation: (
    result: TodoCommentMutationResponse,
    appVersion?: string,
  ): TodoCommentMutationResponse => ({
    ...result,
    comment: toComment(result.comment, appVersion),
  }),
};
