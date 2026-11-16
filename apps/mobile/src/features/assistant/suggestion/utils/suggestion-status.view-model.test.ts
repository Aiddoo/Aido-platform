import {
  createSuggestionAnalysisDto,
  createSuggestionDto,
  createSuggestionListDto,
} from '../__tests__/suggestion.fixtures';
import { toAiSuggestionList } from '../apis/suggestion.mapper';
import { getSuggestionDisplayState } from './suggestion-status.view-model';

describe('getSuggestionDisplayState', () => {
  it.each([
    {
      case: '대기 제안이 있으면 서버 상태와 무관하게',
      state: 'ANALYZING',
      expected: 'HAS_SUGGESTIONS',
    },
    { case: '대기 제안이 있고 상태를 몰라도', state: 'UNKNOWN', expected: 'HAS_SUGGESTIONS' },
  ] as const)('$case 제안 목록을 보인다', ({ state, expected }) => {
    // Given
    const list = toAiSuggestionList(
      createSuggestionListDto({
        suggestions: [createSuggestionDto()],
        analysis: createSuggestionAnalysisDto({ state }),
      }),
    );

    // When
    const result = getSuggestionDisplayState(list);

    // Then
    expect(result).toBe(expected);
  });

  it('분석 상태를 모르면 다음 분석을 기다리는 상태로 그린다', () => {
    // Given
    const list = toAiSuggestionList(
      createSuggestionListDto({
        suggestions: [],
        analysis: createSuggestionAnalysisDto({ state: 'UNKNOWN' }),
      }),
    );

    // When
    const result = getSuggestionDisplayState(list);

    // Then
    expect(result).toBe('WAITING_FOR_NEXT_RUN');
  });

  it('분석 정보가 없으면 다음 분석을 기다리는 상태로 그린다', () => {
    // Given
    const list = toAiSuggestionList(
      createSuggestionListDto({ suggestions: [], analysis: undefined }),
    );

    // When
    const result = getSuggestionDisplayState(list);

    // Then
    expect(result).toBe('WAITING_FOR_NEXT_RUN');
  });

  it.each([
    'NEEDS_AI_CONSENT',
    'NEEDS_MORE_TODOS',
    'ANALYZING',
    'DONE_FOR_TODAY',
    'NO_PATTERN_FOUND',
    'UNAVAILABLE_TODAY',
    'WAITING_FOR_NEXT_RUN',
  ] as const)('제안이 없으면 서버 상태 %s를 그대로 따른다', (state) => {
    // Given
    const list = toAiSuggestionList(
      createSuggestionListDto({
        suggestions: [],
        analysis: createSuggestionAnalysisDto({ state }),
      }),
    );

    // When
    const result = getSuggestionDisplayState(list);

    // Then
    expect(result).toBe(state);
  });
});
