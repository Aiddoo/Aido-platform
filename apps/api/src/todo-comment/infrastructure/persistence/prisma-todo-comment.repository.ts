import { createHash } from "node:crypto";

import { ErrorCode } from "@aido/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import { Prisma } from "@/generated/prisma/client";
import { ApplicationException } from "@/shared/domain";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import {
	isUniqueConstraintViolation,
	uniqueConstraintTargets,
} from "@/shared/infrastructure/database/prisma-error.util";

import {
	TodoCommentIdempotencyConflict,
	TodoCommentIdempotencyRace,
	type TodoCommentRepositoryPort,
} from "../../application/ports/todo-comment.repository.port";
import type {
	CreateTodoCommentChainInput,
	TodoCommentChainCreationResult,
	TodoCommentChainCommand,
	TodoCommentLikeTransition,
} from "../../application/types";
import { TodoComment } from "../../domain/entities/todo-comment.aggregate";
import { TodoCommentId } from "../../domain/value-objects/todo-comment-id.vo";

type CommentRow = Prisma.TodoCommentGetPayload<object>;

interface ReplayRow {
	id: string;
	todoId: number;
	authorId: string;
	parentId: string | null;
	clientRequestId: string;
	requestFingerprint: string | null;
	content: string | null;
}

function commentCommandFingerprint(input: TodoCommentChainCommand): string {
	const command = JSON.stringify({
		version: 1,
		todoId: input.todoId,
		authorId: input.authorId,
		parentId: input.parentId,
		items: input.items,
	});

	return createHash("sha256").update(command).digest("hex");
}

