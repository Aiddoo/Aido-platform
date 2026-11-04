import '@src/shared/i18n/init';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { fireEvent, screen } from '@testing-library/react-native';

import { createVoiceNoteDigest } from '../../__tests__/voice-note.factories';
import { KeyPointList } from './key-point-list';

describe('KeyPointList', () => {
  it('핵심 포인트를 누르면 그 포인트를 알려 그 지점부터 듣게 한다', async () => {
    // Given
    const { keyPoints } = createVoiceNoteDigest();
    const onPressKeyPoint = jest.fn();
    await renderUi(<KeyPointList keyPoints={keyPoints} onPressKeyPoint={onPressKeyPoint} />);

    // When
    fireEvent.press(screen.getByLabelText('0:41부터 듣기'));

    // Then
    expect(onPressKeyPoint).toHaveBeenCalledWith(keyPoints[1]);
  });

  it('재생 중인 포인트만 선택된 상태로 알린다', async () => {
    // Given
    const { keyPoints } = createVoiceNoteDigest();

    // When
    await renderUi(
      <KeyPointList
        keyPoints={keyPoints}
        activeKeyPointId="key-point-2"
        onPressKeyPoint={jest.fn()}
      />,
    );

    // Then
    expect(screen.getByLabelText('0:41부터 듣기')).toBeSelected();
    expect(screen.getByLabelText('0:12부터 듣기')).not.toBeSelected();
  });

  it('들을 녹음이 없으면 포인트를 눌러 재생할 수 없다', async () => {
    // Given
    const { keyPoints } = createVoiceNoteDigest();

    // When
    await renderUi(<KeyPointList keyPoints={keyPoints} />);

    // Then
    expect(screen.queryByLabelText('0:41부터 듣기')).toBeNull();
    expect(screen.getByText('디자인 시안 2개')).toBeTruthy();
  });
});
