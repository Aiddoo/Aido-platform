import { ErrorCode } from "@aido/errors";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

/**
 * RevenueCat 거래 ID 값 객체.
 *
 * RevenueCat은 original_transaction_id를 갱신 체인 식별에 사용하며, 없으면 transaction_id로
 * 대체한다. 둘 다 없으면 웹훅 처리 실패(SUBSCRIPTION_1604)로 간주한다.
 */
export class TransactionId {
	private constructor(private readonly _value: string) {}

	get value(): string {
		return this._value;
	}

	static resolve(
		originalTransactionId: string | null | undefined,
		transactionId: string | null | undefined,
		eventType: string,
	): TransactionId {
		const resolved = originalTransactionId ?? transactionId;
		if (!resolved) {
			throw new ApplicationException(ErrorCode.SUBSCRIPTION_1604, {
				reason: "Missing transaction_id and original_transaction_id",
				eventType,
			});
		}
		return new TransactionId(resolved);
	}
}
