import type {
	ConsentResponse,
	PreferenceResponse,
	UpdateMarketingConsentResponse,
	UpdateMarketingPushConsentResponse,
	UpdatePreferenceInput,
	UpdatePreferenceResponse,
} from "@aido/validators";
import { Injectable } from "@nestjs/common";

import type { UserConsentRecord } from "../../domain/records/user-consent.record";
import type { UserPreferenceRecord } from "../../domain/records/user-preference.record";
import type { UserConsentRecordWithId } from "../ports/user-consent.repository.port";
import type { UserPreferenceRecordWithId } from "../ports/user-preference.repository.port";
import { GetConsentUseCase } from "../use-cases/get-consent/get-consent.use-case";
import { GetConsentRecordUseCase } from "../use-cases/get-consent-record/get-consent-record.use-case";
import { GetConsentRecordsUseCase } from "../use-cases/get-consent-records/get-consent-records.use-case";
import { GetPreferenceUseCase } from "../use-cases/get-preference/get-preference.use-case";
import { GetPreferenceRecordUseCase } from "../use-cases/get-preference-record/get-preference-record.use-case";
import { GetPreferenceRecordsUseCase } from "../use-cases/get-preference-records/get-preference-records.use-case";
import { OnTodoToggledUseCase } from "../use-cases/on-todo-toggled/on-todo-toggled.use-case";
import { SeedUserSettingsUseCase } from "../use-cases/seed-user-settings/seed-user-settings.use-case";
import { UpdateMarketingConsentUseCase } from "../use-cases/update-marketing-consent/update-marketing-consent.use-case";
import { UpdateMarketingPushConsentUseCase } from "../use-cases/update-marketing-push-consent/update-marketing-push-consent.use-case";
import { UpdatePreferenceUseCase } from "../use-cases/update-preference/update-preference.use-case";
import { UpsertPushLocaleUseCase } from "../use-cases/upsert-push-locale/upsert-push-locale.use-case";
import { UpsertPushTimezoneUseCase } from "../use-cases/upsert-push-timezone/upsert-push-timezone.use-case";

/** 회원가입 시 시딩할 초기 약관 동의 값 (auth 프로비저닝 경로). */
export interface DefaultSettingsConsent {
	termsAgreedAt?: Date;
	privacyAgreedAt?: Date;
	agreedTermsVersion?: string;
	marketingAgreedAt?: Date | null;
	marketingPushAgreedAt?: Date | null;
}

/**
 * 사용자 설정 파사드.
 *
 * 컨트롤러 및 크로스모듈(todo 스트릭 어댑터·auth 프로비저닝·notification 푸시 전달)의
 * 유일한 주입 대상. use-case에만 위임하며 concrete 저장소에 직접 의존하지 않는다
 * (회원가입 시딩·푸시 발송 판단 접근도 use-case + 포트 경유).
 */
@Injectable()
export class UserSettingsFacade {
	constructor(
		private readonly getPreferenceUseCase: GetPreferenceUseCase,
		private readonly updatePreferenceUseCase: UpdatePreferenceUseCase,
		private readonly getConsentUseCase: GetConsentUseCase,
		private readonly updateMarketingConsentUseCase: UpdateMarketingConsentUseCase,
		private readonly updateMarketingPushConsentUseCase: UpdateMarketingPushConsentUseCase,
		private readonly onTodoToggledUseCase: OnTodoToggledUseCase,
		private readonly seedUserSettingsUseCase: SeedUserSettingsUseCase,
		private readonly upsertPushTimezoneUseCase: UpsertPushTimezoneUseCase,
		private readonly upsertPushLocaleUseCase: UpsertPushLocaleUseCase,
		private readonly getPreferenceRecordUseCase: GetPreferenceRecordUseCase,
		private readonly getPreferenceRecordsUseCase: GetPreferenceRecordsUseCase,
		private readonly getConsentRecordUseCase: GetConsentRecordUseCase,
		private readonly getConsentRecordsUseCase: GetConsentRecordsUseCase,
	) {}

	getPreference(userId: string): Promise<PreferenceResponse> {
		return this.getPreferenceUseCase.execute(userId);
	}

	updateMarketingPushConsent(
		userId: string,
		agreed: boolean,
	): Promise<UpdateMarketingPushConsentResponse> {
		return this.updateMarketingPushConsentUseCase.execute(userId, agreed);
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
	seedDefaults(userId: string, consent: DefaultSettingsConsent): Promise<void> {
		return this.seedUserSettingsUseCase.execute(userId, consent);
	}

	/** 푸시 토큰 등록 시 타임존 upsert (notification). */
	upsertPushTimezone(userId: string, timezone: string): Promise<void> {
		return this.upsertPushTimezoneUseCase.execute(userId, timezone);
	}

	/** 푸시 토큰 등록 시 로케일 upsert (notification). */
	upsertPushLocale(userId: string, locale: string): Promise<void> {
		return this.upsertPushLocaleUseCase.execute(userId, locale);
	}

	/** 푸시 발송 판단용 단건 설정 조회 (notification). */
	getPreferenceRecord(userId: string): Promise<UserPreferenceRecord | null> {
		return this.getPreferenceRecordUseCase.execute(userId);
	}

	/** 푸시 발송 판단용 배치 설정 조회 (notification). */
	getPreferenceRecordsByUserIds(
		userIds: string[],
	): Promise<UserPreferenceRecordWithId[]> {
		return this.getPreferenceRecordsUseCase.execute(userIds);
	}

	/** 푸시 발송 판단용 단건 동의 조회 (notification). */
	getConsentRecord(userId: string): Promise<UserConsentRecord | null> {
		return this.getConsentRecordUseCase.execute(userId);
	}

	/** 푸시 발송 판단용 배치 동의 조회 (notification). */
	getConsentRecordsByUserIds(
		userIds: string[],
	): Promise<UserConsentRecordWithId[]> {
		return this.getConsentRecordsUseCase.execute(userIds);
	}
}
