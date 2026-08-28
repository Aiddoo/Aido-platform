import { Injectable } from "@nestjs/common";

import { Prisma, type PushRateLimitPhase } from "@/generated/prisma/client";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	EngagementPushRateLimitRequest,
	GeneralPushRateLimitRequest,
	PushRateLimitRequest,
	PushRateLimiterPort,
} from "../../application/ports/push-rate-limiter.port";
import { PUSH_RATE_LIMIT_POLICY } from "../../domain/services/push-rate-limit-policy";

const { GENERAL, ENGAGEMENT } = PUSH_RATE_LIMIT_POLICY;
const MAX_TRANSACTION_RETRIES = 5;

interface ReservationRequest extends PushRateLimitRequest {
	readonly reserveGeneral: boolean;
}

interface ReservationRecord {
	readonly dispatchId: number;
	readonly phase: PushRateLimitPhase;
	readonly userId: string;
	readonly localDate: Date | null;
}

/** Prisma ORM과 Serializable 트랜잭션으로 구현한 영속 푸시 rate limiter. */
@Injectable()
export class PostgresPushRateLimiter implements PushRateLimiterPort {
	constructor(private readonly database: DatabaseService) {}

	async reserveGeneral(request: GeneralPushRateLimitRequest): Promise<boolean> {
		const [limited] = await this.#reserve([{ ...request, reserveGeneral: true }]);
		return this.#requiredDecision(limited, request.dispatchId);
	}

