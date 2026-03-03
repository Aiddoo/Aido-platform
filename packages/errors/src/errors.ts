import { HttpStatus } from './http-status';
import type { ErrorDefinition } from './types';

/**
 * Numeric 에러 코드
 *
 * 도메인별 코드 범위:
 * - SYS     (0001-0099): 시스템/공통
 * - AUTH    (0100-0199): 인증/JWT
 * - SOCIAL  (0200-0299): 소셜 로그인 공통
 * - KAKAO   (0300-0349): 카카오
 * - APPLE   (0350-0399): 애플
 * - GOOGLE  (0400-0449): 구글
 * - NAVER   (0450-0499): 네이버
 * - EMAIL   (0500-0549): 이메일 인증
 * - USER    (0600-0699): 사용자/계정
 * - SESSION (0700-0749): 세션
 * - TODO    (0800-0849): Todo
 * - TODO_CATEGORY (0850-0899): Todo 카테고리
 * - FOLLOW  (0900-0999): 친구/팔로우
 * - NOTIFICATION (1000-1099): 알림/푸시
 * - NUDGE   (1100-1199): 콕 찌르기
 * - CHEER   (1200-1299): 응원
 * - AI      (1300-1399): AI 서비스
 * - ADMIN   (1400-1499): 관리자
 * - INQUIRY (1500-1599): 문의
 * - SUBSCRIPTION (1600-1699): 구독
 */
