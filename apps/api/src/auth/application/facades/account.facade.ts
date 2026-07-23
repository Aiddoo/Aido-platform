import { Injectable } from "@nestjs/common";
import { GetCurrentUserQuery, ListLinkedAccountsQuery } from "../queries";
import {
	DeleteAccountUseCase,
	UnlinkOAuthAccountUseCase,
	UpdateProfileUseCase,
} from "../use-cases";

/** 계정·프로필·연결 계정 흐름의 단일 presentation 진입점. */
@Injectable()
export class AccountFacade {
	constructor(
		private readonly getCurrentUserQuery: GetCurrentUserQuery,
		private readonly updateProfileUseCase: UpdateProfileUseCase,
		private readonly listLinkedAccountsQuery: ListLinkedAccountsQuery,
		private readonly unlinkOAuthAccountUseCase: UnlinkOAuthAccountUseCase,
		private readonly deleteAccountUseCase: DeleteAccountUseCase,
	) {}

	getCurrentUser(
		...args: Parameters<GetCurrentUserQuery["execute"]>
	): ReturnType<GetCurrentUserQuery["execute"]> {
		return this.getCurrentUserQuery.execute(...args);
	}

	updateProfile(
		...args: Parameters<UpdateProfileUseCase["execute"]>
	): ReturnType<UpdateProfileUseCase["execute"]> {
		return this.updateProfileUseCase.execute(...args);
	}

	getLinkedAccounts(
		...args: Parameters<ListLinkedAccountsQuery["execute"]>
	): ReturnType<ListLinkedAccountsQuery["execute"]> {
		return this.listLinkedAccountsQuery.execute(...args);
	}

	unlinkAccount(
		...args: Parameters<UnlinkOAuthAccountUseCase["execute"]>
	): ReturnType<UnlinkOAuthAccountUseCase["execute"]> {
		return this.unlinkOAuthAccountUseCase.execute(...args);
	}

	deleteAccount(
		...args: Parameters<DeleteAccountUseCase["execute"]>
	): ReturnType<DeleteAccountUseCase["execute"]> {
		return this.deleteAccountUseCase.execute(...args);
	}
}
