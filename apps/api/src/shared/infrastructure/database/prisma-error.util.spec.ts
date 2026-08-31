import { Prisma } from "@/generated/prisma/client";

import { isTransactionWriteConflict } from "./prisma-error.util";

describe("isTransactionWriteConflict — Prisma 트랜잭션 충돌 판별", () => {
	it("Prisma P2034 오류를 재시도 대상으로 판별한다", () => {
		// Given - Prisma가 정규화한 write conflict
		const error = new Prisma.PrismaClientKnownRequestError("Transaction write conflict", {
			code: "P2034",
			clientVersion: "7.10.0",
		});

		// When - 충돌 여부를 판별
		const result = isTransactionWriteConflict(error);

		// Then - 안전한 트랜잭션 재시도를 허용
		expect(result).toBe(true);
	});

	it("driver adapter가 노출한 write conflict를 재시도 대상으로 판별한다", () => {
		// Given - interactive transaction commit에서 노출될 수 있는 adapter 오류
		const error = new Error("TransactionWriteConflict", {
			cause: { kind: "TransactionWriteConflict" },
		});
		error.name = "DriverAdapterError";

		// When - 충돌 여부를 판별
		const result = isTransactionWriteConflict(error);

		// Then - 동일한 PostgreSQL 충돌 의미로 처리
		expect(result).toBe(true);
	});

	it("다른 driver adapter 오류는 재시도하지 않는다", () => {
		// Given - 재시도로 해결되지 않는 외래 키 오류
		const error = new Error("ForeignKeyConstraintViolation", {
			cause: { kind: "ForeignKeyConstraintViolation" },
		});
		error.name = "DriverAdapterError";

		// When - 충돌 여부를 판별
		const result = isTransactionWriteConflict(error);

		// Then - 오류를 그대로 전파하도록 재시도를 거부
		expect(result).toBe(false);
	});

	it("이름이 다른 구조적 유사 오류는 재시도하지 않는다", () => {
		// Given - cause 모양만 같은 일반 오류
		const error = new Error("TransactionWriteConflict", {
			cause: { kind: "TransactionWriteConflict" },
		});

		// When - 충돌 여부를 판별
		const result = isTransactionWriteConflict(error);

		// Then - Prisma adapter 경계 밖 오류는 재시도하지 않음
		expect(result).toBe(false);
	});
});
