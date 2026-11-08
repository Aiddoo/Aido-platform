import { createPreferenceDto } from '../__tests__/preference.fixtures';
import { preferenceSchema } from '../domains/preference.model';
import { toPreference } from './preference.mapper';

describe('toPreference', () => {
  it('서버 응답을 앱 모델로 바꾸고 기기가 정하는 시간대는 뺀다', () => {
    // Given
    const dto = createPreferenceDto({ timezone: 'America/New_York', pushEnabled: false });

    // When
    const result = toPreference(dto);

    // Then
    expect(preferenceSchema.parse(result)).toEqual(result);
    expect(result).not.toHaveProperty('timezone');
    expect(result.pushEnabled).toBe(false);
    expect(result.morningReminderHour).toBe(dto.morningReminderHour);
  });
});
