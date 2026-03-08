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
	ApiBadRequestError,
	ApiDoc,
	ApiForbiddenError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/common/swagger";

import {
	CurrentUser,
	type CurrentUserPayload,
} from "@/modules/auth/decorators";

import {
	ConsentResponseDto,
	PreferenceResponseDto,
	UpdateMarketingConsentDto,
	UpdateMarketingConsentResponseDto,
	UpdatePreferenceDto,
	UpdatePreferenceResponseDto,
} from "./dtos";
import { UserSettingsService } from "./services/user-settings.service";

@ApiTags(SWAGGER_TAGS.USER_AUTH)
@Controller("auth")
export class SettingsController {
	constructor(private readonly userSettingsService: UserSettingsService) {}

	@Get("preference")
	@ApiBearerAuth()
	@ApiDoc({
		summary: "알림 설정 조회",
		operationId: "getPushPreference",
		description: `
## 🔔 푸시 알림 설정 조회
현재 사용자의 푸시 알림 설정을 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 알림 설정 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| \`pushEnabled\` | boolean | 푸시 알림 전체 on/off |
| \`nightPushEnabled\` | boolean | 야간 푸시 동의 (21:00-08:00 사용자 로컬 시간). 단, 일일 완료(DAILY_COMPLETE)와 콕 찌르기(NUDGE_RECEIVED)는 야간에도 항상 발송 |
| \`timezone\` | string | IANA 타임존 (e.g. "Asia/Seoul") |
| \`morningReminderHour\` | number | 아침 리마인더 시간 (0-11, 오전만 허용, 기본 8) |
| \`morningReminderMinute\` | number | 아침 리마인더 분 (0-59, 기본 0) |
| \`eveningReminderHour\` | number | 저녁 리마인더 시간 (12-23, 오후만 허용, 기본 18) |
| \`eveningReminderMinute\` | number | 저녁 리마인더 분 (0-59, 기본 0) |

### 🌏 타임존
- 앱 실행 시 푸시 토큰 등록과 함께 자동 설정됩니다
- 수동 변경도 가능합니다

### ⏰ 리마인더 시간 커스텀
- 사용자의 로컬 타임존 기준으로 동작합니다
- 오전 리마인드: 0:00-11:59 (AM) 범위만 허용
- 오후 리마인드: 12:00-23:59 (PM) 범위만 허용
- 분은 0-59 범위에서 1분 단위로 설정 가능
- 예: timezone="Asia/Seoul", morningReminderHour=7, morningReminderMinute=30 → KST 07:30에 아침 알림

### 💎 프리미엄 전용
- 아침/저녁 리마인더 시간 커스텀은 프리미엄 구독 사용자 전용 기능입니다.
- 무료 유저는 매일 오전 08:00, 오후 18:00 고정 시간에 리마인더를 수신합니다.
- 무료 유저의 응답에는 항상 고정 시간(08:00/18:00)이 반환됩니다.
		`,
	})
	@ApiSuccessResponse({ type: PreferenceResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getPreference(@CurrentUser() user: CurrentUserPayload) {
		return this.userSettingsService.getPreference(user.userId);
	}

	@Patch("preference")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "알림 설정 수정",
		operationId: "updatePushPreference",
		description: `
## 🔔 푸시 알림 설정 수정
푸시 알림 설정을 수정합니다. 최소 1개 필드 필수.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 Body (최소 1개 필수)
| 필드 | 타입 | 설명 |
|------|------|------|
| \`pushEnabled\` | boolean? | 푸시 알림 전체 on/off |
| \`nightPushEnabled\` | boolean? | 야간 푸시 동의 (21:00-08:00 사용자 로컬 시간). 단, 일일 완료(DAILY_COMPLETE)와 콕 찌르기(NUDGE_RECEIVED)는 야간에도 항상 발송 |
| \`timezone\` | string? | IANA 타임존 (e.g. "Asia/Seoul") |
| \`morningReminderHour\` | number? | 아침 리마인더 시간 (0-11, 오전만 허용, 기본 8) |
| \`morningReminderMinute\` | number? | 아침 리마인더 분 (0-59, 기본 0) |
| \`eveningReminderHour\` | number? | 저녁 리마인더 시간 (12-23, 오후만 허용, 기본 18) |
| \`eveningReminderMinute\` | number? | 저녁 리마인더 분 (0-59, 기본 0) |

### 🌏 타임존
- 앱 실행 시 푸시 토큰 등록과 함께 자동 설정됩니다
- 수동 변경도 가능합니다

### ⏰ 리마인더 시간 커스텀
- 사용자의 로컬 타임존 기준으로 동작합니다
- 오전 리마인드: 0:00-11:59 (AM) 범위만 허용
- 오후 리마인드: 12:00-23:59 (PM) 범위만 허용
- 분은 0-59 범위에서 1분 단위로 설정 가능
- 예: timezone="Asia/Seoul", morningReminderHour=7, morningReminderMinute=30 → KST 07:30에 아침 알림

### 💎 프리미엄 전용
- \`morningReminderHour\`, \`morningReminderMinute\`, \`eveningReminderHour\`, \`eveningReminderMinute\` 변경은 프리미엄 구독 사용자만 가능합니다.
- 무료 유저가 변경 시도 시 \`403 PREFERENCE_1701\` 에러가 반환됩니다.
- 무료 유저는 매일 오전 08:00, 오후 18:00 고정 시간에 리마인더를 수신합니다.

### ⏱️ 시간 범위 검증
- \`morningReminderHour\`는 0-11 (오전) 범위만 허용합니다. 범위 밖 값은 \`400 PREFERENCE_1702\` 에러가 반환됩니다.
- \`eveningReminderHour\`는 12-23 (오후) 범위만 허용합니다. 범위 밖 값은 \`400 PREFERENCE_1702\` 에러가 반환됩니다.
- 분(\`*ReminderMinute\`)은 0-59 범위만 허용됩니다.

### ⚠️ 주의
- 야간 푸시를 허용하려면 먼저 \`pushEnabled\`가 true여야 합니다.
- 일일 완료(DAILY_COMPLETE), 콕 찌르기(NUDGE_RECEIVED)는 \`nightPushEnabled=false\`여도 야간에 발송됩니다.
- 푸시는 사용자당 시간당 최대 15건으로 제한됩니다. 초과 시 앱 내 알림은 정상 기록되나 푸시만 스킵됩니다.
		`,
	})
	@ApiSuccessResponse({ type: UpdatePreferenceResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiForbiddenError(ErrorCode.PREFERENCE_1701)
	@ApiBadRequestError(ErrorCode.PREFERENCE_1702)
	async updatePreference(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: UpdatePreferenceDto,
	) {
		return this.userSettingsService.updatePreference(user.userId, dto);
	}

	@Get("consent")
	@ApiBearerAuth()
	@ApiDoc({
		summary: "약관 동의 상태 조회",
		operationId: "getConsent",
		description: `
## 📜 약관 동의 상태 조회
현재 사용자의 약관 동의 상태를 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 응답 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| \`termsAgreedAt\` | string? | 서비스 이용약관 동의 시점 |
| \`privacyAgreedAt\` | string? | 개인정보처리방침 동의 시점 |
| \`agreedTermsVersion\` | string? | 동의한 약관 버전 |
| \`marketingAgreedAt\` | string? | 마케팅 수신 동의 시점 (null = 미동의/철회) |
		`,
	})
	@ApiSuccessResponse({ type: ConsentResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getConsent(@CurrentUser() user: CurrentUserPayload) {
		return this.userSettingsService.getConsent(user.userId);
	}

	@Patch("consent/marketing")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "마케팅 수신 동의 변경",
		operationId: "updateMarketingConsent",
		description: `
## 📢 마케팅 수신 동의 변경
마케팅 수신 동의를 변경합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 Body
| 필드 | 타입 | 설명 |
|------|------|------|
| \`agreed\` | boolean | true=동의, false=철회 |

### 📋 응답
| 필드 | 타입 | 설명 |
|------|------|------|
| \`marketingAgreedAt\` | string? | 동의 시 현재 시점, 철회 시 null |
		`,
	})
	@ApiSuccessResponse({ type: UpdateMarketingConsentResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async updateMarketingConsent(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: UpdateMarketingConsentDto,
	) {
		return this.userSettingsService.updateMarketingConsent(
			user.userId,
			dto.agreed,
		);
	}
}
