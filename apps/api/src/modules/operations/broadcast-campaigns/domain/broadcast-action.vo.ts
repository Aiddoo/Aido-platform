import type { NotificationActionType } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

export interface BroadcastActionPrimitives {
  readonly type: NotificationActionType;
  readonly url?: string;
}

// 알림을 눌렀을 때 앱이 할 일. 주소가 없는 동작은 url 칸을 두지 않아 같은 동작끼리 equals가 같다
export class BroadcastAction extends ValueObject<BroadcastActionPrimitives> {
  static create(input: BroadcastActionPrimitives): BroadcastAction {
    return new BroadcastAction({ type: input.type, ...(input.url != null && { url: input.url }) });
  }

  static reconstitute(primitives: BroadcastActionPrimitives): BroadcastAction {
    return BroadcastAction.create(primitives);
  }

  get type(): NotificationActionType {
    return this.value.type;
  }

  get url(): string | undefined {
    return this.value.url;
  }

  toPrimitives(): BroadcastActionPrimitives {
    return { ...this.value };
  }
}
