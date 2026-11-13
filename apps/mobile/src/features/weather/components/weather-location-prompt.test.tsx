import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';

import { WeatherLocationPrompt } from './weather-location-prompt';

describe('WeatherLocationPrompt', () => {
  it('아직 묻지 않았으면 계속 하나만 두고, 누르면 시스템 위치 창으로 넘긴다', async () => {
    // Given
    const onContinue = jest.fn();
    await renderScreen(<WeatherLocationPrompt.Ask onContinue={onContinue} />);

    // When
    fireEvent.press(screen.getByRole('button', { name: '계속' }));

    // Then 시스템 창을 건너뛰는 버튼은 없다(App Store 5.1.1)
    expect(screen.getByText('지금 있는 곳 날씨를 보여드릴게요')).toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('이미 거절했으면 기기 설정을 연다', async () => {
    // Given
    const onOpenSettings = jest.fn();
    await renderScreen(<WeatherLocationPrompt.Denied onOpenSettings={onOpenSettings} />);

    // When
    fireEvent.press(screen.getByRole('button', { name: '설정 열기' }));

    // Then
    expect(screen.getByText('설정에서 위치를 켜주세요')).toBeOnTheScreen();
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
