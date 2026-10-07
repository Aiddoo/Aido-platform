import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { MemoBuilder } from "#test/builders/memo.builder";

import { Memo } from "./memo.aggregate.js";

const CREATED_AT = new Date("2027-01-08T12:00:00.000Z");

describe("Memo 상태 전이", () => {
  it("복원 입력의 내용과 날짜가 바뀌어도 저장된 메모 상태는 유지한다", () => {
    // Given
    const record = MemoBuilder.create("memo-owner")
      .withContent("원래 내용")
      .withCreatedAt(new Date(CREATED_AT))
      .build();
    record.updatedAt = new Date(CREATED_AT);
    const memo = Memo.reconstitute(record);

    // When
    record.content = "외부에서 변경된 내용";
    record.isPinned = true;
    record.createdAt.setUTCFullYear(2030);
    record.updatedAt.setUTCFullYear(2031);

    // Then
    expect(memo.snapshot).toMatchObject({
      content: "원래 내용",
      isPinned: false,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });
  });

  it("snapshot 날짜를 수정해도 이후 메모 응답에 쓸 날짜는 바뀌지 않는다", () => {
    // Given
    const record = MemoBuilder.create("memo-owner").withCreatedAt(new Date(CREATED_AT)).build();
    record.updatedAt = new Date(CREATED_AT);
    const memo = Memo.reconstitute(record);
    const snapshot = memo.snapshot;

    // When
    snapshot.createdAt.setUTCFullYear(2030);
    snapshot.updatedAt.setUTCFullYear(2031);

    // Then
    expect(memo.snapshot.createdAt).toEqual(CREATED_AT);
    expect(memo.snapshot.updatedAt).toEqual(CREATED_AT);
  });

  it("잘못된 내용 수정은 기존 내용과 고정·정렬 상태를 변경하지 않는다", () => {
    // Given
    const memo = Memo.reconstitute(
      MemoBuilder.create("memo-owner").withContent("기존 내용").pinned().withSortOrder(4).build(),
    );

    // When / Then
    expect(() => memo.rename("")).toThrow(DomainException);
    expect(() => memo.rename("")).toThrow(
      expect.objectContaining({
        errorCode: ErrorCode.SYS_0002,
        details: { field: "content", length: 0 },
      }),
    );
    expect(memo.snapshot).toMatchObject({ content: "기존 내용", isPinned: true, sortOrder: 4 });
  });

  it("내용과 고정을 변경해도 메모의 소유자·정렬·저장 시각은 유지한다", () => {
    // Given
    const record = MemoBuilder.create("memo-owner")
      .withContent("기존 내용")
      .withSortOrder(4)
      .build();
    const memo = Memo.reconstitute(record);

    // When
    memo.rename("새 내용");
    memo.setPinned(true);
    memo.setPinned(true);

    // Then
    expect(memo.snapshot).toEqual({ ...record, content: "새 내용", isPinned: true });
    expect(memo.toTodoTitle()).toBe("새 내용");
  });
});
