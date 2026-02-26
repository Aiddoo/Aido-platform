import { BusinessExceptions } from "@/common/exception/services/business-exception.service";

/**
 * 탈퇴된 사용자인지 확인하고, 탈퇴 상태면 예외를 던집니다.
 *
 * AuthService와 PasswordManagementService가 공유하는 순수 함수입니다.
 */
export function assertNotDeleted(user: {
	deletedAt: Date | null;
	id: string;
}): void {
	if (user.deletedAt) {
		throw BusinessExceptions.accountDeleted(user.id);
	}
}
