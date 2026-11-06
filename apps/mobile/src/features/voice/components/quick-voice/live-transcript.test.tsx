import { renderUi } from '@src/shared/__tests__/render-ui';
import { screen } from '@testing-library/react-native';
import { range } from 'es-toolkit';

import { createVoiceTranscript } from '../../domains/voice-transcript.model';
import { LiveTranscript } from './live-transcript';

describe('LiveTranscript', () => {
  it('확정된 글자와 인식 중인 꼬리를 단어마다 따로 그려 음절 사이에서 끊기지 않게 한다', async () => {
    // Given
    const transcript = createVoiceTranscript({
      sentences: ['보고서 쓰기'],
      interim: '그리고 일기',
    });

    // When
    await renderUi(<LiveTranscript transcript={transcript} />);

    // Then
    for (const word of ['보고서 ', '쓰기 ', '그리고 ', '일기 ']) {
      expect(screen.getByText(word)).toBeTruthy();
    }
  });

  it('단어가 많아 등장 효과를 끄는 긴 글도 단어마다 따로 그린다', async () => {
    // Given
    const words = range(41).map((index) => `단어${index}`);
    const transcript = createVoiceTranscript({ sentences: [words.join(' ')] });

    // When
    await renderUi(<LiveTranscript transcript={transcript} />);

    // Then
    expect(screen.getByText('단어40 ')).toBeTruthy();
  });
});