export const ErrorCode = {
  // =========================================================================
  // 시스템/공통 (SYS_0001-0099)
  // =========================================================================
  SYS_0001: 'SYS_0001',
  SYS_0002: 'SYS_0002',
  SYS_0003: 'SYS_0003',
  SYS_0004: 'SYS_0004',

  // =========================================================================
  // 인증/JWT (AUTH_0100-0199)
  // =========================================================================
  AUTH_0101: 'AUTH_0101',
  AUTH_0102: 'AUTH_0102',
  AUTH_0103: 'AUTH_0103',
  AUTH_0104: 'AUTH_0104',
  AUTH_0105: 'AUTH_0105',
  AUTH_0106: 'AUTH_0106',
  AUTH_0107: 'AUTH_0107',
  AUTH_0108: 'AUTH_0108',

  // =========================================================================
  // 소셜 로그인 공통 (SOCIAL_0200-0299)
  // =========================================================================
  SOCIAL_0201: 'SOCIAL_0201',
  SOCIAL_0202: 'SOCIAL_0202',
  SOCIAL_0203: 'SOCIAL_0203',
  SOCIAL_0204: 'SOCIAL_0204',
  SOCIAL_0205: 'SOCIAL_0205',
  SOCIAL_0206: 'SOCIAL_0206',

  // =========================================================================
  // 카카오 (KAKAO_0300-0349)
  // =========================================================================
  KAKAO_0301: 'KAKAO_0301',
  KAKAO_0302: 'KAKAO_0302',
  KAKAO_0303: 'KAKAO_0303',
  KAKAO_0304: 'KAKAO_0304',
  KAKAO_0305: 'KAKAO_0305',
  KAKAO_0306: 'KAKAO_0306',
  KAKAO_0307: 'KAKAO_0307',
  KAKAO_0308: 'KAKAO_0308',

  // =========================================================================
  // 애플 (APPLE_0350-0399)
  // =========================================================================
  APPLE_0351: 'APPLE_0351',
  APPLE_0352: 'APPLE_0352',
  APPLE_0353: 'APPLE_0353',
  APPLE_0354: 'APPLE_0354',
  APPLE_0355: 'APPLE_0355',
  APPLE_0356: 'APPLE_0356',
  APPLE_0357: 'APPLE_0357',

  // =========================================================================
  // 구글 (GOOGLE_0400-0449)
  // =========================================================================
  GOOGLE_0401: 'GOOGLE_0401',
  GOOGLE_0402: 'GOOGLE_0402',
  GOOGLE_0403: 'GOOGLE_0403',
  GOOGLE_0404: 'GOOGLE_0404',
  GOOGLE_0405: 'GOOGLE_0405',
  GOOGLE_0406: 'GOOGLE_0406',

  // =========================================================================
  // 네이버 (NAVER_0450-0499)
  // =========================================================================
  NAVER_0451: 'NAVER_0451',
  NAVER_0452: 'NAVER_0452',
  NAVER_0453: 'NAVER_0453',
  NAVER_0454: 'NAVER_0454',
  NAVER_0455: 'NAVER_0455',
  NAVER_0456: 'NAVER_0456',

  // =========================================================================
  // 이메일 인증 (EMAIL_0500-0549)
  // =========================================================================
  EMAIL_0501: 'EMAIL_0501',
  EMAIL_0502: 'EMAIL_0502',
  EMAIL_0503: 'EMAIL_0503',
  EMAIL_0504: 'EMAIL_0504',
  EMAIL_0505: 'EMAIL_0505',
  EMAIL_0506: 'EMAIL_0506',
  EMAIL_0507: 'EMAIL_0507',
  EMAIL_0508: 'EMAIL_0508',

  // =========================================================================
  // 사용자/계정 (USER_0600-0699)
  // =========================================================================
  USER_0601: 'USER_0601',
  USER_0602: 'USER_0602',
  USER_0603: 'USER_0603',
  USER_0604: 'USER_0604',
  USER_0605: 'USER_0605',
  USER_0606: 'USER_0606',
  USER_0607: 'USER_0607',
  USER_0608: 'USER_0608',
  USER_0609: 'USER_0609',
  USER_0610: 'USER_0610',
  USER_0611: 'USER_0611',
  USER_0612: 'USER_0612',
  USER_0613: 'USER_0613',
  USER_0614: 'USER_0614',
  USER_0615: 'USER_0615',

  // =========================================================================
  // 세션 (SESSION_0700-0749)
  // =========================================================================
  SESSION_0701: 'SESSION_0701',
  SESSION_0702: 'SESSION_0702',
  SESSION_0703: 'SESSION_0703',
  SESSION_0704: 'SESSION_0704',

  // =========================================================================
  // 인증 코드 (VERIFY_0750-0799)
  // =========================================================================
  VERIFY_0751: 'VERIFY_0751',
  VERIFY_0752: 'VERIFY_0752',
  VERIFY_0753: 'VERIFY_0753',
  VERIFY_0754: 'VERIFY_0754',

  // =========================================================================
  // Todo (TODO_0800-0849)
  // =========================================================================
  TODO_0801: 'TODO_0801',
  TODO_0810: 'TODO_0810',
  TODO_0811: 'TODO_0811',
  TODO_0812: 'TODO_0812',
  TODO_0813: 'TODO_0813',

  // =========================================================================
  // Todo 카테고리 (TODO_CATEGORY_0850-0899)
  // =========================================================================
  TODO_CATEGORY_0851: 'TODO_CATEGORY_0851',
  TODO_CATEGORY_0852: 'TODO_CATEGORY_0852',
  TODO_CATEGORY_0853: 'TODO_CATEGORY_0853',
  TODO_CATEGORY_0854: 'TODO_CATEGORY_0854',
  TODO_CATEGORY_0855: 'TODO_CATEGORY_0855',
  TODO_CATEGORY_0856: 'TODO_CATEGORY_0856',
  TODO_CATEGORY_0857: 'TODO_CATEGORY_0857',

  // =========================================================================
  // 친구/팔로우 (FOLLOW_0900-0999)
  // =========================================================================
  FOLLOW_0901: 'FOLLOW_0901',
  FOLLOW_0902: 'FOLLOW_0902',
  FOLLOW_0903: 'FOLLOW_0903',
  FOLLOW_0904: 'FOLLOW_0904',
  FOLLOW_0905: 'FOLLOW_0905',
  FOLLOW_0906: 'FOLLOW_0906',
  FOLLOW_0907: 'FOLLOW_0907',
  FOLLOW_0908: 'FOLLOW_0908',
  FOLLOW_0909: 'FOLLOW_0909',

  // =========================================================================
  // 알림/푸시 (NOTIFICATION_1000-1099)
  // =========================================================================
  NOTIFICATION_1001: 'NOTIFICATION_1001',
  NOTIFICATION_1002: 'NOTIFICATION_1002',
  NOTIFICATION_1003: 'NOTIFICATION_1003',
  NOTIFICATION_1004: 'NOTIFICATION_1004',
  NOTIFICATION_1005: 'NOTIFICATION_1005',

  // =========================================================================
  // 콕 찌르기 (NUDGE_1100-1199)
  // =========================================================================
  NUDGE_1101: 'NUDGE_1101',
  NUDGE_1102: 'NUDGE_1102',
  NUDGE_1103: 'NUDGE_1103',
  NUDGE_1104: 'NUDGE_1104',
  NUDGE_1105: 'NUDGE_1105',
  NUDGE_1106: 'NUDGE_1106',

  // =========================================================================
  // 응원 (CHEER_1200-1299)
  // =========================================================================
  CHEER_1201: 'CHEER_1201',
  CHEER_1202: 'CHEER_1202',
  CHEER_1203: 'CHEER_1203',
  CHEER_1204: 'CHEER_1204',
  CHEER_1205: 'CHEER_1205',

  // =========================================================================
  // AI 서비스 (AI_1300-1399)
  // =========================================================================
  AI_1301: 'AI_1301',
  AI_1302: 'AI_1302',
  AI_1303: 'AI_1303',
  AI_1304: 'AI_1304',
  AI_1305: 'AI_1305',
  AI_1306: 'AI_1306',
  AI_1307: 'AI_1307',
  AI_1308: 'AI_1308',
  AI_1309: 'AI_1309',

  // =========================================================================
  // 관리자 (ADMIN_1400-1499)
  // =========================================================================
  /** 관리자 권한이 필요합니다 */
  ADMIN_1401: 'ADMIN_1401',
  /** 알림 대상 사용자가 없습니다 */
  ADMIN_1402: 'ADMIN_1402',
  /** 유효하지 않은 필터 조건입니다 */
  ADMIN_1403: 'ADMIN_1403',
  // =========================================================================
  // 문의 (INQUIRY_1500-1599)
  // =========================================================================
  /** 문의 이메일 발송에 실패했습니다 */
  INQUIRY_1501: 'INQUIRY_1501',

  // =========================================================================
  // 구독 (SUBSCRIPTION_1600-1699)
  // =========================================================================
  SUBSCRIPTION_1601: 'SUBSCRIPTION_1601',
  SUBSCRIPTION_1602: 'SUBSCRIPTION_1602',
  SUBSCRIPTION_1603: 'SUBSCRIPTION_1603',
  SUBSCRIPTION_1604: 'SUBSCRIPTION_1604',
  SUBSCRIPTION_1605: 'SUBSCRIPTION_1605',

  // =========================================================================
  // 설정 (PREFERENCE_1700-1799)
  // =========================================================================
  PREFERENCE_1701: 'PREFERENCE_1701',
  PREFERENCE_1702: 'PREFERENCE_1702',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * 에러 정의 맵
 */
export const Errors: Record<ErrorCodeType, ErrorDefinition> = {
  // =========================================================================
  // 시스템/공통 (SYS_0001-0099)
  // =========================================================================
  [ErrorCode.SYS_0001]: {
    code: 'SYS_0001',
    message: '서버 내부 오류가 발생했습니다.',
    description: '예상치 못한 서버 오류입니다. 관리자에게 문의하세요.',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  [ErrorCode.SYS_0002]: {
    code: 'SYS_0002',
    message: '잘못된 파라미터입니다.',
    description: '요청 파라미터가 유효하지 않습니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  [ErrorCode.SYS_0003]: {
    code: 'SYS_0003',
    message: '데이터가 다른 사용자에 의해 수정되었습니다. 다시 시도해주세요.',
    description: '낙관적 잠금 충돌이 발생했습니다.',
    httpStatus: HttpStatus.CONFLICT,
  },
  [ErrorCode.SYS_0004]: {
    code: 'SYS_0004',
    message: '동시 수정으로 인한 충돌이 발생했습니다. 다시 시도해주세요.',
    description: '동시성 충돌이 발생했습니다.',
    httpStatus: HttpStatus.CONFLICT,
  },

  // =========================================================================
  // 인증/JWT (AUTH_0100-0199)
  // =========================================================================
  [ErrorCode.AUTH_0101]: {
    code: 'AUTH_0101',
    message: '유효하지 않은 토큰입니다.',
    description: 'JWT 토큰이 유효하지 않습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.AUTH_0102]: {
    code: 'AUTH_0102',
    message: '토큰이 만료되었습니다.',
    description: 'JWT 액세스 토큰이 만료되었습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.AUTH_0103]: {
    code: 'AUTH_0103',
    message: '잘못된 형식의 토큰입니다.',
    description: 'JWT 토큰 형식이 올바르지 않습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.AUTH_0104]: {
    code: 'AUTH_0104',
    message: '유효하지 않은 리프레시 토큰입니다.',
    description: '리프레시 토큰 검증에 실패했습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.AUTH_0105]: {
    code: 'AUTH_0105',
    message: '리프레시 토큰이 만료되었습니다. 다시 로그인해주세요.',
    description: '리프레시 토큰이 만료되어 재로그인이 필요합니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.AUTH_0106]: {
    code: 'AUTH_0106',
    message: '폐기된 토큰입니다. 다시 로그인해주세요.',
    description: '해당 토큰은 이미 폐기되었습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.AUTH_0107]: {
    code: 'AUTH_0107',
    message: '인증이 필요합니다.',
    description: '해당 리소스에 접근하려면 인증이 필요합니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.AUTH_0108]: {
    code: 'AUTH_0108',
    message: '접근 권한이 없습니다.',
    description: '해당 리소스에 대한 접근 권한이 없습니다.',
    httpStatus: HttpStatus.FORBIDDEN,
  },

  // =========================================================================
  // 소셜 로그인 공통 (SOCIAL_0200-0299)
  // =========================================================================
  [ErrorCode.SOCIAL_0201]: {
    code: 'SOCIAL_0201',
    message: '소셜 로그인에 실패했습니다.',
    description: '소셜 인증 과정에서 오류가 발생했습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.SOCIAL_0202]: {
    code: 'SOCIAL_0202',
    message: '소셜 인증 토큰이 유효하지 않습니다.',
    description: '소셜 서비스에서 제공한 토큰이 유효하지 않습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.SOCIAL_0203]: {
    code: 'SOCIAL_0203',
    message: '소셜 인증 토큰이 만료되었습니다.',
    description: '소셜 서비스 토큰이 만료되어 재인증이 필요합니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.SOCIAL_0204]: {
    code: 'SOCIAL_0204',
    message: '소셜 서비스 연결에 문제가 발생했습니다.',
    description: '소셜 서비스 API 호출 중 오류가 발생했습니다.',
    httpStatus: HttpStatus.BAD_GATEWAY,
  },
  [ErrorCode.SOCIAL_0205]: {
    code: 'SOCIAL_0205',
    message: '소셜 계정에서 이메일 정보를 가져올 수 없습니다.',
    description: '소셜 계정에 이메일이 등록되어 있지 않거나 접근 권한이 없습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.SOCIAL_0206]: {
    code: 'SOCIAL_0206',
    message: '연동된 소셜 계정이 없습니다.',
    description: '해당 소셜 계정과 연동된 계정이 존재하지 않습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },

  // =========================================================================
  // 카카오 (KAKAO_0300-0349)
  // =========================================================================
  [ErrorCode.KAKAO_0301]: {
    code: 'KAKAO_0301',
    message: '카카오 로그인에 실패했습니다.',
    description: '카카오 인증 과정에서 오류가 발생했습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.KAKAO_0302]: {
    code: 'KAKAO_0302',
    message: '카카오 인증 코드가 유효하지 않습니다.',
    description: '카카오 OAuth 인증 코드가 만료되었거나 유효하지 않습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.KAKAO_0303]: {
    code: 'KAKAO_0303',
    message: '카카오 토큰 요청에 실패했습니다.',
    description: '카카오 토큰 API 호출 중 오류가 발생했습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.KAKAO_0304]: {
    code: 'KAKAO_0304',
    message: '카카오 토큰 검증에 실패했습니다.',
    description: '카카오에서 제공한 토큰 검증에 실패했습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.KAKAO_0305]: {
    code: 'KAKAO_0305',
    message: '카카오 사용자 정보를 가져오는데 실패했습니다.',
    description: '카카오 사용자 정보 API 호출 중 오류가 발생했습니다.',
    httpStatus: HttpStatus.BAD_GATEWAY,
  },
  [ErrorCode.KAKAO_0306]: {
    code: 'KAKAO_0306',
    message: '이미 다른 계정에 연동된 카카오 계정입니다.',
    description: '해당 카카오 계정은 다른 사용자 계정에 이미 연동되어 있습니다.',
    httpStatus: HttpStatus.CONFLICT,
  },
  [ErrorCode.KAKAO_0307]: {
    code: 'KAKAO_0307',
    message: '카카오 계정 연동 해제에 실패했습니다.',
    description: '카카오 연동 해제 API 호출 중 오류가 발생했습니다.',
    httpStatus: HttpStatus.BAD_GATEWAY,
  },
  [ErrorCode.KAKAO_0308]: {
    code: 'KAKAO_0308',
    message: '카카오 ID 토큰 검증에 실패했습니다.',
    description: '카카오에서 제공한 ID 토큰 검증에 실패했습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },

  // =========================================================================
  // 애플 (APPLE_0350-0399)
  // =========================================================================
  [ErrorCode.APPLE_0351]: {
    code: 'APPLE_0351',
    message: '애플 로그인에 실패했습니다.',
    description: '애플 인증 과정에서 오류가 발생했습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.APPLE_0352]: {
    code: 'APPLE_0352',
    message: '애플 ID 토큰이 유효하지 않습니다.',
    description: '애플에서 제공한 ID 토큰 검증에 실패했습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.APPLE_0353]: {
    code: 'APPLE_0353',
    message: '애플 인증 코드가 유효하지 않습니다.',
    description: '애플 OAuth 인증 코드가 만료되었거나 유효하지 않습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.APPLE_0354]: {
    code: 'APPLE_0354',
    message: '애플 토큰 검증에 실패했습니다.',
    description: '애플 토큰 서명 검증에 실패했습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.APPLE_0355]: {
    code: 'APPLE_0355',
    message: '이미 다른 계정에 연동된 애플 계정입니다.',
    description: '해당 애플 계정은 다른 사용자 계정에 이미 연동되어 있습니다.',
    httpStatus: HttpStatus.CONFLICT,
  },
  [ErrorCode.APPLE_0356]: {
    code: 'APPLE_0356',
    message: '애플 계정 연동 해제에 실패했습니다.',
    description: '애플 연동 해제 처리 중 오류가 발생했습니다.',
    httpStatus: HttpStatus.BAD_GATEWAY,
  },
  [ErrorCode.APPLE_0357]: {
    code: 'APPLE_0357',
    message: '애플 로그아웃 처리에 실패했습니다.',
    description: '애플 토큰 폐기 API 호출 중 오류가 발생했습니다.',
    httpStatus: HttpStatus.BAD_GATEWAY,
  },

  // =========================================================================
  // 구글 (GOOGLE_0400-0449)
  // =========================================================================
  [ErrorCode.GOOGLE_0401]: {
    code: 'GOOGLE_0401',
    message: '구글 로그인에 실패했습니다.',
    description: '구글 인증 과정에서 오류가 발생했습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.GOOGLE_0402]: {
    code: 'GOOGLE_0402',
    message: '구글 인증 토큰이 유효하지 않습니다.',
    description: '구글에서 제공한 토큰이 유효하지 않습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.GOOGLE_0403]: {
    code: 'GOOGLE_0403',
    message: '구글 토큰 검증에 실패했습니다.',
    description: '구글 토큰 검증 API 호출 중 오류가 발생했습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.GOOGLE_0404]: {
    code: 'GOOGLE_0404',
    message: '구글 계정에서 이메일 정보를 가져올 수 없습니다.',
    description: '구글 계정에 이메일이 등록되어 있지 않거나 접근 권한이 없습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.GOOGLE_0405]: {
    code: 'GOOGLE_0405',
    message: '이미 다른 계정에 연동된 구글 계정입니다.',
    description: '해당 구글 계정은 다른 사용자 계정에 이미 연동되어 있습니다.',
    httpStatus: HttpStatus.CONFLICT,
  },
  [ErrorCode.GOOGLE_0406]: {
    code: 'GOOGLE_0406',
    message: '구글 계정 연동 해제에 실패했습니다.',
    description: '구글 연동 해제 처리 중 오류가 발생했습니다.',
    httpStatus: HttpStatus.BAD_GATEWAY,
  },

  // =========================================================================
  // 네이버 (NAVER_0450-0499)
  // =========================================================================
  [ErrorCode.NAVER_0451]: {
    code: 'NAVER_0451',
    message: '네이버 로그인에 실패했습니다.',
    description: '네이버 인증 과정에서 오류가 발생했습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.NAVER_0452]: {
    code: 'NAVER_0452',
    message: '네이버 인증 토큰이 유효하지 않습니다.',
    description: '네이버에서 제공한 토큰이 유효하지 않습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.NAVER_0453]: {
    code: 'NAVER_0453',
    message: '네이버 토큰 검증에 실패했습니다.',
    description: '네이버 토큰 검증 과정에서 오류가 발생했습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.NAVER_0454]: {
    code: 'NAVER_0454',
    message: '네이버 사용자 정보를 가져오는데 실패했습니다.',
    description: '네이버 사용자 정보 API 호출 중 오류가 발생했습니다.',
    httpStatus: HttpStatus.BAD_GATEWAY,
  },
  [ErrorCode.NAVER_0455]: {
    code: 'NAVER_0455',
    message: '이미 다른 계정에 연동된 네이버 계정입니다.',
    description: '해당 네이버 계정은 다른 사용자 계정에 이미 연동되어 있습니다.',
    httpStatus: HttpStatus.CONFLICT,
  },
  [ErrorCode.NAVER_0456]: {
    code: 'NAVER_0456',
    message: '네이버 계정 연동 해제에 실패했습니다.',
    description: '네이버 연동 해제 API 호출 중 오류가 발생했습니다.',
    httpStatus: HttpStatus.BAD_GATEWAY,
  },

  // =========================================================================
  // 이메일 인증 (EMAIL_0500-0549)
  // =========================================================================
  [ErrorCode.EMAIL_0501]: {
    code: 'EMAIL_0501',
    message: '이미 등록된 이메일입니다.',
    description: '해당 이메일 주소는 이미 다른 계정에서 사용 중입니다.',
    httpStatus: HttpStatus.CONFLICT,
  },
  [ErrorCode.EMAIL_0502]: {
    code: 'EMAIL_0502',
    message: '등록되지 않은 이메일입니다.',
    description: '해당 이메일로 등록된 계정이 존재하지 않습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.EMAIL_0503]: {
    code: 'EMAIL_0503',
    message: '이메일 인증이 완료되지 않았습니다.',
    description: '이메일 인증을 완료해야 해당 기능을 사용할 수 있습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.EMAIL_0504]: {
    code: 'EMAIL_0504',
    message: '인증 코드가 올바르지 않습니다.',
    description: '입력한 이메일 인증 코드가 일치하지 않습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.EMAIL_0505]: {
    code: 'EMAIL_0505',
    message: '인증 코드가 만료되었습니다.',
    description: '이메일 인증 코드의 유효 시간이 지났습니다. 새 코드를 요청하세요.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.EMAIL_0506]: {
    code: 'EMAIL_0506',
    message: '이메일 발송에 실패했습니다.',
    description: '이메일 발송 서비스 오류가 발생했습니다.',
    httpStatus: HttpStatus.BAD_GATEWAY,
  },
  [ErrorCode.EMAIL_0507]: {
    code: 'EMAIL_0507',
    message: '비밀번호가 올바르지 않습니다.',
    description: '입력한 비밀번호가 계정 비밀번호와 일치하지 않습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.EMAIL_0508]: {
    code: 'EMAIL_0508',
    message: '비밀번호가 일치하지 않습니다.',
    description: '비밀번호 확인 값이 입력한 비밀번호와 일치하지 않습니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },

  // =========================================================================
  // 사용자/계정 (USER_0600-0699)
  // =========================================================================
  [ErrorCode.USER_0601]: {
    code: 'USER_0601',
    message: '사용자를 찾을 수 없습니다.',
    description: '해당 ID의 사용자가 존재하지 않습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.USER_0602]: {
    code: 'USER_0602',
    message: '이메일 또는 비밀번호가 올바르지 않습니다.',
    description: '로그인 자격 증명이 유효하지 않습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.USER_0603]: {
    code: 'USER_0603',
    message: '연결된 계정을 찾을 수 없습니다.',
    description: '해당 소셜 계정과 연결된 사용자 계정이 존재하지 않습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.USER_0604]: {
    code: 'USER_0604',
    message: '이미 가입된 계정입니다.',
    description: '해당 정보로 이미 가입된 계정이 존재합니다.',
    httpStatus: HttpStatus.CONFLICT,
  },
  [ErrorCode.USER_0605]: {
    code: 'USER_0605',
    message: '정지된 계정입니다. 고객센터에 문의해주세요.',
    description: '관리자에 의해 계정이 정지되었습니다.',
    httpStatus: HttpStatus.FORBIDDEN,
  },
  [ErrorCode.USER_0606]: {
    code: 'USER_0606',
    message: '탈퇴한 계정입니다.',
    description: '해당 계정은 이미 탈퇴 처리되었습니다.',
    httpStatus: HttpStatus.GONE,
  },
  [ErrorCode.USER_0607]: {
    code: 'USER_0607',
    message: '계정이 잠겼습니다. 잠시 후 다시 시도해주세요.',
    description: '잘못된 로그인 시도가 너무 많아 계정이 일시적으로 잠겼습니다.',
    httpStatus: HttpStatus.LOCKED,
  },
  [ErrorCode.USER_0608]: {
    code: 'USER_0608',
    message: '이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.',
    description: '계정 활성화를 위해 이메일 인증이 필요합니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.USER_0609]: {
    code: 'USER_0609',
    message: '로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.',
    description: '보안을 위해 로그인 시도가 일시적으로 제한되었습니다.',
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
  },
  [ErrorCode.USER_0610]: {
    code: 'USER_0610',
    message: '마지막 로그인 수단은 해제할 수 없습니다.',
    description: '최소 하나의 로그인 수단이 유지되어야 합니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  [ErrorCode.USER_0611]: {
    code: 'USER_0611',
    message: '사용자 태그 생성에 실패했습니다.',
    description: '최대 시도 횟수 초과로 고유 태그 생성에 실패했습니다.',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  [ErrorCode.USER_0612]: {
    code: 'USER_0612',
    message: '회원 탈퇴를 위해 비밀번호를 입력해주세요.',
    description: '이메일 계정의 회원 탈퇴 시 비밀번호 확인이 필요합니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  [ErrorCode.USER_0613]: {
    code: 'USER_0613',
    message: '소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.',
    description:
      '비밀번호 변경은 이메일 가입 계정만 가능합니다. 소셜 계정 해제 후 비밀번호를 설정해주세요.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  [ErrorCode.USER_0614]: {
    code: 'USER_0614',
    message: '이미 비밀번호가 설정된 계정입니다.',
    description: '이메일 가입 계정이 이미 존재합니다. 비밀번호 변경을 이용해주세요.',
    httpStatus: HttpStatus.CONFLICT,
  },
  [ErrorCode.USER_0615]: {
    code: 'USER_0615',
    message: '탈퇴한 계정이 복구되었습니다.',
    description: '유예 기간(30일) 내 재로그인으로 계정이 자동 복구되었습니다.',
    httpStatus: HttpStatus.OK,
  },

  // =========================================================================
  // 세션 (SESSION_0700-0749)
  // =========================================================================
  [ErrorCode.SESSION_0701]: {
    code: 'SESSION_0701',
    message: '세션을 찾을 수 없습니다.',
    description: '해당 세션 ID가 존재하지 않습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.SESSION_0702]: {
    code: 'SESSION_0702',
    message: '세션이 만료되었습니다. 다시 로그인해주세요.',
    description: '세션 유효 기간이 지났습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.SESSION_0703]: {
    code: 'SESSION_0703',
    message: '세션이 종료되었습니다. 다시 로그인해주세요.',
    description: '해당 세션이 명시적으로 종료되었습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.SESSION_0704]: {
    code: 'SESSION_0704',
    message: '보안상의 이유로 모든 세션이 종료되었습니다. 다시 로그인해주세요.',
    description: '토큰 재사용이 감지되어 보안을 위해 모든 세션이 무효화되었습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },

  // =========================================================================
  // 인증 코드 (VERIFY_0750-0799)
  // =========================================================================
  [ErrorCode.VERIFY_0751]: {
    code: 'VERIFY_0751',
    message: '인증 코드가 올바르지 않습니다.',
    description: '입력한 인증 코드가 일치하지 않습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.VERIFY_0752]: {
    code: 'VERIFY_0752',
    message: '인증 코드가 만료되었습니다.',
    description: '인증 코드의 유효 시간이 지났습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.VERIFY_0753]: {
    code: 'VERIFY_0753',
    message: '인증 코드 재발송은 1분 후에 가능합니다.',
    description: '인증 코드 재발송 제한 시간이 아직 지나지 않았습니다.',
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
  },
  [ErrorCode.VERIFY_0754]: {
    code: 'VERIFY_0754',
    message: '인증 시도 횟수를 초과했습니다. 새 인증 코드를 요청해주세요.',
    description: '최대 인증 시도 횟수를 초과했습니다.',
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
  },

  // =========================================================================
  // Todo (TODO_0800-0849)
  // =========================================================================
  [ErrorCode.TODO_0801]: {
    code: 'TODO_0801',
    message: 'Todo를 찾을 수 없습니다.',
    description: '해당 ID의 Todo가 존재하지 않습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.TODO_0810]: {
    code: 'TODO_0810',
    message: '이동할 위치의 할 일을 찾을 수 없습니다.',
    description: '순서 변경 시 기준이 되는 할 일이 존재하지 않습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.TODO_0811]: {
    code: 'TODO_0811',
    message: '카테고리의 활성 할 일이 최대 한도에 도달했습니다.',
    description:
      '카테고리당 활성(미완료) 할 일 수가 최대 한도를 초과했습니다. 할 일을 완료하거나 다른 카테고리로 이동해주세요.',
    httpStatus: HttpStatus.FORBIDDEN,
  },
  [ErrorCode.TODO_0812]: {
    code: 'TODO_0812',
    message: '반복 할 일 생성 한도를 초과했습니다.',
    description: '한 번에 생성할 수 있는 반복 할 일은 최대 100개입니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  [ErrorCode.TODO_0813]: {
    code: 'TODO_0813',
    message: '반복 할 일을 생성하면 카테고리의 할 일 한도를 초과합니다.',
    description:
      '반복 할 일 생성 시 카테고리의 활성(미완료) 할 일 수가 최대 한도를 초과합니다. 할 일을 완료하거나 다른 카테고리로 이동해주세요.',
    httpStatus: HttpStatus.FORBIDDEN,
  },

  // =========================================================================
  // Todo 카테고리 (TODO_CATEGORY_0850-0899)
  // =========================================================================
  [ErrorCode.TODO_CATEGORY_0851]: {
    code: 'TODO_CATEGORY_0851',
    message: '카테고리를 찾을 수 없습니다.',
    description: '해당 ID의 카테고리가 존재하지 않습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.TODO_CATEGORY_0852]: {
    code: 'TODO_CATEGORY_0852',
    message: '다른 사용자의 카테고리입니다.',
    description: '해당 카테고리에 대한 접근 권한이 없습니다.',
    httpStatus: HttpStatus.FORBIDDEN,
  },
  [ErrorCode.TODO_CATEGORY_0853]: {
    code: 'TODO_CATEGORY_0853',
    message: '동일한 이름의 카테고리가 이미 존재합니다.',
    description: '같은 이름의 카테고리를 중복으로 생성할 수 없습니다.',
    httpStatus: HttpStatus.CONFLICT,
  },
  [ErrorCode.TODO_CATEGORY_0854]: {
    code: 'TODO_CATEGORY_0854',
    message: '최소 1개의 카테고리가 필요합니다.',
    description: '마지막 카테고리는 삭제할 수 없습니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  [ErrorCode.TODO_CATEGORY_0855]: {
    code: 'TODO_CATEGORY_0855',
    message: '카테고리에 할 일이 있습니다. 다른 카테고리로 이동해주세요.',
    description: '할 일이 있는 카테고리는 바로 삭제할 수 없습니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  [ErrorCode.TODO_CATEGORY_0856]: {
    code: 'TODO_CATEGORY_0856',
    message: '이동할 카테고리를 지정해주세요.',
    description: '카테고리 삭제 시 할 일을 이동할 카테고리 ID가 필요합니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  [ErrorCode.TODO_CATEGORY_0857]: {
    code: 'TODO_CATEGORY_0857',
    message: '카테고리 개수가 최대 한도에 도달했습니다.',
    description:
      '무료 사용자의 카테고리 수가 최대 한도를 초과했습니다. 프리미엄 구독 시 무제한으로 이용할 수 있습니다.',
    httpStatus: HttpStatus.FORBIDDEN,
  },

  // =========================================================================
  // 친구/팔로우 (FOLLOW_0900-0999)
  // =========================================================================
  [ErrorCode.FOLLOW_0901]: {
    code: 'FOLLOW_0901',
    message: '이미 친구 요청을 보냈습니다.',
    description: '해당 사용자에게 이미 친구 요청을 보낸 상태입니다.',
    httpStatus: HttpStatus.CONFLICT,
  },
  [ErrorCode.FOLLOW_0902]: {
    code: 'FOLLOW_0902',
    message: '이미 친구 관계입니다.',
    description: '해당 사용자와 이미 친구 관계입니다.',
    httpStatus: HttpStatus.CONFLICT,
  },
  [ErrorCode.FOLLOW_0903]: {
    code: 'FOLLOW_0903',
    message: '친구 요청을 찾을 수 없습니다.',
    description: '해당 친구 요청이 존재하지 않거나 이미 처리되었습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.FOLLOW_0904]: {
    code: 'FOLLOW_0904',
    message: '자기 자신에게 친구 요청을 보낼 수 없습니다.',
    description: '자기 자신을 친구로 추가할 수 없습니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  [ErrorCode.FOLLOW_0905]: {
    code: 'FOLLOW_0905',
    message: '해당 사용자를 찾을 수 없습니다.',
    description: '친구 요청 대상 사용자가 존재하지 않습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.FOLLOW_0906]: {
    code: 'FOLLOW_0906',
    message: '친구가 아닌 사용자의 투두를 볼 수 없습니다.',
    description: '서로 친구 관계인 경우에만 투두를 조회할 수 있습니다.',
    httpStatus: HttpStatus.FORBIDDEN,
  },
  [ErrorCode.FOLLOW_0907]: {
    code: 'FOLLOW_0907',
    message: '친구 관계가 아닙니다.',
    description: '해당 사용자와 친구 관계가 아닙니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.FOLLOW_0908]: {
    code: 'FOLLOW_0908',
    message: '이미 상대방이 친구 요청을 보냈습니다.',
    description: '상대방의 친구 요청을 수락하거나 거절해주세요.',
    httpStatus: HttpStatus.CONFLICT,
  },
  [ErrorCode.FOLLOW_0909]: {
    code: 'FOLLOW_0909',
    message: '친구 수가 최대 한도에 도달했습니다.',
    description:
      '무료 사용자의 친구 수가 최대 한도를 초과했습니다. 프리미엄 구독 시 무제한으로 이용할 수 있습니다.',
    httpStatus: HttpStatus.FORBIDDEN,
  },

  // =========================================================================
  // 알림/푸시 (NOTIFICATION_1000-1099)
  // =========================================================================
  [ErrorCode.NOTIFICATION_1001]: {
    code: 'NOTIFICATION_1001',
    message: '유효하지 않은 푸시 토큰입니다.',
    description: '푸시 토큰 형식이 올바르지 않습니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  [ErrorCode.NOTIFICATION_1002]: {
    code: 'NOTIFICATION_1002',
    message: '등록된 푸시 토큰이 없습니다.',
    description: '해당 사용자에게 등록된 푸시 토큰이 존재하지 않습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.NOTIFICATION_1003]: {
    code: 'NOTIFICATION_1003',
    message: '푸시 발송에 실패했습니다.',
    description: '푸시 알림 전송 중 오류가 발생했습니다.',
    httpStatus: HttpStatus.BAD_GATEWAY,
  },
  [ErrorCode.NOTIFICATION_1004]: {
    code: 'NOTIFICATION_1004',
    message: '알림을 찾을 수 없습니다.',
    description: '해당 ID의 알림이 존재하지 않습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.NOTIFICATION_1005]: {
    code: 'NOTIFICATION_1005',
    message: '알림에 대한 접근 권한이 없습니다.',
    description: '해당 알림은 다른 사용자의 알림입니다.',
    httpStatus: HttpStatus.FORBIDDEN,
  },

  // =========================================================================
  // 콕 찌르기 (NUDGE_1100-1199)
  // =========================================================================
  [ErrorCode.NUDGE_1101]: {
    code: 'NUDGE_1101',
    message: '일일 콕 찌르기 횟수를 초과했습니다.',
    description: 'FREE 사용자는 하루 3회까지만 콕 찌를 수 있습니다.',
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
  },
  [ErrorCode.NUDGE_1102]: {
    code: 'NUDGE_1102',
    message: '쿨다운 기간입니다. 24시간 후 다시 시도해주세요.',
    description: '같은 할일에 대해 24시간 내 재콕 찌르기는 불가합니다.',
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
  },
  [ErrorCode.NUDGE_1103]: {
    code: 'NUDGE_1103',
    message: '친구 관계가 아닙니다.',
    description: '콕 찌르기는 친구에게만 보낼 수 있습니다.',
    httpStatus: HttpStatus.FORBIDDEN,
  },
  [ErrorCode.NUDGE_1104]: {
    code: 'NUDGE_1104',
    message: '자신에게 콕 찌를 수 없습니다.',
    description: '자기 자신에게는 콕 찌를 수 없습니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  [ErrorCode.NUDGE_1105]: {
    code: 'NUDGE_1105',
    message: 'Nudge를 찾을 수 없습니다.',
    description: '해당 ID의 Nudge가 존재하지 않습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.NUDGE_1106]: {
    code: 'NUDGE_1106',
    message: '오늘의 할 일에만 콕 찌를 수 있습니다.',
    description: '콕 찌르기는 오늘 날짜에 해당하는 할 일에만 가능합니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },

  // =========================================================================
  // 응원 (CHEER_1200-1299)
  // =========================================================================
  [ErrorCode.CHEER_1201]: {
    code: 'CHEER_1201',
    message: '일일 응원 횟수를 초과했습니다.',
    description: 'FREE 사용자는 하루 3회까지만 응원을 보낼 수 있습니다.',
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
  },
  [ErrorCode.CHEER_1202]: {
    code: 'CHEER_1202',
    message: '쿨다운 기간입니다. 24시간 후 다시 시도해주세요.',
    description: '같은 친구에게 24시간 내 재응원은 불가합니다.',
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
  },
  [ErrorCode.CHEER_1203]: {
    code: 'CHEER_1203',
    message: '친구 관계가 아닙니다.',
    description: '응원은 친구에게만 보낼 수 있습니다.',
    httpStatus: HttpStatus.FORBIDDEN,
  },
  [ErrorCode.CHEER_1204]: {
    code: 'CHEER_1204',
    message: '자신에게 응원할 수 없습니다.',
    description: '자기 자신에게는 응원을 보낼 수 없습니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  [ErrorCode.CHEER_1205]: {
    code: 'CHEER_1205',
    message: 'Cheer를 찾을 수 없습니다.',
    description: '해당 ID의 Cheer가 존재하지 않습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },

  // =========================================================================
  // AI 서비스 (AI_1300-1399)
  // =========================================================================
  [ErrorCode.AI_1301]: {
    code: 'AI_1301',
    message: 'AI 서비스를 사용할 수 없습니다.',
    description: 'AI 서비스가 일시적으로 사용 불가능하거나 API 키가 설정되지 않았습니다.',
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
  },
  [ErrorCode.AI_1302]: {
    code: 'AI_1302',
    message: '자연어 파싱에 실패했습니다.',
    description: 'AI가 입력 텍스트를 투두 데이터로 변환하지 못했습니다.',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
  },
  [ErrorCode.AI_1303]: {
    code: 'AI_1303',
    message: '일일 AI 사용 횟수를 초과했습니다.',
    description: '무료 사용자는 하루 5회까지만 AI 기능을 사용할 수 있습니다.',
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
  },
  [ErrorCode.AI_1304]: {
    code: 'AI_1304',
    message: '리포트를 찾을 수 없습니다.',
    description: '요청한 AI 리포트가 존재하지 않습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.AI_1305]: {
    code: 'AI_1305',
    message: '제안을 찾을 수 없습니다.',
    description: '요청한 AI 제안이 존재하지 않습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.AI_1306]: {
    code: 'AI_1306',
    message: '이미 처리된 제안입니다.',
    description: '해당 제안은 이미 수락 또는 거절되었습니다.',
    httpStatus: HttpStatus.CONFLICT,
  },
  [ErrorCode.AI_1307]: {
    code: 'AI_1307',
    message: '만료된 제안입니다.',
    description: '해당 제안의 유효기간이 지났습니다.',
    httpStatus: HttpStatus.GONE,
  },
  [ErrorCode.AI_1308]: {
    code: 'AI_1308',
    message: 'AI 리포트는 프리미엄 기능입니다.',
    description: 'AI 리포트 조회는 프리미엄 구독 사용자만 이용할 수 있습니다.',
    httpStatus: HttpStatus.FORBIDDEN,
  },
  [ErrorCode.AI_1309]: {
    code: 'AI_1309',
    message: 'AI 제안은 프리미엄 기능입니다.',
    description: 'AI 반복 제안 기능은 프리미엄 구독 사용자만 이용할 수 있습니다.',
    httpStatus: HttpStatus.FORBIDDEN,
  },

  // =========================================================================
  // 관리자 (ADMIN_1400-1499)
  // =========================================================================
  [ErrorCode.ADMIN_1401]: {
    code: 'ADMIN_1401',
    message: '관리자 권한이 필요합니다.',
    description: '해당 작업은 관리자만 수행할 수 있습니다.',
    httpStatus: HttpStatus.FORBIDDEN,
  },
  [ErrorCode.ADMIN_1402]: {
    code: 'ADMIN_1402',
    message: '알림 대상 사용자가 없습니다.',
    description: '주어진 조건에 해당하는 사용자가 없습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.ADMIN_1403]: {
    code: 'ADMIN_1403',
    message: '유효하지 않은 필터 조건입니다.',
    description: '알림 대상 필터 조건이 올바르지 않습니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },

  // =========================================================================
  // 문의 (INQUIRY_1500-1599)
  // =========================================================================
  [ErrorCode.INQUIRY_1501]: {
    code: 'INQUIRY_1501',
    message: '문의 이메일 발송에 실패했습니다.',
    description: '문의 이메일 발송 서비스 오류가 발생했습니다.',
    httpStatus: HttpStatus.BAD_GATEWAY,
  },

  // =========================================================================
  // 구독 (SUBSCRIPTION_1600-1699)
  // =========================================================================
  [ErrorCode.SUBSCRIPTION_1601]: {
    code: 'SUBSCRIPTION_1601',
    message: 'Webhook 서명 검증에 실패했습니다.',
    description: 'RevenueCat Webhook 요청의 인증 헤더가 유효하지 않습니다.',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  [ErrorCode.SUBSCRIPTION_1602]: {
    code: 'SUBSCRIPTION_1602',
    message: '구독 사용자를 찾을 수 없습니다.',
    description: 'Webhook의 app_user_id에 해당하는 사용자가 존재하지 않습니다.',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  [ErrorCode.SUBSCRIPTION_1603]: {
    code: 'SUBSCRIPTION_1603',
    message: '지원하지 않는 Webhook 이벤트 타입입니다.',
    description: '처리할 수 없는 RevenueCat 이벤트 타입입니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  [ErrorCode.SUBSCRIPTION_1604]: {
    code: 'SUBSCRIPTION_1604',
    message: 'Webhook 처리에 실패했습니다.',
    description: 'RevenueCat Webhook 이벤트 처리 중 오류가 발생했습니다.',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  [ErrorCode.SUBSCRIPTION_1605]: {
    code: 'SUBSCRIPTION_1605',
    message: 'Webhook Lock 경합이 발생했습니다.',
    description: '동일 사용자에 대한 Webhook이 동시에 처리 중입니다. 잠시 후 재시도됩니다.',
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
  },

  // =========================================================================
  // 설정 (PREFERENCE_1700-1799)
  // =========================================================================
  [ErrorCode.PREFERENCE_1701]: {
    code: 'PREFERENCE_1701',
    message: '리마인드 알림은 프리미엄 기능입니다.',
    description: '아침/저녁 리마인드 알림 설정은 프리미엄 구독 사용자만 변경할 수 있습니다.',
    httpStatus: HttpStatus.FORBIDDEN,
  },
  [ErrorCode.PREFERENCE_1702]: {
    code: 'PREFERENCE_1702',
    message: '리마인더 시간 범위가 올바르지 않습니다.',
    description:
      '오전 리마인더는 0:00-11:30, 오후 리마인더는 12:00-23:30만 설정할 수 있습니다. 분은 0 또는 30만 허용됩니다.',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
};
