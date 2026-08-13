import { ErrorCode } from "@aido/errors";
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Patch,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
	CurrentUser,
	type CurrentUserPayload,
} from "@/auth/presentation/decorators";
import {
	ApiBadRequestError,
	ApiDoc,
	ApiForbiddenError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/shared/presentation/swagger";

import { GetConsentUseCase } from "../application/use-cases/get-consent/get-consent.use-case";
import { GetPreferenceUseCase } from "../application/use-cases/get-preference/get-preference.use-case";
import { UpdateMarketingConsentUseCase } from "../application/use-cases/update-marketing-consent/update-marketing-consent.use-case";
import { UpdateMarketingPushConsentUseCase } from "../application/use-cases/update-marketing-push-consent/update-marketing-push-consent.use-case";
import { UpdatePreferenceUseCase } from "../application/use-cases/update-preference/update-preference.use-case";
import {
	ConsentResponseDto,
	PreferenceResponseDto,
	UpdateMarketingConsentDto,
	UpdateMarketingConsentResponseDto,
	UpdateMarketingPushConsentDto,
	UpdateMarketingPushConsentResponseDto,
	UpdatePreferenceDto,
	UpdatePreferenceResponseDto,
} from "./dtos";

@ApiTags(SWAGGER_TAGS.USER_AUTH)
@ApiBearerAuth()
@Controller("auth")
export class SettingsController {
	constructor(
		private readonly getPreferenceUseCase: GetPreferenceUseCase,
		private readonly updatePreferenceUseCase: UpdatePreferenceUseCase,
		private readonly getConsentUseCase: GetConsentUseCase,
		private readonly updateMarketingConsentUseCase: UpdateMarketingConsentUseCase,
		private readonly updateMarketingPushConsentUseCase: UpdateMarketingPushConsentUseCase,
	) {}

	@Get("preference")
	@ApiDoc({
		summary: "사용자 설정 조회",
		operationId: "getPushPreference",
		description: `사용자 설정(알림, 표시)을 조회합니다.

**인증 필요**: \`Authorization: Bearer {accessToken}\`

**설정 필드**
| 필드 | 타입 | 설명 |
|------|------|------|
| \`pushEnabled\` | boolean | 푸시 알림 전체 on/off |
| \`nightPushEnabled\` | boolean | 야간 푸시 동의 (21:00-08:00 사용자 로컬 시간). 사용자 지정 날씨 알림은 설정 시각을 우선 적용 |
| \`timezone\` | string | IANA 타임존 (e.g. "Asia/Seoul") |
| \`morningReminderHour\` | number | 아침 리마인더 시간 (0-11, 오전만 허용, 기본 8) |
| \`morningReminderMinute\` | number | 아침 리마인더 분 (0-59, 기본 0) |
| \`eveningReminderHour\` | number | 저녁 리마인더 시간 (12-23, 오후만 허용, 기본 19) |
| \`eveningReminderMinute\` | number | 저녁 리마인더 분 (0-59, 기본 0) |
| \`timeFormat\` | string | 시간 표시 형식 (TWELVE_HOUR: 12시간제, TWENTY_FOUR_HOUR: 24시간제, 기본 TWELVE_HOUR) |

**타임존**: 앱 실행 시 푸시 토큰 등록과 함께 자동 설정되며, 수동 변경도 가능합니다.

**리마인더 시간 커스텀**
- 사용자의 로컬 타임존 기준으로 동작
- 오전: 0:00-11:59, 오후: 12:00-23:59
- 1분 단위 설정 가능

**프리미엄 전용**: 아침/저녁 리마인더 시간 커스텀은 프리미엄 구독 사용자 전용. 무료 유저는 08:00/19:00 고정.`,
	})
	@ApiSuccessResponse({ type: PreferenceResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getPreference(@CurrentUser() user: CurrentUserPayload) {
		return this.getPreferenceUseCase.execute(user.userId);
	}

	@Patch("preference")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "사용자 설정 수정",
		operationId: "updatePushPreference",
		description: `사용자 설정을 수정합니다. 최소 1개 필드 필수.

**요청 Body (최소 1개 필수)**
| 필드 | 타입 | 설명 |
|------|------|------|
| \`pushEnabled\` | boolean? | 푸시 알림 전체 on/off |
| \`nightPushEnabled\` | boolean? | 야간 푸시 동의 (21:00-08:00). 사용자 지정 날씨 알림은 설정 시각을 우선 적용 |
| \`timezone\` | string? | IANA 타임존 (e.g. "Asia/Seoul") |
| \`morningReminderHour\` | number? | 아침 리마인더 시간 (0-11, 기본 8) |
| \`morningReminderMinute\` | number? | 아침 리마인더 분 (0-59, 기본 0) |
| \`eveningReminderHour\` | number? | 저녁 리마인더 시간 (12-23, 기본 19) |
| \`eveningReminderMinute\` | number? | 저녁 리마인더 분 (0-59, 기본 0) |
| \`timeFormat\` | string? | 시간 표시 형식 (TWELVE_HOUR | TWENTY_FOUR_HOUR) |

**프리미엄 전용**: 리마인더 시간 변경은 프리미엄 구독 사용자만 가능. 무료 유저 시도 시 \`403 PREFERENCE_1701\`.

**시간 범위 검증**: 오전(0-11), 오후(12-23) 범위 밖 값은 \`400 PREFERENCE_1702\`.

**타임존 검증**: 유효하지 않은 IANA 타임존은 \`400 SYS_0002\`. 유효한 별칭은 정규 IANA 타임존으로 저장.

**주의**: 야간 푸시 허용 시 \`pushEnabled\`가 true여야 함. 사용자당 시간당 최대 15건.`,
	})
	@ApiSuccessResponse({ type: UpdatePreferenceResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiForbiddenError(ErrorCode.PREFERENCE_1701)
	@ApiBadRequestError(ErrorCode.PREFERENCE_1702)
	async updatePreference(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: UpdatePreferenceDto,
	) {
		return this.updatePreferenceUseCase.execute(user.userId, dto);
	}

	@Get("consent")
	@ApiDoc({
		summary: "약관 동의 상태 조회",
		operationId: "getConsent",
		description: `현재 사용자의 약관 동의 상태를 조회합니다.

**응답 필드**
| 필드 | 타입 | 설명 |
|------|------|------|
| \`termsAgreedAt\` | string? | 서비스 이용약관 동의 시점 |
| \`privacyAgreedAt\` | string? | 개인정보처리방침 동의 시점 |
| \`agreedTermsVersion\` | string? | 동의한 약관 버전 |
| \`marketingAgreedAt\` | string? | 마케팅 수신 동의 시점 (null = 미동의/철회) |`,
	})
	@ApiSuccessResponse({ type: ConsentResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getConsent(@CurrentUser() user: CurrentUserPayload) {
		return this.getConsentUseCase.execute(user.userId);
	}

	@Patch("consent/marketing")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "마케팅 수신 동의 변경",
		operationId: "updateMarketingConsent",
		description: `마케팅 수신 동의를 변경합니다.

**요청 Body**
| 필드 | 타입 | 설명 |
|------|------|------|
| \`agreed\` | boolean | true=동의, false=철회 |

**응답**
| 필드 | 타입 | 설명 |
|------|------|------|
| \`marketingAgreedAt\` | string? | 동의 시 현재 시점, 철회 시 null |`,
	})
	@ApiSuccessResponse({ type: UpdateMarketingConsentResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async updateMarketingConsent(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: UpdateMarketingConsentDto,
	) {
		return this.updateMarketingConsentUseCase.execute(user.userId, dto.agreed);
	}

	@Patch("consent/marketing-push")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "광고성 앱 푸시 수신 동의 변경",
		operationId: "updateMarketingPushConsent",
		description:
			"광고성 앱 푸시 수신 동의를 변경합니다. 야간 광고성 푸시는 별도로 발송하지 않습니다.",
	})
	@ApiSuccessResponse({ type: UpdateMarketingPushConsentResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async updateMarketingPushConsent(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: UpdateMarketingPushConsentDto,
	) {
		return this.updateMarketingPushConsentUseCase.execute(
			user.userId,
			dto.agreed,
		);
	}
}
