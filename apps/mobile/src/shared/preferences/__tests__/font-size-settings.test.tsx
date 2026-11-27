import { i18n } from '@src/shared/i18n';
import { FontScaleProvider } from '@src/shared/providers/font-scale-provider';
import {
  createAnalyticsStub,
  createMemoryObservableSyncStorage,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';

import FontSizeSettingsScreen from '../../../../app/(app)/(tabs)/(me,memos,todos)/settings/font-size';

const renderFontSizeSettings = async ({
  storage = createMemoryObservableSyncStorage(),
  analytics = createAnalyticsStub(),
} = {}) => {
  await renderScreen(
    <FontScaleProvider syncStorage={storage}>
      <FontSizeSettingsScreen />
    </FontScaleProvider>,
    { di: createTestDi({ ports: { analytics } }) },
  );
  return { storage, analytics };
};

describe('FontSizeSettingsScreen', () => {
  it('큰 글꼴을 고르면 기기에 저장하고 settings_changed를 한 번 남긴다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const { analytics } = await renderFontSizeSettings({ storage });

    // When
    await fireEvent.press(screen.getByText(i18n.t('settings:fontSize.large')));

    // Then
    expect(storage.get('aido_font_scale')).toBe('large');
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('settings_changed', {
      setting: 'font_scale',
      value: 'large',
    });
  });
});
