import type { CreateInput } from "@prisma/orm-postgres/orm-client";

import { createEntityId } from "#api/shared/infrastructure/database/database-values";
import type { Prisma8Transaction } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

import type { Contract } from "../../src/generated/prisma8/contract.d.js";
import { withDatabaseTransaction } from "./database-context.js";
import type { TestDatabaseClient } from "./test-database.js";

type RelatedInput<M extends "UserProfile" | "UserPreference" | "UserConsent" | "UserLocation"> =
	Omit<CreateInput<Contract, M, "public">, "userId" | "id"> & { id?: string };
interface RelatedFixtures {
	profile?: RelatedInput<"UserProfile">;
	preference?: RelatedInput<"UserPreference">;
	consent?: RelatedInput<"UserConsent">;
	location?: RelatedInput<"UserLocation">;
	pushTokens?: Omit<CreateInput<Contract, "PushToken", "public">, "userId">;
	accounts?: Omit<CreateInput<Contract, "Account", "public">, "userId">[];
}

/** Native scalar creates share one transaction, matching production user provisioning. */
export async function createUserDatabaseFixture(
	client: TestDatabaseClient | Prisma8Transaction,
	userInput: CreateInput<Contract, "User", "public">,
	related: RelatedFixtures,
) {
	const create = async (tx: Prisma8Transaction) => {
		const user = await tx.orm.public.User.create(userInput);
		if (related.profile !== undefined) {
			await tx.orm.public.UserProfile.create({
				...related.profile,
				id: related.profile.id ?? createEntityId(),
				userId: user.id,
			});
		}
		if (related.preference !== undefined) {
			await tx.orm.public.UserPreference.create({
				...related.preference,
				id: related.preference.id ?? createEntityId(),
				userId: user.id,
			});
		}
		if (related.consent !== undefined) {
			await tx.orm.public.UserConsent.create({
				...related.consent,
				id: related.consent.id ?? createEntityId(),
				userId: user.id,
			});
		}
		if (related.location !== undefined) {
			await tx.orm.public.UserLocation.create({
				...related.location,
				id: related.location.id ?? createEntityId(),
				userId: user.id,
			});
		}
		if (related.accounts !== undefined) {
			await tx.orm.public.Account.createAndCount(
				related.accounts.map((account) => ({ ...account, userId: user.id })),
			);
		}
		if (related.pushTokens !== undefined) {
			await tx.orm.public.PushToken.create({ ...related.pushTokens, userId: user.id });
		}
		return user;
	};
	return "runtime" in client ? withDatabaseTransaction(client, create) : create(client);
}
