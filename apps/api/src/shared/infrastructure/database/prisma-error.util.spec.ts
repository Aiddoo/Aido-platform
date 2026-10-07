import { sqlQueryError } from "#test/mocks/database.mock";

import {
	databaseConstraint,
	DatabaseRecordNotFoundError,
	databaseSqlState,
	isRecordNotFoundError,
	isTransactionWriteConflict,
	isUniqueConstraintViolation,
	uniqueConstraintTargets,
} from "./prisma-error.util.js";

describe("native PostgreSQL error boundary", () => {
	it.each(["40001", "40P01"])("retries transaction failure %s", (state) => {
		expect(isTransactionWriteConflict(sqlQueryError(state))).toBe(true);
	});
	it.each(["23503", "23505", "XX000"])("does not retry non-transaction failure %s", (state) => {
		expect(isTransactionWriteConflict(sqlQueryError(state))).toBe(false);
	});
	it("rejects unnormalized lookalike errors", () => {
		expect(databaseSqlState(Object.assign(new Error("plain"), { code: "40001" }))).toBeUndefined();
		expect(isTransactionWriteConflict(new Error("TransactionWriteConflict"))).toBe(false);
	});
	it("resolves native unique constraint fields from the contract", () => {
		const error = sqlQueryError("23505", "User_email_key");
		expect(isUniqueConstraintViolation(error)).toBe(true);
		expect(databaseConstraint(error)).toBe("User_email_key");
		expect(uniqueConstraintTargets(error)).toEqual(["email"]);
		expect(uniqueConstraintTargets(sqlQueryError("23505", "unmanaged_index"))).toBeUndefined();
	});
	it("preserves explicit record-not-found errors", () => {
		expect(isRecordNotFoundError(new DatabaseRecordNotFoundError())).toBe(true);
		expect(isRecordNotFoundError(new Error("missing"))).toBe(false);
	});
});
