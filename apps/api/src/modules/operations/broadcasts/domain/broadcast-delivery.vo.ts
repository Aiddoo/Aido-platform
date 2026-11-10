import { ErrorCode } from "@aido/api/errors";
import { match } from "ts-pattern";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

export type BroadcastDeliveryPrimitives =
  | { readonly mode: "NOW" }
  | {
      readonly mode: "RECIPIENT_LOCAL_TIME";
      readonly localTime: string;
      readonly date: string;
    };

export type BroadcastDeliveryValue =
  | { readonly mode: "NOW" }
  | {
      readonly mode: "RECIPIENT_LOCAL_TIME";
      readonly localTime: Temporal.PlainTime;
      readonly date: Temporal.PlainDate;
    };

// NOW는 접수 직후, RECIPIENT_LOCAL_TIME은 수신자 저장 시간대의 그 날짜·시각에 보낸다
export class BroadcastDelivery extends ValueObject<BroadcastDeliveryValue> {
  static immediate(): BroadcastDelivery {
    return new BroadcastDelivery({ mode: "NOW" });
  }

  static create(input: BroadcastDeliveryPrimitives): BroadcastDelivery {
    return match(input)
      .with({ mode: "NOW" }, () => BroadcastDelivery.immediate())
      .with({ mode: "RECIPIENT_LOCAL_TIME" }, (local) => {
        try {
          return new BroadcastDelivery({
            mode: "RECIPIENT_LOCAL_TIME",
            localTime: Temporal.PlainTime.from(local.localTime),
            date: Temporal.PlainDate.from(local.date),
          });
        } catch {
          throw new DomainException(ErrorCode.SYS_0002, { field: "delivery" });
        }
      })
      .exhaustive();
  }

  // 저장값은 접수할 때 이미 검증했다. 컬럼이 비어 있으면 이 기능 전에 접수한 캠페인이라 NOW다
  static reconstitute(input: BroadcastDeliveryPrimitives | null): BroadcastDelivery {
    return input == null ? BroadcastDelivery.immediate() : BroadcastDelivery.create(input);
  }

  toPrimitives(): BroadcastDeliveryPrimitives {
    const { value } = this;
    if (value.mode === "NOW") {
      return { mode: "NOW" };
    }
    return {
      mode: "RECIPIENT_LOCAL_TIME",
      localTime: value.localTime.toString({ smallestUnit: "minute" }),
      date: value.date.toString(),
    };
  }
}
