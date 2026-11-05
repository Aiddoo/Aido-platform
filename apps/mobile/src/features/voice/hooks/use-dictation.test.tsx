import '@src/shared/i18n/init';
import { createSpeechRecognizerStub } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { Text } from '@src/shared/ui';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { useDictation } from './use-dictation';

function DictationProbe({ onEnd }: { onEnd?: () => void }) {
  const [title, setTitle] = useState('');
  const { start, stop } = useDictation({ onResult: setTitle, onEnd });

  return (
    <>
      <Pressable testID="mic" onPress={start} />
      <Pressable testID="stop" onPress={stop} />
      <Text testID="title">{title}</Text>
    </>
  );
}

describe('useDictation', () => {
  test('내가 시작한 받아쓰기 결과만 입력에 넣는다', async () => {
    // Given
    const speechRecognizer = createSpeechRecognizerStub();
    await renderUi(
      <OverlayProvider>
        <DictationProbe />
      </OverlayProvider>,
      { di: { speechRecognizer } },
    );
    await act(async () =>
      speechRecognizer.emit({
        type: 'result',
        transcript: '남의 결과',
        isFinal: true,
        segments: [],
      }),
    );

    // When
    await fireEvent.press(screen.getByTestId('mic'));
    await act(async () =>
      speechRecognizer.emit({ type: 'result', transcript: '장보기', isFinal: true, segments: [] }),
    );

    // Then
    expect(speechRecognizer.start).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'dictation' }),
    );
    expect(screen.getByTestId('title')).toHaveTextContent('장보기');
  });

  test('직접 멈춘 뒤 인식기가 client로 답해도 오류를 띄우지 않고 정상으로 끝낸다', async () => {
    // Given
    const speechRecognizer = createSpeechRecognizerStub();
    const onEnd = jest.fn();
    await renderUi(
      <OverlayProvider>
        <DictationProbe onEnd={onEnd} />
      </OverlayProvider>,
      { di: { speechRecognizer } },
    );
    await fireEvent.press(screen.getByTestId('mic'));
    await act(async () => speechRecognizer.emit({ type: 'start' }));

    // When
    await fireEvent.press(screen.getByTestId('stop'));
    await act(async () => speechRecognizer.emit({ type: 'error', code: 'client' }));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('멈추지 않았는데 오는 client는 실패라 정상 종료로 알리지 않는다', async () => {
    // Given
    const speechRecognizer = createSpeechRecognizerStub();
    const onEnd = jest.fn();
    await renderUi(
      <OverlayProvider>
        <DictationProbe onEnd={onEnd} />
      </OverlayProvider>,
      { di: { speechRecognizer } },
    );
    await fireEvent.press(screen.getByTestId('mic'));
    await act(async () => speechRecognizer.emit({ type: 'start' }));

    // When
    await act(async () => speechRecognizer.emit({ type: 'error', code: 'client' }));
    await act(async () => speechRecognizer.emit({ type: 'end' }));

    // Then
    expect(onEnd).not.toHaveBeenCalled();
  });

  test('화면이 내려가면 듣던 세션을 끊고 구독을 푼다', async () => {
    // Given
    const speechRecognizer = createSpeechRecognizerStub();
    const { unmount } = await renderUi(
      <OverlayProvider>
        <DictationProbe />
      </OverlayProvider>,
      { di: { speechRecognizer } },
    );
    await fireEvent.press(screen.getByTestId('mic'));

    // When
    await act(async () => unmount());

    // Then
    expect(speechRecognizer.abort).toHaveBeenCalledTimes(1);
    expect(speechRecognizer.getListenerCount()).toBe(0);
  });
});
