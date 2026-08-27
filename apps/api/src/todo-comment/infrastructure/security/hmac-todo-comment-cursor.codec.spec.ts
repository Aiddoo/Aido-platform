import { TODO_COMMENT_SORT, z } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

import type {
	TodoCommentOverviewRootRecord,
	TodoConversationRecord,
} from "../../application/types";
import { HmacTodoCommentCursorCodec } from "./hmac-todo-comment-cursor.codec";

const record: TodoConversationRecord = {
	id: "cm1todoacomment00000000001",
	todoId: 1,
	parentId: null,
	rootId: null,
	path: [],
	depth: 0,
	parentAuthorName: null,
	authorId: "cm1author0000000000000001",
	authorName: "작성자",
	authorProfileImage: null,
	todoOwnerId: "cm1author0000000000000001",
	content: "댓글",
	likeCount: 3,
	replyCount: 2,
	deletedAt: null,
	editedAt: null,
	createdAt: "2026-08-14T00:00:00.000Z",
	conversationPosition: { rootLikeCount: 3, rootReplyCount: 2 },
	continuingAncestorDepths: [],
};
const overviewRoot: TodoCommentOverviewRootRecord = {
	...record,
	overviewPosition: record.conversationPosition,
};

function replacePayload(
	cursor: string,
	update: (payload: Record<string, unknown>) => void,
): string {
	const [encodedPayload, signature] = cursor.split(".");
	if (encodedPayload === undefined || signature === undefined) {
		throw new Error("테스트 cursor 형식이 올바르지 않습니다.");
	}

	const decoded = z
		.record(z.string(), z.unknown())
		.safeParse(JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")));
	if (!decoded.success) {
		throw new Error("테스트 cursor payload가 객체가 아닙니다.");
	}

	update(decoded.data);
	const tamperedPayload = Buffer.from(JSON.stringify(decoded.data), "utf8").toString("base64url");
	return `${tamperedPayload}.${signature}`;
}

describe("HmacTodoCommentCursorCodec", () => {
	let codec: HmacTodoCommentCursorCodec;
	let config: Mocked<TypedConfigService>;
	let secret: string;

	beforeEach(async () => {
		const testBed = await TestBed.solitary(HmacTodoCommentCursorCodec).compile();
		codec = testBed.unit;
		config = testBed.unitRef.get(TypedConfigService);
		secret = "test-jwt-secret-at-least-32-characters";
		Object.defineProperty(config, "jwtSecret", { configurable: true, get: () => secret });
	});

	it.each([TODO_COMMENT_SORT.LATEST, TODO_COMMENT_SORT.POPULAR])(
		"%s conversation cursor를 서명하고 경계를 복원한다",
		(sort) => {
			const cursor = codec.encodeConversation(record, sort);

			expect(codec.decodeConversation(cursor, sort)).toEqual({
				v: 1,
				kind: "conversation",
				sort,
				todoId: record.todoId,
				commentId: record.id,
				threadId: record.id,
				scope: "TODO",
				position: record.conversationPosition,
			});
		},
	);

	it("답글과 focus cursor의 thread 경계를 보존한다", () => {
		const reply = { ...record, id: "cm1todoacomment00000000002", rootId: record.id };
		const cursor = codec.encodeConversation(reply, TODO_COMMENT_SORT.LATEST, "THREAD");

		expect(codec.decodeConversation(cursor, TODO_COMMENT_SORT.LATEST)).toMatchObject({
			threadId: record.id,
			scope: "THREAD",
		});
	});

	it("payload의 인기 rank를 변경하면 서명 검증에서 거부한다", () => {
		const cursor = codec.encodeConversation(record, TODO_COMMENT_SORT.POPULAR);
		const tampered = replacePayload(cursor, (payload) => {
			payload.position = { rootLikeCount: 400, rootReplyCount: 2 };
		});

		expect(() => codec.decodeConversation(tampered, TODO_COMMENT_SORT.POPULAR)).toThrow();
	});

	it("서명 한 글자를 변경하면 거부한다", () => {
		const cursor = codec.encodeConversation(record, TODO_COMMENT_SORT.LATEST);
		const [payload, signature] = cursor.split(".");
		if (payload === undefined || signature === undefined) {
			throw new Error("테스트 cursor 형식이 올바르지 않습니다.");
		}
		const first = signature.at(0);
		if (first === undefined) {
			throw new Error("테스트 cursor 서명이 비어 있습니다.");
		}
		const tampered = `${payload}.${first === "a" ? "b" : "a"}${signature.slice(1)}`;

		expect(() => codec.decodeConversation(tampered, TODO_COMMENT_SORT.LATEST)).toThrow();
	});

	it("다른 secret으로 만든 cursor를 거부한다", () => {
		const cursor = codec.encodeConversation(record, TODO_COMMENT_SORT.LATEST);
		secret = "another-jwt-secret-at-least-32-characters";

		expect(() => codec.decodeConversation(cursor, TODO_COMMENT_SORT.LATEST)).toThrow();
	});

	it("정렬 종류가 다른 cursor를 거부한다", () => {
		const cursor = codec.encodeConversation(record, TODO_COMMENT_SORT.LATEST);

		expect(() => codec.decodeConversation(cursor, TODO_COMMENT_SORT.POPULAR)).toThrow();
	});

	it("overview cursor를 conversation 경계로 재사용하지 못한다", () => {
		const cursor = codec.encodeOverview(overviewRoot, TODO_COMMENT_SORT.LATEST);

		expect(() => codec.decodeConversation(cursor, TODO_COMMENT_SORT.LATEST)).toThrow();
	});

	it.each([TODO_COMMENT_SORT.LATEST, TODO_COMMENT_SORT.POPULAR])(
		"%s overview cursor를 서명하고 root 경계를 복원한다",
		(sort) => {
			const cursor = codec.encodeOverview(overviewRoot, sort);

			expect(codec.decodeOverview(cursor, sort)).toEqual({
				v: 1,
				kind: "overview",
				sort,
				todoId: overviewRoot.todoId,
				rootId: overviewRoot.id,
				position: overviewRoot.overviewPosition,
			});
		},
	);

	it("답글을 overview root cursor로 만들지 않는다", () => {
		const reply: TodoCommentOverviewRootRecord = {
			...overviewRoot,
			id: "cm1todoacomment00000000002",
			parentId: overviewRoot.id,
			rootId: overviewRoot.id,
		};

		expect(() => codec.encodeOverview(reply, TODO_COMMENT_SORT.LATEST)).toThrow();
	});
});
