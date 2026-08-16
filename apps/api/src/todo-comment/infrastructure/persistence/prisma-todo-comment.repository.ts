import { TODO_COMMENT_LIMITS, TODO_COMMENT_SORT, type TodoCommentSort } from "@aido/validators";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "@/generated/prisma/client";
import { FollowStatus, TodoVisibility } from "@/generated/prisma/enums";
import { toISOString, toISOStringOrNull } from "@/shared/domain/date/utils/format";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type { TodoCommentRepositoryPort } from "../../application/ports/todo-comment.repository.port";
import { encodeTodoCommentCursor } from "../../application/todo-comment-cursor";
import type {
	CreateTodoCommentChainInput,
	ListTodoCommentsParams,
	TodoCommentChainCreationResult,
	TodoCommentLikeTransition,
	PaginatedTodoCommentRecords,
	TodoCommentRecord,
	TodoDetailsRecord,
} from "../../application/types";
import { TodoComment } from "../../domain/entities/todo-comment.aggregate";
import { TodoCommentId } from "../../domain/value-objects/todo-comment-id.vo";
import { TODO_DETAILS_INCLUDE, toTodoResponse } from "./todo-details.mapper";

const COMMENT_INCLUDE = {
	author: { include: { profile: true } },
	parent: { include: { author: { include: { profile: true } } } },
	todo: { select: { userId: true } },
} satisfies Prisma.TodoCommentInclude;

type CommentRow = Prisma.TodoCommentGetPayload<{ include: typeof COMMENT_INCLUDE }>;
type CommentWithChildrenRow = CommentRow & { children?: CommentRow[] };

/**
 * 삭제됐어도 답글이 남았으면 묘비로 남긴다 — 대화가 끊기지 않게.
 * replyCount는 "보이는 직계 자식 수"라서 깊이가 얼마든 이 한 줄로 판정된다.
 */
const VISIBLE_COMMENT = {
	OR: [{ deletedAt: null }, { replyCount: { gt: 0 } }],
} satisfies Prisma.TodoCommentWhereInput;

function orderBySort(sort: TodoCommentSort): Prisma.TodoCommentOrderByWithRelationInput[] {
	return sort === TODO_COMMENT_SORT.LATEST
		? [{ createdAt: "desc" }, { id: "desc" }]
		: [{ likeCount: "desc" }, { replyCount: "desc" }, { createdAt: "desc" }, { id: "desc" }];
}

function toRecord(row: CommentWithChildrenRow): TodoCommentRecord {
	return {
		id: row.id,
		todoId: row.todoId,
		parentId: row.parentId,
		rootId: row.rootId,
		path: row.path,
		depth: row.depth,
		parentAuthorName: row.parent?.author.profile?.name ?? null,
		authorId: row.authorId,
		authorName: row.author.profile?.name ?? null,
		authorProfileImage: row.author.profile?.profileImage ?? null,
		todoOwnerId: row.todo.userId,
		content: row.content,
		likeCount: row.likeCount,
		replyCount: row.replyCount,
		deletedAt: toISOStringOrNull(row.deletedAt),
		editedAt: toISOStringOrNull(row.editedAt),
		createdAt: toISOString(row.createdAt),
		children: (row.children ?? []).map(toRecord),
	};
}

