import { i18n } from '@src/shared/i18n';
import { ThemeProvider } from '@src/shared/providers/theme-provider';
import {
  createAnalyticsStub,
  createMemoryObservableSyncStorage,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';

import ThemeSettingsScreen from '../../../../app/(app)/(tabs)/(me,memos,todos)/settings/theme';

const renderThemeSettings = async ({
  storage = createMemoryObservableSyncStorage(),
  analytics = createAnalyticsStub(),
} = {}) => {
  await renderScreen(
    <ThemeProvider syncStorage={storage}>
      <ThemeSettingsScreen />
    </ThemeProvider>,
    { di: createTestDi({ ports: { analytics } }) },
  );
  return { storage, analytics };
};

describe('ThemeSettingsScreen', () => {
  it('다크 모드를 고르면 기기에 저장하고 settings_changed를 한 번 남긴다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const { analytics } = await renderThemeSettings({ storage });

    // When
    await fireEvent.press(screen.getByText(i18n.t('settings:theme.dark')));

    // Then
    expect(storage.get('aido_theme_mode')).toBe('dark');
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('settings_changed', {
      setting: 'theme',
      value: 'dark',
    });
  });
});
