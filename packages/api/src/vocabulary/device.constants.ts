/** X-Device-Name 표시 한도. 앱은 이 길이로 잘라 보내고 서버도 넘치면 자른다. */
export const DEVICE_NAME_MAX_LENGTH = 40;

/** 로그인 요청 본문 `deviceName`의 길이 한도. 세션 구분용 이름이라 X-Device-Name보다 넉넉하다. */
export const SESSION_DEVICE_NAME_MAX_LENGTH = 100;

/** X-OS-Version 형식. 앱은 맞을 때만 보내고 서버는 맞지 않으면 버린다. */
export const OS_VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._-]{0,19}$/;
