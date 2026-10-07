import type { TodoComment, TodoCommentOverviewResponse } from "@aido/validators";
import { describe, expect, it } from "vitest";

import { TodoCommentMapper } from "./todo-comment.mapper.js";

const createComment = (profileImage: string | null): TodoComment => ({
  id: "comment-1",
  threadId: "comment-1",
  parentId: null,
  depth: 0,
  author: { id: "user-1", name: "고양이", profileImage, isTodoOwner: true },
  content: "안녕",
  isDeleted: false,
  isEdited: false,
  likeCount: 0,
  replyCount: 1,
  replyTo: null,
  viewer: { isLiked: false, canEdit: true, canDelete: true, canReply: true },
  createdAt: "2026-10-03T00:00:00.000Z",
  editedAt: null,
});

describe("댓글 프로필 응답 매핑", () => {
  it("개요·답글·참여자를 변환해도 원본 프로필은 변경하지 않는다", () => {
    // Given
    const root = createComment("russian_blue");
    const reply = createComment("tuxedo_cat");
    const source: TodoCommentOverviewResponse = {
      items: [
        {
          comment: root,
          previewReply: reply,
          replySummary: {
            totalCount: 1,
            hiddenCount: 0,
            hasMore: false,
            participantAuthors: root.author ? [root.author] : [],
          },
        },
      ],
      pagination: {
        previousCursor: null,
        nextCursor: null,
        hasPrevious: false,
        hasNext: false,
        size: 20,
      },
    };

    // When
    const legacy = TodoCommentMapper.toOverview(source, "1.10.0");
    const latest = TodoCommentMapper.toOverview(source, "1.10.1");

    // Then
    expect(legacy.items[0]?.comment.author?.profileImage).toBe("scottish_fold");
    expect(legacy.items[0]?.previewReply?.author?.profileImage).toBe("black_cat");
    expect(legacy.items[0]?.replySummary.participantAuthors[0]?.profileImage).toBe("scottish_fold");
    expect(latest).toEqual(source);
    expect(root.author?.profileImage).toBe("russian_blue");
    expect(reply.author?.profileImage).toBe("tuxedo_cat");
  });

  it("삭제된 댓글의 빈 작성자 정보는 보존한다", () => {
    // Given
    const comment = { ...createComment(null), author: null, content: null, isDeleted: true };

    // When
    const result = TodoCommentMapper.toMutation({ comment });

    // Then
    expect(result.comment.author).toBeNull();
    expect(result.comment.content).toBeNull();
    expect(result.comment.isDeleted).toBe(true);
  });
});
