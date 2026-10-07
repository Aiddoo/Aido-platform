import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { encodeCreate } from "#api/shared/infrastructure/database/database-records";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

import { DEFAULT_CATEGORIES } from "../../domain/default-categories.js";

/** 회원가입의 활성 CLS 트랜잭션에서 기본 카테고리를 일괄 생성한다. */
@Injectable()
export class DefaultTodoCategorySeeder {
	constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	/** 기본 카테고리 일괄 생성 (레거시 명시적 tx 경로 지원) */
	async seed(userId: string): Promise<number> {
		const client = this.client;
		const data = DEFAULT_CATEGORIES.map((category) => ({
			userId,
			...category,
		}));
		const result = {
			count: await client.orm.public.TodoCategory.createAndCount(
				data.map((value) => encodeCreate("TodoCategory", value)),
			),
		};
		return result.count;
	}
}
