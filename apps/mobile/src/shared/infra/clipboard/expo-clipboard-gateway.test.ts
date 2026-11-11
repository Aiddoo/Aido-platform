import '@src/shared/i18n/init';
import { ClipboardCopyError } from '@src/core/ports/clipboard-gateway';
import { getUserFacingMessage, isCodedError } from '@src/shared/errors';
import * as Clipboard from 'expo-clipboard';

import { expoClipboardGateway } from './expo-clipboard-gateway';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

const setStringAsync = jest.mocked(Clipboard.setStringAsync);

/** Expo 네이티브 모듈 오류처럼 문자열 `code`와 영문 message를 지닌다 */
function createExpoModuleError() {
  return Object.assign(
    new Error('Call to function ExpoClipboard.setStringAsync has been rejected'),
    {
      code: 'ERR_CLIPBOARD_UNAVAILABLE',
    },
  );
}

describe('expoClipboardGateway', () => {
  it('SDK 거절을 코드 없는 포트 오류로 바꿔 영문 SDK 문구가 사용자 문구로 새지 않고 원본은 cause에 남긴다', async () => {
    // Given
    const sdkError = createExpoModuleError();
    setStringAsync.mockRejectedValue(sdkError);

    // When
    const failure: unknown = await expoClipboardGateway
      .copy('https://aido.app/i/ABC')
      .catch((error: unknown) => error);

    // Then
    expect(failure).toBeInstanceOf(ClipboardCopyError);
    expect(isCodedError(failure)).toBe(false);
    expect(getUserFacingMessage(failure)).toBeUndefined();
    expect(failure instanceof ClipboardCopyError && failure.cause).toBe(sdkError);
  });
});
