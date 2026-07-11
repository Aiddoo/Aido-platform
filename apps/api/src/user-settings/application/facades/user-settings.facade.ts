import type {
	ConsentResponse,
	PreferenceResponse,
	UpdateMarketingConsentResponse,
	UpdatePreferenceInput,
	UpdatePreferenceResponse,
} from "@aido/validators";
import { Injectable } from "@nestjs/common";

import { GetConsentUseCase } from "../use-cases/get-consent/get-consent.use-case";
import { GetPreferenceUseCase } from "../use-cases/get-preference/get-preference.use-case";
import { OnTodoToggledUseCase } from "../use-cases/on-todo-toggled/on-todo-toggled.use-case";
import { UpdateMarketingConsentUseCase } from "../use-cases/update-marketing-consent/update-marketing-consent.use-case";
import { UpdatePreferenceUseCase } from "../use-cases/update-preference/update-preference.use-case";

/**
 * 사용자 설정 파사드.
 *
 * 컨트롤러 및 크로스모듈(todo 스트릭 어댑터)의 유일한 주입 대상.
 */
@Injectable()
export class UserSettingsFacade {
	constructor(
		private readonly getPreferenceUseCase: GetPreferenceUseCase,
		private readonly updatePreferenceUseCase: UpdatePreferenceUseCase,
		private readonly getConsentUseCase: GetConsentUseCase,
		private readonly updateMarketingConsentUseCase: UpdateMarketingConsentUseCase,
		private readonly onTodoToggledUseCase: OnTodoToggledUseCase,
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
}
