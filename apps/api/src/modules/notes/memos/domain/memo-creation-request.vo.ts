import { createHash } from "node:crypto";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { ValueObject } from "#api/shared/domain/model/value-object";

interface MemoCreationRequestValue {
  readonly idempotencyKey: string;
  readonly requestHash: string;
}

/** 앱이 저장 한 번마다 만든 Idempotency-Key와 그 요청의 해시. 응답을 받지 못해 다시 보낸 저장을 알아본다 */
export class MemoCreationRequest extends ValueObject<MemoCreationRequestValue> {
  static create(params: {
    readonly userId: UserId;
    readonly idempotencyKey: string;
    readonly content: string;
  }): MemoCreationRequest {
    // 글은 메모에 이미 있어 비교용 해시만 남긴다. 사용자 id를 앞에 섞어 짧은 글의 해시를 사용자끼리 비교할 수 없게 한다
    const requestHash = createHash("sha256")
      .update(params.userId.value)
      .update("\0")
      .update(params.content)
      .digest("hex");
    return new MemoCreationRequest({ idempotencyKey: params.idempotencyKey, requestHash });
  }

  static reconstitute(value: MemoCreationRequestValue): MemoCreationRequest {
    return new MemoCreationRequest(value);
  }

  get idempotencyKey(): string {
    return this.value.idempotencyKey;
  }

  get requestHash(): string {
    return this.value.requestHash;
  }
}
