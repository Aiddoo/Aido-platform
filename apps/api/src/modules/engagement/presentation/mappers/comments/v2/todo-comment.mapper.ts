import type {
  TodoCommentRepliesResponse,
  TodoCommentThreadsResponse,
  TodoCommentV2,
  TodoCommentV2Author,
} from "@aido/api";

import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";

const toAuthor = (author: TodoCommentV2Author, appVersion?: string): TodoCommentV2Author => ({
  ...author,
  profileImage: resolveProfileImage(author.profileImage, appVersion),
});

const toComment = (comment: TodoCommentV2, appVersion?: string): TodoCommentV2 => ({
  ...comment,
  author: comment.author && toAuthor(comment.author, appVersion),
});

export const TodoCommentV2Mapper = {
  toThreads: (
    result: TodoCommentThreadsResponse,
    appVersion?: string,
  ): TodoCommentThreadsResponse => ({
    ...result,
    items: result.items.map((item) => ({
      ...item,
      comment: toComment(item.comment, appVersion),
      previewReply: item.previewReply && toComment(item.previewReply, appVersion),
      replySummary: {
        ...item.replySummary,
        participantAuthors: item.replySummary.participantAuthors.map((author) =>
          toAuthor(author, appVersion),
        ),
      },
    })),
  }),
  toReplies: (
    result: TodoCommentRepliesResponse,
    appVersion?: string,
  ): TodoCommentRepliesResponse => ({
    ...result,
    items: result.items.map((comment) => toComment(comment, appVersion)),
  }),
};
