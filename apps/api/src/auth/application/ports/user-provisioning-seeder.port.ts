/** 회원가입 시딩할 초기 약관 동의 값. */
export interface ProvisioningConsent {
	termsAgreedAt?: Date;
	privacyAgreedAt?: Date;
	marketingAgreedAt?: Date;
	marketingPushAgreedAt?: Date;
}

/**
 * 신규 사용자 프로비저닝 시 타 모듈(user-settings·todo-category) 기본값 시딩 포트 (auth 소유 ACL).
 *
 * concrete 저장소를 배럴로 주입하지 않고, 이 포트를 통해 시딩 의도만 노출한다.
 * 어댑터가 설정과 기본 카테고리 생성을 위임하며, 호출측이 연 CLS 트랜잭션에 참여한다.
 */
export interface UserProvisioningSeederPort {
	seedDefaultSettings(userId: string, consent: ProvisioningConsent): Promise<void>;
	seedDefaultCategories(userId: string): Promise<void>;
}

export const USER_PROVISIONING_SEEDER = Symbol("USER_PROVISIONING_SEEDER");
