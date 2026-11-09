import { RELEASE_1_15_0_STEPS } from '../constants/release-1-15-0.constants';
import { findNextStep, getChapterStartStep, getStepPosition } from './release-1-15-0-steps';

describe('findNextStep', () => {
  it('소개 다음은 말로 할 일 만들기의 말하기 장면이다', () => {
    // Given
    const step = 'intro';

    // When
    const next = findNextStep(step);

    // Then
    expect(next).toBe('voiceTodoCapture');
  });

  it('말로 할 일 만들기를 다 보면 말로 메모하기로 이어진다', () => {
    // Given
    const step = 'voiceTodoList';

    // When
    const next = findNextStep(step);

    // Then
    expect(next).toBe('voiceNoteRecord');
  });

  it('마무리 다음 단계는 없다', () => {
    // Given
    const step = 'finish';

    // When
    const next = findNextStep(step);

    // Then
    expect(next).toBeNull();
  });

  it('다음을 이어 누르면 모든 단계를 한 번씩 지나 마무리에 닿는다', () => {
    // Given
    const visited: string[] = ['intro'];

    // When
    for (let next = findNextStep('intro'); next != null; next = findNextStep(next)) {
      visited.push(next);
    }

    // Then
    expect(visited).toEqual([...RELEASE_1_15_0_STEPS]);
  });
});

describe('getChapterStartStep', () => {
  it.each([
    ['voiceTodo', 'voiceTodoCapture'],
    ['voiceNote', 'voiceNoteRecord'],
  ] as const)('소개에서 %s 카드를 고르면 그 기능의 첫 장면(%s)으로 간다', (chapter, expected) => {
    // When
    const step = getChapterStartStep(chapter);

    // Then
    expect(step).toBe(expected);
  });
});

describe('getStepPosition', () => {
  it('소개에서 말로 메모하기로 건너뛰어도 진행 점은 흐름 안의 자리를 가리킨다', () => {
    // Given
    const jumpedStep = getChapterStartStep('voiceNote');

    // When
    const position = getStepPosition(jumpedStep);

    // Then
    expect(position).toBe(4);
  });
});