function toAggregate(row: Prisma.TodoCommentGetPayload<object>): TodoComment {
	return TodoComment.reconstitute({
		id: row.id,
		todoId: row.todoId,
		authorId: row.authorId,
		parentId: row.parentId,
		rootId: row.rootId,
		path: row.path,
		content: row.content,
		deletedAt: row.deletedAt,
		editedAt: row.editedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
}

@Injectable()
export class PrismaTodoCommentRepository implements TodoCommentRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	private async isAcceptedFriend(firstUserId: string, secondUserId: string): Promise<boolean> {
		const friendship = await this.client.follow.findFirst({
			where: {
				status: FollowStatus.ACCEPTED,
				OR: [
					{ followerId: firstUserId, followingId: secondUserId },
					{ followerId: secondUserId, followingId: firstUserId },
				],
			},
			select: { id: true },
		});

		return friendship !== null;
	}

	async canAccessTodo(todoId: number, viewerId: string): Promise<boolean> {
		const todo = await this.client.todo.findUnique({
			where: { id: todoId },
			select: { userId: true, visibility: true },
		});

		if (todo === null) {
			return false;
		}

		if (todo.userId === viewerId) {
			return true;
		}

		if (todo.visibility !== TodoVisibility.PUBLIC) {
			return false;
		}

		return this.isAcceptedFriend(todo.userId, viewerId);
	}

	async findAccessibleTodoDetails(
		todoId: number,
		viewerId: string,
	): Promise<TodoDetailsRecord | null> {
		const row = await this.client.todo.findUnique({
			where: { id: todoId },
			include: TODO_DETAILS_INCLUDE,
		});

		if (row === null) {
			return null;
		}

		const isOwner = row.userId === viewerId;
		const canAccess =
			isOwner ||
			(row.visibility === TodoVisibility.PUBLIC &&
				(await this.isAcceptedFriend(row.userId, viewerId)));

		if (!canAccess) {
			return null;
		}

		return {
			todo: toTodoResponse(row),
			owner: {
				id: row.user.id,
				name: row.user.profile?.name ?? null,
				profileImage: row.user.profile?.profileImage ?? null,
			},
			viewCount: row.viewCount,
			commentCount: row.commentCount,
			isOwner,
		};
	}

	async findComment(todoId: number, commentId: string): Promise<TodoComment | null> {
		const row = await this.client.todoComment.findFirst({
			where: { id: commentId, todoId },
		});

		return row ? toAggregate(row) : null;
	}

	async findCommentRecord(todoId: number, commentId: string): Promise<TodoCommentRecord | null> {
		const row = await this.client.todoComment.findFirst({
			where: { id: commentId, todoId },
			include: COMMENT_INCLUDE,
		});

		return row ? toRecord(row) : null;
	}

	/**
	 * parentId가 null이면 최상위 댓글 목록, 값이 있으면 그 댓글의 직계 답글 목록이다.
	 * 자식 미리보기는 한 겹만 채운다 — 관계는 부모 수와 무관하게 1회 조회되고 take는 부모별로 적용된다.
	 */
	async listComments(params: ListTodoCommentsParams): Promise<PaginatedTodoCommentRecords> {
		const cursorWhere = this.buildCursorWhere(params);
		const rows = await this.client.todoComment.findMany({
			where: {
				todoId: params.todoId,
				parentId: params.parentId,
				AND: [VISIBLE_COMMENT, ...(cursorWhere ? [cursorWhere] : [])],
			},
			orderBy: orderBySort(params.sort),
			take: params.size + 1,
			include: {
				...COMMENT_INCLUDE,
				children: {
					where: VISIBLE_COMMENT,
					orderBy: orderBySort(params.sort),
					take: TODO_COMMENT_LIMITS.REPLY_PREVIEW_SIZE,
					include: COMMENT_INCLUDE,
				},
			},
		});

		const hasNext = rows.length > params.size;
		const pageRows = hasNext ? rows.slice(0, params.size) : rows;
		const items = pageRows.map(toRecord);
		const lastItem = items.at(-1);

		return {
			items,
			nextCursor: hasNext && lastItem ? encodeTodoCommentCursor(lastItem, params.sort) : null,
			hasNext,
			size: params.size,
		};
	}

	/** 뿌리 → 부모 순서의 조상. path 덕분에 깊이와 무관하게 한 번의 조회로 끝난다. */
	async findAncestors(todoId: number, path: readonly string[]): Promise<TodoCommentRecord[]> {
		if (path.length === 0) {
			return [];
		}

		const rows = await this.client.todoComment.findMany({
			where: { todoId, id: { in: [...path] } },
			include: COMMENT_INCLUDE,
		});
		const rowById = new Map(rows.map((row) => [row.id, row]));

		return path.flatMap((ancestorId) => {
			const row = rowById.get(ancestorId);

			return row ? [toRecord(row)] : [];
		});
	}

	private buildCursorWhere(params: ListTodoCommentsParams): Prisma.TodoCommentWhereInput | null {
		const cursor = params.cursor;

		if (cursor === undefined) {
			return null;
		}

		const createdAt = new Date(cursor.createdAt);

		if (cursor.sort === TODO_COMMENT_SORT.LATEST) {
			return {
				OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.id } }],
			};
		}

		if (cursor.sort !== TODO_COMMENT_SORT.POPULAR) {
			return null;
		}

		return {
			OR: [
				{ likeCount: { lt: cursor.likeCount } },
				{ likeCount: cursor.likeCount, replyCount: { lt: cursor.replyCount } },
				{
					likeCount: cursor.likeCount,
					replyCount: cursor.replyCount,
					createdAt: { lt: createdAt },
				},
				{
					likeCount: cursor.likeCount,
					replyCount: cursor.replyCount,
					createdAt,
					id: { lt: cursor.id },
				},
			],
		};
	}

	async findLikedCommentIds(commentIds: readonly string[], viewerId: string): Promise<Set<string>> {
		if (commentIds.length === 0) {
			return new Set();
		}

		const likes = await this.client.todoCommentLike.findMany({
			where: { commentId: { in: [...commentIds] }, userId: viewerId, isActive: true },
			select: { commentId: true },
		});

		return new Set(likes.map((like) => like.commentId));
	}

	async findUserDisplayName(userId: string): Promise<string | null> {
		const profile = await this.client.userProfile.findUnique({
			where: { userId },
			select: { name: true },
		});

		return profile?.name ?? null;
	}

	/**
	 * 사슬을 한 번에 심는다.
	 *
	 * 글마다 왕복하면 길이에 비례해 쿼리가 늘어난다. 재시도로 이미 다 있는 경우를 한 번의 조회로 걸러내고,
	 * 새로 만들 때만 글 수만큼 create를 돈다 — 각 글의 부모가 바로 앞 글이라 순서를 건너뛸 수 없기 때문이다.
	 * 카운터는 마지막에 한 번씩만 올린다.
	 */
	async createCommentChain(
		input: CreateTodoCommentChainInput,
	): Promise<TodoCommentChainCreationResult> {
		const clientRequestIds = input.items.map((item) => item.clientRequestId);
		const existing = await this.client.todoComment.findMany({
			where: { authorId: input.authorId, clientRequestId: { in: clientRequestIds } },
			include: COMMENT_INCLUDE,
		});

		if (existing.length === input.items.length) {
			const byRequestId = new Map(existing.map((row) => [row.clientRequestId, row]));

			return {
				comments: clientRequestIds.flatMap((id) => {
					const row = byRequestId.get(id);

					return row ? [toRecord(row)] : [];
				}),
				createdCount: 0,
			};
		}

		let placement = input.placement;
		const comments: TodoCommentRecord[] = [];
		const lastIndex = input.items.length - 1;

		for (const [index, item] of input.items.entries()) {
			const row = await this.client.todoComment.create({
				data: {
					todoId: input.todoId,
					authorId: input.authorId,
					clientRequestId: item.clientRequestId,
					content: item.content,
					parentId: placement.parentId?.getValue() ?? null,
					rootId: placement.rootId?.getValue() ?? null,
					path: [...placement.path],
					depth: placement.depth,
					// 마지막을 뺀 모든 글은 바로 다음 글을 직계 자식으로 갖는다.
					// 심는 순간 이미 아는 수라서, 뒤따라 세는 쿼리를 만들지 않는다.
					replyCount: index < lastIndex ? 1 : 0,
				},
				include: COMMENT_INCLUDE,
			});

			comments.push(toRecord(row));
			placement = placement.under(TodoCommentId.create(row.id));
		}

		return { comments, createdCount: comments.length };
	}

	async updateComment(comment: TodoComment): Promise<void> {
		await this.client.todoComment.update({
			where: { id: comment.id.getValue() },
			data: { content: comment.content, editedAt: comment.editedAt },
		});
	}

	async deleteComment(comment: TodoComment): Promise<void> {
		await this.client.todoComment.update({
			where: { id: comment.id.getValue() },
			data: { content: null, deletedAt: comment.deletedAt, likeCount: 0 },
		});
		await this.client.todoCommentLike.updateMany({
			where: { commentId: comment.id.getValue(), isActive: true },
			data: { isActive: false },
		});
	}

	async increaseTodoCommentCount(todoId: number, amount: number): Promise<void> {
		await this.client.todo.update({
			where: { id: todoId },
			data: { commentCount: { increment: amount } },
		});
	}

	async decrementTodoCommentCount(todoId: number): Promise<void> {
		await this.client.todo.updateMany({
			where: { id: todoId, commentCount: { gt: 0 } },
			data: { commentCount: { decrement: 1 } },
		});
	}

	/** 답글 수는 직계 부모에만 쌓인다. */
	async incrementReplyCount(parentId: string): Promise<void> {
		await this.client.todoComment.update({
			where: { id: parentId },
			data: { replyCount: { increment: 1 } },
		});
	}

	/**
	 * 삭제된 댓글이 목록에서 사라진 만큼 조상의 답글 수를 줄인다.
	 * 묘비로 남는 조상을 만나면 거기서 멈춘다 — 그 위로는 보이는 자식 수가 그대로다.
	 */
	async dropDeletedFromAncestors(commentId: string, path: readonly string[]): Promise<void> {
		const chain = [commentId, ...[...path].reverse()];

		for (const [index, id] of chain.entries()) {
			const node = await this.client.todoComment.findUniqueOrThrow({
				where: { id },
				select: { deletedAt: true, replyCount: true },
			});

			if (node.deletedAt === null || node.replyCount > 0) {
				return;
			}

			const parentId = chain[index + 1];

			if (parentId === undefined) {
				return;
			}

			await this.client.todoComment.updateMany({
				where: { id: parentId, replyCount: { gt: 0 } },
				data: { replyCount: { decrement: 1 } },
			});
		}
	}

	async setLike(
		todoId: number,
		commentId: string,
		userId: string,
	): Promise<TodoCommentLikeTransition> {
		const [comment, existingLike] = await Promise.all([
			this.client.todoComment.findFirstOrThrow({
				where: { id: commentId, todoId },
				select: { authorId: true, likeCount: true },
			}),
			this.client.todoCommentLike.findUnique({
				where: { commentId_userId: { commentId, userId } },
			}),
		]);

		if (existingLike?.isActive) {
			return {
				commentId,
				commentAuthorId: comment.authorId,
				changed: false,
				isLiked: true,
				likeCount: comment.likeCount,
				wasEverNotified: existingLike.notifiedAt !== null,
			};
		}

		const changed = existingLike
			? await this.client.todoCommentLike.updateMany({
					where: { commentId, userId, isActive: false },
					data: { isActive: true },
				})
			: await this.client.todoCommentLike.createMany({
					data: [{ commentId, userId, isActive: true }],
					skipDuplicates: true,
				});

		if (changed.count === 1) {
			const updated = await this.client.todoComment.update({
				where: { id: commentId },
				data: { likeCount: { increment: 1 } },
				select: { likeCount: true },
			});
			return {
				commentId,
				commentAuthorId: comment.authorId,
				changed: true,
				isLiked: true,
				likeCount: updated.likeCount,
				wasEverNotified: existingLike?.notifiedAt !== null && existingLike !== null,
			};
		}

		const current = await this.client.todoComment.findUniqueOrThrow({
			where: { id: commentId },
			select: { likeCount: true },
		});
		return {
			commentId,
			commentAuthorId: comment.authorId,
			changed: false,
			isLiked: true,
			likeCount: current.likeCount,
			wasEverNotified: true,
		};
	}

	async markLikeNotified(commentId: string, userId: string): Promise<void> {
		await this.client.todoCommentLike.updateMany({
			where: { commentId, userId, notifiedAt: null },
			data: { notifiedAt: new Date() },
		});
	}

	async removeLike(
		todoId: number,
		commentId: string,
		userId: string,
	): Promise<TodoCommentLikeTransition> {
		const comment = await this.client.todoComment.findFirstOrThrow({
			where: { id: commentId, todoId },
			select: { authorId: true, likeCount: true },
		});
		const changed = await this.client.todoCommentLike.updateMany({
			where: { commentId, userId, isActive: true },
			data: { isActive: false },
		});

		if (changed.count === 1) {
			await this.client.todoComment.updateMany({
				where: { id: commentId, likeCount: { gt: 0 } },
				data: { likeCount: { decrement: 1 } },
			});
		}

		const [current, like] = await Promise.all([
			this.client.todoComment.findUniqueOrThrow({
				where: { id: commentId },
				select: { likeCount: true },
			}),
			this.client.todoCommentLike.findUnique({
				where: { commentId_userId: { commentId, userId } },
				select: { notifiedAt: true },
			}),
		]);

		return {
			commentId,
			commentAuthorId: comment.authorId,
			changed: changed.count === 1,
			isLiked: false,
			likeCount: current.likeCount,
			wasEverNotified: like?.notifiedAt !== null && like !== null,
		};
	}

	async recordView(
		todoId: number,
		viewerId: string,
	): Promise<{ recorded: boolean; viewCount: number }> {
		const inserted = await this.client.todoView.createMany({
			data: [{ todoId, viewerId }],
			skipDuplicates: true,
		});

		if (inserted.count === 1) {
			const updated = await this.client.todo.update({
				where: { id: todoId },
				data: { viewCount: { increment: 1 } },
				select: { viewCount: true },
			});
			return { recorded: true, viewCount: updated.viewCount };
		}

		const todo = await this.client.todo.findUniqueOrThrow({
			where: { id: todoId },
			select: { viewCount: true },
		});
		return { recorded: false, viewCount: todo.viewCount };
	}
}
