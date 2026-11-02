import catImage from '@assets/images/cat_weather_anchor.png';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { fireEvent, screen } from '@testing-library/react-native';

import { WeatherMascot } from './weather-mascot';

describe('WeatherMascot', () => {
  it('고양이 이미지를 불러오지 못하면 같은 자리에 날씨 아이콘을 그린다', async () => {
    // Given
    await renderUi(
      <WeatherMascot source={catImage} fallbackCondition="RAIN" className="size-12" />,
    );

    // When
    await fireEvent(screen.getByTestId('weather-mascot'), 'error', {
      nativeEvent: { error: 'not found' },
    });

    // Then
    expect(screen.getByTestId('weather-mascot-fallback')).toBeTruthy();
    expect(screen.queryByTestId('weather-mascot')).toBeNull();
  });
});
