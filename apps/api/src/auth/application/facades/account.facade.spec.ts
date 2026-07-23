import { mock } from "jest-mock-extended";
import { GetCurrentUserQuery, ListLinkedAccountsQuery } from "../queries";
import {
	DeleteAccountUseCase,
	UnlinkOAuthAccountUseCase,
	UpdateProfileUseCase,
} from "../use-cases";
import { AccountFacade } from "./account.facade";

describe("AccountFacade — 계정 진입점", () => {
	it("계정 command/query를 해당 endpoint 실행 단위에 위임한다", async () => {
		const getCurrentUser = mock<GetCurrentUserQuery>();
		const updateProfile = mock<UpdateProfileUseCase>();
		const listLinkedAccounts = mock<ListLinkedAccountsQuery>();
		const unlinkAccount = mock<UnlinkOAuthAccountUseCase>();
		const deleteAccount = mock<DeleteAccountUseCase>();
		const facade = new AccountFacade(
			getCurrentUser,
			updateProfile,
			listLinkedAccounts,
			unlinkAccount,
			deleteAccount,
		);

		await facade.getCurrentUser("user-1", "user@example.com", "session-1");
		await facade.updateProfile("user-1", { name: "새 이름" });
		await facade.getLinkedAccounts("user-1");
		await facade.unlinkAccount("user-1", "GOOGLE");
		await facade.deleteAccount("user-1", "session-1", {
			password: "Password123",
		});

		expect(getCurrentUser.execute).toHaveBeenCalledWith(
			"user-1",
			"user@example.com",
			"session-1",
		);
		expect(updateProfile.execute).toHaveBeenCalledWith("user-1", {
			name: "새 이름",
		});
		expect(listLinkedAccounts.execute).toHaveBeenCalledWith("user-1");
		expect(unlinkAccount.execute).toHaveBeenCalledWith("user-1", "GOOGLE");
		expect(deleteAccount.execute).toHaveBeenCalledWith("user-1", "session-1", {
			password: "Password123",
		});
	});
});
