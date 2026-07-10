import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { UnitOfWorkPort } from "@/common/database";
import type { DatabaseService } from "./database.service";

/**
 * CLS 기반 Unit of Work 어댑터
 *
 * UNIT_OF_WORK 포트의 nestjs-cls 구현체. TransactionHost.withTransaction이
 * 자체 CLS 스코프를 열므로 HTTP 요청·CQRS 핸들러·BullMQ 프로세서 어디서든
 * 미들웨어 없이 동작합니다. 리포지토리는 TransactionHost.tx로 활성
 * 트랜잭션을 읽고, 활성 트랜잭션이 없으면 베이스 DatabaseService로
 * 폴백합니다(기존 `tx ?? this.database`와 등가).
 *
 * 주의: withTransaction에 옵션 객체를 전달하지 않습니다 — 기존
 * `database.$transaction(fn)` 시맨틱(기본 격리수준)을 그대로 보존합니다.
 */
@Injectable()
export class ClsUnitOfWork implements UnitOfWorkPort {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	run<T>(work: () => Promise<T>): Promise<T> {
		return this.txHost.withTransaction(work);
	}
}