	async reserveEngagement(request: EngagementPushRateLimitRequest): Promise<boolean> {
		const [limited] = await this.#reserve([
			{
				dispatchId: request.dispatchId,
				userId: request.userId,
				reserveGeneral: false,
				engagementLocalDate: request.localDate,
			},
		]);
		return this.#requiredDecision(limited, request.dispatchId);
	}

	async reserveBatch(requests: readonly PushRateLimitRequest[]): Promise<readonly boolean[]> {
		return this.#reserve(requests.map((request) => ({ ...request, reserveGeneral: true })));
	}

	async #reserve(requests: readonly ReservationRequest[]): Promise<readonly boolean[]> {
		if (requests.length === 0) return [];
		this.#assertRequests(requests);

		for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
			try {
				return await this.database.$transaction(
					async (transaction) => {
						const dispatchIds = requests.map(({ dispatchId }) => dispatchId);
						const userIds = requests.map(({ userId }) => userId);
						const generalWindowStart = new Date(Date.now() - GENERAL.WINDOW_MS);
						const engagementDates = requests.flatMap(({ engagementLocalDate }) =>
							engagementLocalDate ? [this.#toDate(engagementLocalDate)] : [],
						);

						const dispatches = await transaction.pushDispatch.findMany({
							where: { id: { in: dispatchIds } },
							select: { id: true, userId: true },
						});
						const existing = await transaction.pushRateLimitReservation.findMany({
							where: { dispatchId: { in: dispatchIds } },
							select: { dispatchId: true, phase: true },
						});
						const generalStats = await transaction.pushRateLimitReservation.groupBy({
							by: ["userId"],
							where: {
								phase: "GENERAL",
								userId: { in: userIds },
								reservedAt: { gt: generalWindowStart },
							},
							_count: { _all: true },
						});
						const engagementStats = await transaction.pushRateLimitReservation.groupBy({
							by: ["userId", "localDate"],
							where: {
								phase: "ENGAGEMENT",
								userId: { in: userIds },
								localDate: { in: engagementDates },
							},
							_count: { _all: true },
							_max: { reservedAt: true },
						});

						this.#assertDispatchOwnership(requests, dispatches);
						const decisions = this.#decide(requests, existing, generalStats, engagementStats);
						if (decisions.reservations.length > 0) {
							await transaction.pushRateLimitReservation.createMany({
								data: [...decisions.reservations],
							});
						}
						return decisions.limited;
					},
					{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
				);
			} catch (error) {
				if (this.#isRetryableConflict(error) && attempt < MAX_TRANSACTION_RETRIES) continue;
				throw error;
			}
		}

		throw new Error("Push rate limit transaction retry budget exhausted");
	}

	#decide(
		requests: readonly ReservationRequest[],
		existing: readonly { dispatchId: number; phase: PushRateLimitPhase }[],
		generalStats: readonly { userId: string; _count: { _all: number } }[],
		engagementStats: readonly {
			userId: string;
			localDate: Date | null;
			_count: { _all: number };
			_max: { reservedAt: Date | null };
		}[],
	): { readonly limited: readonly boolean[]; readonly reservations: readonly ReservationRecord[] } {
		const existingKeys = new Set(existing.map(({ dispatchId, phase }) => `${dispatchId}:${phase}`));
		const generalByUser = new Map(generalStats.map((row) => [row.userId, row._count._all]));
		const engagementByUserDate = new Map(
			engagementStats.map((row) => [
				this.#engagementKey(row.userId, row.localDate),
				{ count: row._count._all, lastReservedAt: row._max.reservedAt },
			]),
		);
		const reservations: ReservationRecord[] = [];
		const now = Date.now();
		const limited = requests.map((request) => {
			const generalReserved = existingKeys.has(`${request.dispatchId}:GENERAL`);
			const engagementReserved = existingKeys.has(`${request.dispatchId}:ENGAGEMENT`);
			const localDate = request.engagementLocalDate
				? this.#toDate(request.engagementLocalDate)
				: null;
			const engagement = localDate
				? engagementByUserDate.get(this.#engagementKey(request.userId, localDate))
				: undefined;
			const isLimited =
				(request.reserveGeneral &&
					!generalReserved &&
					(generalByUser.get(request.userId) ?? 0) >= GENERAL.MAX) ||
				(localDate !== null &&
					!engagementReserved &&
					((engagement?.count ?? 0) >= ENGAGEMENT.DAILY_MAX ||
						(engagement?.lastReservedAt !== null &&
							engagement?.lastReservedAt !== undefined &&
							now - engagement.lastReservedAt.getTime() < ENGAGEMENT.MIN_INTERVAL_MS)));
			if (isLimited) return true;

			if (request.reserveGeneral && !generalReserved) {
				reservations.push({
					dispatchId: request.dispatchId,
					phase: "GENERAL",
					userId: request.userId,
					localDate: null,
				});
			}
			if (localDate && !engagementReserved) {
				reservations.push({
					dispatchId: request.dispatchId,
					phase: "ENGAGEMENT",
					userId: request.userId,
					localDate,
				});
			}
			return false;
		});
		return { limited, reservations };
	}

	#assertRequests(requests: readonly ReservationRequest[]): void {
		const dispatchIds = new Set<number>();
		const userIds = new Set<string>();
		for (const request of requests) {
			if (!Number.isSafeInteger(request.dispatchId) || request.dispatchId <= 0) {
				throw new Error(`Invalid push dispatch id: ${request.dispatchId}`);
			}
			if (request.userId.length === 0) throw new Error("Push rate limit user id is required");
			if (dispatchIds.has(request.dispatchId)) {
				throw new Error(`Duplicate push dispatch id: ${request.dispatchId}`);
			}
			if (userIds.has(request.userId)) {
				throw new Error(`Duplicate push rate limit user in batch: ${request.userId}`);
			}
			dispatchIds.add(request.dispatchId);
			userIds.add(request.userId);
		}
	}

	#assertDispatchOwnership(
		requests: readonly ReservationRequest[],
		dispatches: readonly { id: number; userId: string }[],
	): void {
		const ownerByDispatchId = new Map(dispatches.map(({ id, userId }) => [id, userId]));
		for (const request of requests) {
			if (ownerByDispatchId.get(request.dispatchId) !== request.userId) {
				throw new Error(`Push rate limit dispatch ownership mismatch: ${request.dispatchId}`);
			}
		}
	}

	#engagementKey(userId: string, localDate: Date | null): string {
		return `${userId}:${localDate?.toISOString().slice(0, 10) ?? "none"}`;
	}

	#toDate(localDate: string): Date {
		return new Date(`${localDate}T00:00:00.000Z`);
	}

	#isRetryableConflict(error: unknown): boolean {
		return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
	}

	#requiredDecision(value: boolean | undefined, dispatchId: number): boolean {
		if (value === undefined) {
			throw new Error(`Push rate limit reservation result missing: dispatchId=${dispatchId}`);
		}
		return value;
	}
}
