import { OPEN_URL_LOG_EVENT } from '@src/shared/constants/open-url-log-events';
import {
  createAppLoggerStub,
  createExternalLinkGatewayStub,
  createTestDi,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';

import { useOpenAppSettings } from './use-open-app-settings';

async function setup({ canOpenSettings = true }: { canOpenSettings?: boolean } = {}) {
  const externalLink = createExternalLinkGatewayStub({ canOpenSettings });
  const logger = createAppLoggerStub();
  const { result } = await renderScreenHook(() => useOpenAppSettings(), {
    di: createTestDi({ ports: { externalLink, logger } }),
  });
  return { result, externalLink, logger };
}

describe('useOpenAppSettings', () => {
  it('설정 화면이 있는 기기에서는 이 앱의 설정 화면을 연다', async () => {
    // Given
    const { result, externalLink } = await setup();

    // When
    const opened = await result.current.open();

    // Then
    expect(result.current.canOpen).toBe(true);
    expect(opened).toEqual({ isOpened: true });
    expect(externalLink.openSettings).toHaveBeenCalledTimes(1);
  });

  it('열지 못하면 로그만 남기고 원래 오류를 돌려줘 부른 쪽이 알릴지 정한다', async () => {
    // Given
    const { result, externalLink, logger } = await setup();
    const error = new Error('settings unavailable');
    externalLink.openSettings.mockRejectedValue(error);

    // When
    const opened = await result.current.open();

    // Then
    expect(opened).toEqual({ isOpened: false, error });
    expect(logger.warn).toHaveBeenCalledWith(OPEN_URL_LOG_EVENT.SETTINGS_OPEN_FAILED, {
      error: 'settings unavailable',
    });
  });

  it('앱 설정 화면이 없는 기기(Mac)는 열 수 없다고 알려 화면이 글로 가는 길을 보이게 한다', async () => {
    // When
    const { result } = await setup({ canOpenSettings: false });

    // Then
    expect(result.current.canOpen).toBe(false);
  });
});
