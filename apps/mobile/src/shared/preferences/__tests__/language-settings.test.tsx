import { i18n } from '@src/shared/i18n';
import { LanguageProvider } from '@src/shared/providers/language-provider';
import { createAnalyticsStub, createMemoryObservableSyncStorage } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';

import LanguageSettingsScreen from '../../../../app/(app)/(tabs)/(mypage)/settings/language';

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

const renderLanguageSettings = async ({
  storage = createMemoryObservableSyncStorage(),
  analytics = createAnalyticsStub(),
} = {}) => {
  await renderScreen(
    <LanguageProvider syncStorage={storage} useDeviceLanguage={() => 'ko'}>
      <LanguageSettingsScreen />
    </LanguageProvider>,
    { di: { analytics } },
  );
  return { storage, analytics };
};

describe('LanguageSettingsScreen', () => {
  it('English 선택 시 스토리지 저장·i18n 언어 변경·analytics 이벤트가 발생한다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const { analytics } = await renderLanguageSettings({ storage });

    // When
    await fireEvent.press(screen.getByTestId('language-option-en'));

    // Then
    expect(storage.get('aido_language')).toBe('en');
    expect(i18n.language).toBe('en');
    expect(analytics.trackEvent).toHaveBeenCalledWith('settings_changed', {
      setting: 'language',
      value: 'en',
    });
  });

  it('시스템 설정 선택 시 기기 언어 기준으로 i18n 언어가 해석된다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_language', 'en');
    await renderLanguageSettings({ storage });

    // When
    await fireEvent.press(screen.getByTestId('language-option-system'));

    // Then
    expect(storage.get('aido_language')).toBe('system');
    expect(i18n.language).toBe('ko');
  });

  it('en으로 저장된 상태에서 화면 라벨이 영어로 렌더링된다', async () => {
    // Given
    await i18n.changeLanguage('en');
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_language', 'en');

    // When
    await renderLanguageSettings({ storage });

    // Then
    expect(screen.getByText('System default')).toBeTruthy();
    expect(screen.getByText('한국어')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
  });
});
