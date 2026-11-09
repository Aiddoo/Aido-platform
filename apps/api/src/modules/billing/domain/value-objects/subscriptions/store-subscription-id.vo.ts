import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

/** 스토어 갱신 체인의 ID(원 거래 ID). 갱신마다 바뀌는 거래 ID와 섞이지 않게 값으로 감싼다. */
export class StoreSubscriptionId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  /** 체인 ID가 없으면 처리할 구독을 찾을 수 없어 SUBSCRIPTION_1604로 거절한다. */
  static from(value: string | null | undefined): StoreSubscriptionId {
    if (value == null || value === "") {
      throw new ApplicationException(ErrorCode.SUBSCRIPTION_1604, {
        reason: "Missing store subscription id",
      });
    }
    return new StoreSubscriptionId(value);
  }

  get value(): string {
    return this.#value;
  }

  equals(other: StoreSubscriptionId): boolean {
    return this.#value === other.#value;
  }
}
