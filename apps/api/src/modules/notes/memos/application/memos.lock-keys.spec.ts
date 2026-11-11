import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { MemoId } from "../domain/memo-id.vo.js";
import { MemoLockKeys } from "./memos.lock-keys.js";

// voice 계획 저장, 배포가 겹치는 동안의 이전 버전과 같은 잠금을 잡아야 해서 문자열을 바이트 단위로 고정한다
describe("MemoLockKeys", () => {
  it("메모·메모 순서 잠금 키는 옮기기 전 문자열과 같다", () => {
    // When
    const keys = [
      MemoLockKeys.memo(MemoId.reconstitute(7)),
      MemoLockKeys.sortOrder(UserId.reconstitute("user-a")),
    ];

    // Then
    expect(keys).toEqual(["mutation:v1:memo:7", "mutation:v1:memo-sort-order:user-a"]);
  });
});
