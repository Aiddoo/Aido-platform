import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { MemoCreationRequest } from "./memo-creation-request.vo.js";

const USER_ID = UserId.reconstitute("clz7x5p8k0001qz0z8z8z8z8z");

describe("MemoCreationRequest", () => {
  // 저장된 requestHash와 다시 보낸 요청의 해시를 비교하므로, 배포가 바뀌어도 같은 글이면 같은 값이어야 한다
  it("해시는 옮기기 전 fingerprintMemoCreation과 바이트 단위로 같다", () => {
    // When
    const request = MemoCreationRequest.create({
      userId: USER_ID,
      idempotencyKey: "memo-create-1",
      content: "장보기: 우유, 계란, 빵",
    });

    // Then
    expect(request.requestHash).toBe(
      "4dcc45f088aada003eba8598c20d49a7e4a358212efe969f38696e397b44a039",
    );
  });

  it("같은 키라도 글이나 사용자가 다르면 다른 요청이다", () => {
    // Given
    const original = MemoCreationRequest.create({
      userId: USER_ID,
      idempotencyKey: "memo-create-1",
      content: "처음 글",
    });

    // When
    const results = [
      original.equals(
        MemoCreationRequest.create({
          userId: USER_ID,
          idempotencyKey: "memo-create-1",
          content: "처음 글",
        }),
      ),
      original.equals(
        MemoCreationRequest.create({
          userId: USER_ID,
          idempotencyKey: "memo-create-1",
          content: "고친 글",
        }),
      ),
      original.equals(
        MemoCreationRequest.create({
          userId: UserId.reconstitute("clz7x5p8k0002qz0z8z8z8z8z"),
          idempotencyKey: "memo-create-1",
          content: "처음 글",
        }),
      ),
    ];

    // Then
    expect(results).toEqual([true, false, false]);
  });
});
