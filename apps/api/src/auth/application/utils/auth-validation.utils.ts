import { ErrorCode } from "@aido/errors";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

/**
 * 탈퇴된 사용자인지 확인하고, 탈퇴 상태면 예외를 던집니다.
 *
 * 자격 증명 workflow와 비밀번호 workflow가 공유하는 순수 함수입니다.
 */
export function assertNotDeleted(user: {
	deletedAt: Date | null;
	id: string;
}): void {
	if (user.deletedAt) {
		throw new ApplicationException(ErrorCode.USER_0606, { userId: user.id });
	}
}
