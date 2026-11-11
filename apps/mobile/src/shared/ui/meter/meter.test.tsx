import { renderScreen } from '@src/testing/render';
import { screen } from '@testing-library/react-native';

import { Meter } from './meter';

describe('Meter', () => {
  it.each([
    ['쓴 만큼', 3, 10, 30, 3],
    ['넘치면 가득', 12, 10, 100, 10],
    ['최댓값이 0이면 빈', 0, 0, 0, 0],
  ])('%s 막대로 그리고 읽어 준다', async (_case, value, max, widthPercent, now) => {
    // When
    await renderScreen(<Meter value={value} max={max} />);

    // Then
    const meter = screen.getByRole('progressbar');
    expect(meter.props.accessibilityValue).toEqual({ min: 0, max, now });
    expect(meter.children[0]).toHaveStyle({ width: `${widthPercent}%` });
  });
});
