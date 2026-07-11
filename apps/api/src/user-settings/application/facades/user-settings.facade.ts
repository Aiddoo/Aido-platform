import type {
	ConsentResponse,
	PreferenceResponse,
	UpdateMarketingConsentResponse,
	UpdatePreferenceInput,
	UpdatePreferenceResponse,
} from "@aido/validators";
import { Injectable } from "@nestjs/common";

import type { UserConsentRecord } from "../../domain/records/user-consent.record";
import type { UserPreferenceRecord } from "../../domain/records/user-preference.record";
import { UserConsentRepository } from "../../infrastructure/persistence/user-consent.repository";
import { UserPreferenceRepository } from "../../infrastructure/persistence/user-preference.repository";
import { GetConsentUseCase } from "../use-cases/get-consent/get-consent.use-case";
import { GetPreferenceUseCase } from "../use-cases/get-preference/get-preference.use-case";
import { OnTodoToggledUseCase } from "../use-cases/on-todo-toggled/on-todo-toggled.use-case";
import { UpdateMarketingConsentUseCase } from "../use-cases/update-marketing-consent/update-marketing-consent.use-case";
import { UpdatePreferenceUseCase } from "../use-cases/update-preference/update-preference.use-case";

/** 회원가입 시 시딩할 초기 약관 동의 값 (auth 프로비저닝 경로). */
export interface DefaultSettingsConsent {
	termsAgreedAt?: Date;
	privacyAgreedAt?: Date;
	agreedTermsVersion?: string;
	marketingAgreedAt?: Date | null;
}

/** 배치 조회용 설정 레코드 (사용자 식별자 포함). */
export type UserPreferenceRecordWithId = UserPreferenceRecord & {
	userId: string;
};

/** 배치 조회용 동의 레코드 (사용자 식별자 포함). */
export type UserConsentRecordWithId = UserConsentRecord & { userId: string };

/**
 * 사용자 설정 파사드.
 *
 * 컨트롤러 및 크로스모듈(todo 스트릭 어댑터·auth 프로비저닝·notification 푸시 전달)의
 * 유일한 주입 대상. 회원가입 시딩·푸시 발송 판단에 필요한 설정 접근을 캡슐화하여
 * concrete 저장소가 배럴로 새어나가지 않게 한다.
 */
@Injectable()
export class UserSettingsFacade {
	constructor(
		private readonly getPreferenceUseCase: GetPreferenceUseCase,
		private readonly updatePreferenceUseCase: UpdatePreferenceUseCase,
		private readonly getConsentUseCase: GetConsentUseCase,
		private readonly updateMarketingConsentUseCase: UpdateMarketingConsentUseCase,
		private readonly onTodoToggledUseCase: OnTodoToggledUseCase,
		private readonly userConsentRepository: UserConsentRepository,
		private readonly userPreferenceRepository: UserPreferenceRepository,
	) {}

	getPreference(userId: string): Promise<PreferenceResponse> {
		return this.getPreferenceUseCase.execute(userId);
	}

	updatePreference(
		userId: string,
		input: UpdatePreferenceInput,
	): Promise<UpdatePreferenceResponse> {
		return this.updatePreferenceUseCase.execute(userId, input);
	}

	getConsent(userId: string): Promise<ConsentResponse> {
		return this.getConsentUseCase.execute(userId);
	}

	updateMarketingConsent(
		userId: string,
		agreed: boolean,
	): Promise<UpdateMarketingConsentResponse> {
		return this.updateMarketingConsentUseCase.execute(userId, agreed);
	}

	/**
	 * 투두 완료 토글 시 스트릭 갱신 (fire-and-forget; 내부에서 실패를 삼킨다).
	 */
	onTodoToggled(
		userId: string,
		completed: boolean,
		tz?: string,
	): Promise<void> {
		return this.onTodoToggledUseCase.execute(userId, completed, tz);
	}

	/**
	 * 회원가입 시 기본 설정 시딩 — 약관 동의 + 푸시 설정 기본값.
	 * 호출측(auth 프로비저닝)이 연 CLS 트랜잭션에 참여한다.
	 */
	async seedDefaults(
		userId: string,
		consent: DefaultSettingsConsent,
	): Promise<void> {
		await this.userConsentRepository.create(userId, consent);
		await this.userPreferenceRepository.create(userId, {
			pushEnabled: true,
			nightPushEnabled: true,
		});
	}

	/** 푸시 토큰 등록 시 타임존 upsert (notification). */
	upsertPushTimezone(userId: string, timezone: string): Promise<void> {
		return this.userPreferenceRepository.upsertTimezone(userId, timezone);
	}

	/** 푸시 토큰 등록 시 로케일 upsert (notification). */
	upsertPushLocale(userId: string, locale: string): Promise<void> {
		return this.userPreferenceRepository.upsertLocale(userId, locale);
	}

	/** 푸시 발송 판단용 단건 설정 조회 (notification). */
	getPreferenceRecord(userId: string): Promise<UserPreferenceRecord | null> {
		return this.userPreferenceRepository.findByUserId(userId);
	}

	/** 푸시 발송 판단용 배치 설정 조회 (notification). */
	getPreferenceRecordsByUserIds(
		userIds: string[],
	): Promise<UserPreferenceRecordWithId[]> {
		return this.userPreferenceRepository.findByUserIds(userIds);
	}

	/** 푸시 발송 판단용 단건 동의 조회 (notification). */
	getConsentRecord(userId: string): Promise<UserConsentRecord | null> {
		return this.userConsentRepository.findByUserId(userId);
	}

	/** 푸시 발송 판단용 배치 동의 조회 (notification). */
	getConsentRecordsByUserIds(
		userIds: string[],
	): Promise<UserConsentRecordWithId[]> {
		return this.userConsentRepository.findByUserIds(userIds);
	}
}
