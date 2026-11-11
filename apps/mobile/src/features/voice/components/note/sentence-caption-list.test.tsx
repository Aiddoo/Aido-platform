import '@src/shared/i18n/init';
import { renderScreen } from '@src/testing/render';
import { screen } from '@testing-library/react-native';

import { createVoiceNoteSentence } from '../../__tests__/voice-note.fixtures';
import { SentenceCaptionList } from './sentence-caption-list';

describe('SentenceCaptionList', () => {
  it('신뢰도 낮은 단어에 밑줄을 치고 무슨 뜻인지 알려 준다', async () => {
    // Given
    const sentence = createVoiceNoteSentence({
      text: '시안 두 개',
      lowConfidenceWords: ['시안'],
    });

    // When
    await renderScreen(<SentenceCaptionList sentences={[sentence]} />);

    // Then
    expect(screen.getByTestId('caption-low-confidence-hint')).toHaveTextContent(
      '밑줄은 잘못 들었을 수 있는 말이에요',
    );
    expect(screen.getByTestId('caption-low-confidence-word')).toHaveTextContent('시안');
  });

  it('신뢰도 값이 없는 문장은 밑줄도 안내도 없다', async () => {
    // Given
    const sentence = createVoiceNoteSentence({ text: '시안 두 개' });

    // When
    await renderScreen(<SentenceCaptionList sentences={[sentence]} />);

    // Then
    expect(screen.queryByTestId('caption-low-confidence-hint')).toBeNull();
    expect(screen.queryByTestId('caption-low-confidence-word')).toBeNull();
  });
});
