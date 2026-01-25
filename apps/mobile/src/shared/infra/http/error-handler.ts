import type { ErrorCodeType } from '@aido/errors';
import type { AfterResponseHook } from 'ky';

const MOBILE_ERROR_MESSAGES: Partial<Record<ErrorCodeType, string>> = {
  SYS_0001: '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
  SYS_0002: '잘못된 요청이에요',
  AUTH_0101: '유효하지 않은 토큰이에요',
  AUTH_0102: '로그인이 만료되었어요. 다시 로그인해주세요.',
  AUTH_0107: '로그인이 필요한 기능이에요',

  FOLLOW_0901: '이미 친구 요청을 보냈어요',
  FOLLOW_0902: '이미 친구예요',
  FOLLOW_0903: '친구 요청을 찾을 수 없어요',
  FOLLOW_0904: '자기 자신에게는 친구 요청을 보낼 수 없어요',
  FOLLOW_0905: '사용자를 찾을 수 없어요',
  FOLLOW_0906: '친구가 아닌 사용자의 투두는 볼 수 없어요',
  FOLLOW_0907: '친구가 아니에요',
  FOLLOW_0908: '이미 상대방이 친구 요청을 보냈어요',

  NUDGE_1101: '오늘 독촉 횟수를 모두 사용했어요',
  NUDGE_1102: '24시간 후에 다시 독촉할 수 있어요',
};

interface ServerErrorResponse {
  success: false;
  error: { code: string; message: string };
}

export const handleApiErrors: AfterResponseHook = async (_request, _options, response) => {
  // 401은 refresh 로직에서 처리하므로 건너뜀
  if (!response.ok && response.status !== 401) {
    const { error } = (await response.json()) as ServerErrorResponse;
    const userMessage =
      MOBILE_ERROR_MESSAGES[error.code as ErrorCodeType] ||
      error.message ||
      '알 수 없는 오류가 발생했어요';
    throw new Error(userMessage);
  }
};
