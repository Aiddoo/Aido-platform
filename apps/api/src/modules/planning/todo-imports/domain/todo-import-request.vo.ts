import { createHash } from "node:crypto";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { ValueObject } from "#api/shared/domain/model/value-object";

interface TodoImportRequestValue {
  readonly idempotencyKey: string;
  readonly requestHash: string;
}

/** 앱이 시작 요청마다 만든 Idempotency-Key와 그 요청의 해시. 응답을 받지 못해 다시 보낸 시작을 알아본다 */
export class TodoImportRequest extends ValueObject<TodoImportRequestValue> {
  // canonicalBody는 부르는 쪽이 키 순서를 고정해 만든 요청 본문이다
  static create(params: {
    readonly userId: UserId;
    readonly idempotencyKey: string;
    readonly canonicalBody: string;
  }): TodoImportRequest {
    // 사용자 id를 앞에 섞어 같은 본문의 해시를 사용자끼리 비교할 수 없게 한다
    const requestHash = createHash("sha256")
      .update(params.userId.value)
      .update("\0")
      .update(params.canonicalBody)
      .digest("hex");
    return new TodoImportRequest({ idempotencyKey: params.idempotencyKey, requestHash });
  }

  static reconstitute(value: TodoImportRequestValue): TodoImportRequest {
    return new TodoImportRequest(value);
  }

  get idempotencyKey(): string {
    return this.value.idempotencyKey;
  }

  get requestHash(): string {
    return this.value.requestHash;
  }
}
