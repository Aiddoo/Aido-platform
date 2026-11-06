import '@src/shared/i18n/init';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { screen } from '@testing-library/react-native';

import { getRecordingRingLayout } from '../../utils/recording-timer.geometry';
import { RecordingTimer } from './recording-timer';

describe('RecordingTimer', () => {
  test('글자 칸을 링 안쪽 폭으로 고정해 글자가 커져도 한 줄로 줄어든다', async () => {
    // When
    await renderUi(<RecordingTimer elapsedMs={65_000} limitMs={180_000} />);

    // Then
    const time = screen.getByText('1:05');
    expect(time.props.numberOfLines).toBe(1);
    expect(time.props.adjustsFontSizeToFit).toBe(true);
    expect(time.props.style).toMatchObject({
      width: getRecordingRingLayout(1334).textWidth,
    });
    expect(screen.getByText('1:55 남음').props.adjustsFontSizeToFit).toBe(true);
  });

  test('시작하기 전에는 차오른 호를 그리지 않는다', async () => {
    // When
    await renderUi(<RecordingTimer elapsedMs={0} limitMs={180_000} />);

    // Then
    expect(screen.queryByTestId('recording-timer-progress')).toBeNull();
  });

  test('녹음 시간에 맞게 호가 차오른다', async () => {
    // When
    await renderUi(<RecordingTimer elapsedMs={90_000} limitMs={180_000} />);

    // Then
    const { circumference } = getRecordingRingLayout(1334);
    const arc = screen.getByTestId('recording-timer-progress');
    expect(arc.props.strokeDasharray).toEqual([circumference / 2, circumference]);
  });
});
