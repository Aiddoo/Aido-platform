import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";

/**
 * 이메일 모듈
 *
 * Resend를 통한 트랜잭셔널 이메일 발송을 담당합니다.
 * - 이메일 인증 코드
 * - 비밀번호 재설정 코드
 */
@Module({
	providers: [EmailService],
	exports: [EmailService],
})
export class EmailModule {}
