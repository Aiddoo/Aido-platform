import '@src/shared/i18n/init';
import type { SettingsApp } from '@src/core/ports/external-link-gateway';
import { createExternalLinkGatewayStub, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';

import { MissingCalendarHelp } from './missing-calendar-help';

async function openGuide(settingsApp: SettingsApp) {
  const externalLink = createExternalLinkGatewayStub({ settingsApp });
  await renderScreen(<MissingCalendarHelp />, {
    di: createTestDi({ ports: { externalLink } }),
    withOverlay: true,
  });
  await fireEvent.press(screen.getByText('캘린더가 목록에 없나요?'));
}

describe('MissingCalendarHelp', () => {
  // 계정을 더하는 설정 위치가 기기마다 달라, 기기 값을 포트 stub으로 고정해 안내가 갈리는지 본다
  it.each<[string, SettingsApp, string]>([
    [
      'Mac(Designed for iPad)은 시스템 설정의 인터넷 계정으로 안내한다',
      { device: 'desktop', hasAppsMenu: true },
      'Mac의 시스템 설정 > 인터넷 계정으로 가요',
    ],
    [
      '설정에 앱 메뉴가 있는 iPad는 앱 아래 캘린더로 안내한다',
      { device: 'tablet', hasAppsMenu: true },
      'iPad 설정 > 앱 > 캘린더 > 캘린더 계정으로 가요',
    ],
    [
      '앱 메뉴가 없는 iPhone은 설정 맨 위의 캘린더로 안내한다',
      { device: 'phone', hasAppsMenu: false },
      'iPhone 설정 > 캘린더 > 계정으로 가요',
    ],
  ])('%s', async (_case, settingsApp, expectedStep) => {
    // When
    await openGuide(settingsApp);

    // Then
    expect(await screen.findByText(expectedStep)).toBeOnTheScreen();
  });
});
