import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import type { TransactionClient } from "@/shared/infrastructure/database/prisma.types";

import { DEFAULT_CATEGORIES } from "../../domain/default-categories";

/**
 * 회원가입 기본 카테고리 생성 전용 capability.
 *
 * auth·oauth 회원가입은 아직 레거시 `database.$transaction(tx)`를 사용하며, 기본 카테고리 생성을
 * 그 트랜잭션에 명시적으로 참여시키기 위해 `tx`를 받는 이 경로를 유지한다. auth 이관(Wave 7) 시
 * 회원가입 기본 카테고리 시딩에서만 사용하며 CLS 트랜잭션에 참여한다.
 *
 * 트랜잭션은 CLS로 전파된다 — TransactionHost.tx가 활성 트랜잭션 클라이언트를, 없으면 베이스
 * DatabaseService를 반환한다.
 */
@Injectable()
export class DefaultTodoCategorySeeder {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	/** 기본 카테고리 일괄 생성 (레거시 명시적 tx 경로 지원) */
	async seed(userId: string, tx?: TransactionClient): Promise<number> {
		const client = tx ?? this.client;
		const data = DEFAULT_CATEGORIES.map((category) => ({
			userId,
			...category,
		}));
		const result = await client.todoCategory.createMany({ data });
		return result.count;
	}
}
