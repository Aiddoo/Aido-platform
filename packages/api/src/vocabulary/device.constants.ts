/** X-Device-Name 표시 한도. 앱은 이 길이로 잘라 보내고 서버도 넘치면 자른다. */
export const DEVICE_NAME_MAX_LENGTH = 40;

/** X-OS-Version 형식. 앱은 맞을 때만 보내고 서버는 맞지 않으면 버린다. */
export const OS_VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._-]{0,19}$/;
