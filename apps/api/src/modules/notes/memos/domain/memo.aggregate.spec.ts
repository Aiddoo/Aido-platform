import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { MemoContent } from "./memo-content.vo.js";
import { MemoId } from "./memo-id.vo.js";
import { Memo } from "./memo.aggregate.js";

const CREATED_AT = Temporal.Instant.from("2027-01-08T12:00:00Z");
const LATER = CREATED_AT.add({ seconds: 5 });

function createMemo(): Memo {
  return Memo.create({
    id: MemoId.reconstitute(1),
    userId: UserId.reconstitute("clz7x5p8k0001qz0z8z8z8z8z"),
    content: MemoContent.create("기존 내용"),
    sortOrder: 4,
    now: CREATED_AT,
    creationRequest: null,
  });
}

describe("Memo 상태 전이", () => {
  it("새 메모는 고정하지 않은 채 생성·수정 시각을 같은 시각으로 둔다", () => {
    // Given
    const memo = createMemo();

    // When
    const primitives = memo.toPrimitives();

    // Then
    expect(primitives).toEqual({
      id: 1,
      userId: "clz7x5p8k0001qz0z8z8z8z8z",
      content: "기존 내용",
      isPinned: false,
      sortOrder: 4,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      idempotencyKey: null,
      requestHash: null,
    });
  });

  it.each([
    {
      name: "내용 수정",
      change: (memo: Memo) => memo.rewrite(MemoContent.create("새 내용"), LATER),
      expected: { content: "새 내용" },
    },
    {
      name: "고정",
      change: (memo: Memo) => memo.changePinned(true, LATER),
      expected: { isPinned: true },
    },
    {
      name: "순서 이동",
      change: (memo: Memo) => memo.moveTo(0, LATER),
      expected: { sortOrder: 0 },
    },
  ])("$name은 바뀌면 true이고 수정 시각만 함께 옮긴다", ({ change, expected }) => {
    // Given
    const memo = createMemo();

    // When
    const isChanged = change(memo);

    // Then
    expect(isChanged).toBe(true);
    expect(memo.toPrimitives()).toEqual({
      ...createMemo().toPrimitives(),
      ...expected,
      updatedAt: LATER,
    });
  });

  it.each([
    {
      name: "같은 내용",
      change: (memo: Memo) => memo.rewrite(MemoContent.create("기존 내용"), LATER),
    },
    { name: "같은 고정 상태", change: (memo: Memo) => memo.changePinned(false, LATER) },
    { name: "같은 순서", change: (memo: Memo) => memo.moveTo(4, LATER) },
  ])("$name이면 false이고 수정 시각을 포함해 아무것도 바꾸지 않는다", ({ change }) => {
    // Given
    const memo = createMemo();

    // When
    const isChanged = change(memo);

    // Then
    expect(isChanged).toBe(false);
    expect(memo.toPrimitives()).toEqual(createMemo().toPrimitives());
  });
});