function toAggregate(row: CommentRow): TodoComment | null {
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

function orderReplayRows(
	rows: readonly ReplayRow[],
	command: TodoCommentChainCommand,
): ReplayRow[] {
	const rowsByRequestId = new Map(rows.map((row) => [row.clientRequestId, row]));
	const ordered = command.items.flatMap((item) => {
		const row = rowsByRequestId.get(item.clientRequestId);
		return row ? [row] : [];
	});

	if (
		ordered.length !== command.items.length ||
		rows.length !== command.items.length ||
		new Set(command.items.map((item) => item.clientRequestId)).size !== command.items.length
	) {
		throw new TodoCommentIdempotencyConflict();
	}

	return ordered;
}

function isLegacyReplay(ordered: readonly ReplayRow[], command: TodoCommentChainCommand): boolean {
	return ordered.every((row, index) => {
		const previous = ordered[index - 1];
		const expectedParentId = index === 0 ? command.parentId : previous?.id;
		const item = command.items[index];

		return (
			item !== undefined &&
			expectedParentId !== undefined &&
			row.todoId === command.todoId &&
			row.authorId === command.authorId &&
			row.parentId === expectedParentId &&
			row.content === item.content
		);
	});
}

function isIdempotencyRace(error: unknown): boolean {
	if (!isUniqueConstraintViolation(error)) {
		return false;
	}

	const targets = uniqueConstraintTargets(error);
	if (targets === undefined) {
		// Prisma 7 driver adapter는 PostgreSQL P2002에 meta.target을 생략할 수 있다.
		// 이 insert의 id는 DB가 만들고, 유일한 업무 유니크는 authorId/clientRequestId다.
		return true;
	}

	return targets.includes("authorId") && targets.includes("clientRequestId");
}

@Injectable()
export class PrismaTodoCommentRepository implements TodoCommentRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	async findComment(todoId: number, commentId: string): Promise<TodoComment | null> {
		const row = await this.client.todoComment.findFirst({
			where: { id: commentId, todoId },
		});

		return row ? toAggregate(row) : null;
	}

	async findCommentChainReplay(input: TodoCommentChainCommand): Promise<string[] | null> {
		const clientRequestIds = input.items.map((item) => item.clientRequestId);
		const requestFingerprint = commentCommandFingerprint(input);
		const existing = await this.client.todoComment.findMany({
			where: { authorId: input.authorId, clientRequestId: { in: clientRequestIds } },
			select: {
				id: true,
				todoId: true,
				authorId: true,
				parentId: true,
				clientRequestId: true,
				requestFingerprint: true,
				content: true,
			},
		});

		if (existing.length === 0) {
			return null;
		}

		const ordered = orderReplayRows(existing, input);
		const allCurrent = ordered.every((row) => row.requestFingerprint === requestFingerprint);
		if (allCurrent) {
			return ordered.map((row) => row.id);
		}

		const allLegacy = ordered.every((row) => row.requestFingerprint === null);
		if (allLegacy && isLegacyReplay(ordered, input)) {
			return ordered.map((row) => row.id);
		}

		throw new TodoCommentIdempotencyConflict();
	}

	/** 글마다 부모가 바로 앞 글이라 insert는 순차지만, 응답 projection은 reader가 한 번에 hydrate한다. */
	async createCommentChain(
		input: CreateTodoCommentChainInput,
	): Promise<TodoCommentChainCreationResult> {
		const requestFingerprint = commentCommandFingerprint({
			todoId: input.todoId,
			authorId: input.authorId,
			parentId: input.placement.parentId?.getValue() ?? null,
			items: input.items,
		});
		let placement = input.placement;
		const commentIds: string[] = [];
		const lastIndex = input.items.length - 1;

		try {
			for (const [index, item] of input.items.entries()) {
				const row = await this.client.todoComment.create({
					data: {
						todoId: input.todoId,
						authorId: input.authorId,
						clientRequestId: item.clientRequestId,
						requestFingerprint,
						content: item.content,
						parentId: placement.parentId?.getValue() ?? null,
						rootId: placement.rootId?.getValue() ?? null,
						path: [...placement.path],
						depth: placement.depth,
						replyCount: index < lastIndex ? 1 : 0,
					},
					select: { id: true },
				});

				commentIds.push(row.id);
				placement = placement.under(TodoCommentId.create(row.id));
			}
		} catch (error) {
			if (isIdempotencyRace(error)) {
				throw new TodoCommentIdempotencyRace();
			}

			throw error;
		}

		return { commentIds, createdCount: commentIds.length };
	}

	async updateComment(comment: TodoComment): Promise<boolean> {
		const updated = await this.client.todoComment.updateMany({
			where: {
				id: comment.id.getValue(),
				todoId: comment.todoId,
				authorId: comment.authorId,
				deletedAt: null,
			},
			data: { content: comment.content, editedAt: comment.editedAt },
		});

		return updated.count === 1;
	}

	async deleteComment(comment: TodoComment): Promise<boolean> {
		const deleted = await this.client.todoComment.updateMany({
			where: {
				id: comment.id.getValue(),
				todoId: comment.todoId,
				authorId: comment.authorId,
				deletedAt: null,
			},
			data: { content: null, deletedAt: comment.deletedAt, likeCount: 0 },
		});

		if (deleted.count !== 1) {
			return false;
		}

		await this.client.todoCommentLike.updateMany({
			where: { commentId: comment.id.getValue(), isActive: true },
			data: { isActive: false },
		});

		return true;
	}

	async increaseTodoCommentCount(todoId: number, amount: number): Promise<void> {
		await this.client.todo.update({
			where: { id: todoId },
			data: { commentCount: { increment: amount } },
		});
	}

	async decrementTodoCommentCount(todoId: number): Promise<boolean> {
		const changed = await this.client.todo.updateMany({
			where: { id: todoId, commentCount: { gt: 0 } },
			data: { commentCount: { decrement: 1 } },
		});

		return changed.count === 1;
	}

	async incrementReplyCount(parentId: string): Promise<boolean> {
		const updated = await this.client.todoComment.updateMany({
			where: { id: parentId, deletedAt: null },
			data: { replyCount: { increment: 1 } },
		});

		return updated.count === 1;
	}

	async dropDeletedFromAncestors(commentId: string, path: readonly string[]): Promise<void> {
		const chain = [commentId, ...[...path].reverse()];
		const commentIds = Prisma.join(chain);

		// 방금 삭제한 행이 화면에서 사라질 때만 부모의 표시 가능한 직계 답글 수를 내린다.
		// 삭제된 부모가 마지막 자식을 잃으면 같은 규칙을 조상까지 이어 가되, 깊이마다 왕복하지 않는다.
		await this.client.$executeRaw(Prisma.sql`
			WITH RECURSIVE chain AS (
				SELECT item."commentId", item."ordinal"::INTEGER
				FROM unnest(ARRAY[${commentIds}]::TEXT[])
					WITH ORDINALITY AS item("commentId", "ordinal")
			),
			invisible AS (
				SELECT chain."commentId", chain."ordinal"
				FROM chain
				INNER JOIN "TodoComment" AS comment ON comment."id" = chain."commentId"
				WHERE chain."ordinal" = 1
					AND comment."deletedAt" IS NOT NULL
					AND comment."replyCount" = 0

				UNION ALL

				SELECT chain."commentId", chain."ordinal"
				FROM invisible AS child
				INNER JOIN chain ON chain."ordinal" = child."ordinal" + 1
				INNER JOIN "TodoComment" AS comment ON comment."id" = chain."commentId"
				WHERE comment."deletedAt" IS NOT NULL
					AND comment."replyCount" = 1
			),
			parents_to_decrement AS (
				SELECT parent."commentId"
				FROM invisible AS child
				INNER JOIN chain AS parent ON parent."ordinal" = child."ordinal" + 1
			)
			UPDATE "TodoComment" AS comment
			SET "replyCount" = comment."replyCount" - 1,
				"updatedAt" = CURRENT_TIMESTAMP
			FROM parents_to_decrement AS target
			WHERE comment."id" = target."commentId"
				AND comment."replyCount" > 0
		`);
	}

	async setLike(
		todoId: number,
		commentId: string,
		userId: string,
	): Promise<TodoCommentLikeTransition> {
		const comment = await this.client.todoComment.findFirstOrThrow({
			where: { id: commentId, todoId },
			select: { authorId: true, likeCount: true },
		});
		const existingLike = await this.client.todoCommentLike.findUnique({
			where: { commentId_userId: { commentId, userId } },
		});

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

		if (changed.count !== 1) {
			throw new ApplicationException(ErrorCode.SYS_0003, { commentId });
		}

		const updated = await this.client.todoComment.updateMany({
			where: { id: commentId, todoId, deletedAt: null },
			data: { likeCount: { increment: 1 } },
		});
		if (updated.count !== 1) {
			throw new ApplicationException(ErrorCode.SYS_0003, { commentId });
		}

		const current = await this.client.todoComment.findUniqueOrThrow({
			where: { id: commentId },
			select: { likeCount: true },
		});

		return {
			commentId,
			commentAuthorId: comment.authorId,
			changed: true,
			isLiked: true,
			likeCount: current.likeCount,
			wasEverNotified: existingLike?.notifiedAt !== null && existingLike !== null,
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
		const existingLike = await this.client.todoCommentLike.findUnique({
			where: { commentId_userId: { commentId, userId } },
		});

		if (!existingLike?.isActive) {
			return {
				commentId,
				commentAuthorId: comment.authorId,
				changed: false,
				isLiked: false,
				likeCount: comment.likeCount,
				wasEverNotified: existingLike?.notifiedAt !== null && existingLike !== null,
			};
		}

		const changed = await this.client.todoCommentLike.updateMany({
			where: { commentId, userId, isActive: true },
			data: { isActive: false },
		});
		if (changed.count !== 1) {
			throw new ApplicationException(ErrorCode.SYS_0003, { commentId });
		}

		const updated = await this.client.todoComment.updateMany({
			where: { id: commentId, todoId, deletedAt: null, likeCount: { gt: 0 } },
			data: { likeCount: { decrement: 1 } },
		});
		if (updated.count !== 1) {
			throw new ApplicationException(ErrorCode.SYS_0003, { commentId });
		}

		const current = await this.client.todoComment.findUniqueOrThrow({
			where: { id: commentId },
			select: { likeCount: true },
		});
		const like = await this.client.todoCommentLike.findUnique({
			where: { commentId_userId: { commentId, userId } },
			select: { notifiedAt: true },
		});

		return {
			commentId,
			commentAuthorId: comment.authorId,
			changed: true,
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
