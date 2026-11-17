import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { ValueObject } from "#api/shared/domain/model/value-object";

import type { WinbackStageName } from "./winback-stage.constants.js";

interface WinbackStageMarkValue {
  readonly recipientId: UserId;
  readonly stage: WinbackStageName;
}

// 한 사용자에게 그 윈백 단계를 이미 보냈다는 표시다. 단계마다 한 번만 보낸다
export class WinbackStageMark extends ValueObject<WinbackStageMarkValue> {
  static create(value: WinbackStageMarkValue): WinbackStageMark {
    return new WinbackStageMark({ ...value });
  }

  get recipientId(): UserId {
    return this.value.recipientId;
  }

  get stage(): WinbackStageName {
    return this.value.stage;
  }
}
