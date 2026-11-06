import { createMockHttpClient } from '@src/shared/__tests__';

import {
  createPreferenceApiError,
  createPreferenceDto,
  INVALID_DTO,
} from '../__tests__/preference.factories';
import { PreferenceService } from './preference.service';

describe('PreferenceService', () => {
  let httpClient: ReturnType<typeof createMockHttpClient>;
  let service: PreferenceService;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    service = new PreferenceService(httpClient);
  });

  describe('getPreference', () => {
    test('정상 응답 → pushEnabled, nightPushEnabled만 추출', async () => {
      // Given
      const dto = createPreferenceDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getPreference();

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/auth/preference', { signal: undefined });
      expect(result).toEqual({
        ok: true,
        value: {
          pushEnabled: dto.pushEnabled,
          nightPushEnabled: dto.nightPushEnabled,
          morningReminderHour: dto.morningReminderHour,
          morningReminderMinute: dto.morningReminderMinute,
          eveningReminderHour: dto.eveningReminderHour,
          eveningReminderMinute: dto.eveningReminderMinute,
          timeFormat: dto.timeFormat,
          weatherMorningEnabled: dto.weatherMorningEnabled,
          weatherMorningHour: dto.weatherMorningHour,
          weatherMorningMinute: dto.weatherMorningMinute,
          weatherEveningEnabled: dto.weatherEveningEnabled,
          weatherEveningHour: dto.weatherEveningHour,
          weatherEveningMinute: dto.weatherEveningMinute,
        },
      });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createPreferenceApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getPreference();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.getPreference()).rejects.toThrow('Invalid getPreference response');
    });
  });

  describe('updatePreference', () => {
    test('정상 응답 → 도메인 모델 반환', async () => {
      // Given
      const dto = createPreferenceDto();
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });
      const input = { pushEnabled: false };

      // When
      const result = await service.updatePreference(input);

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/auth/preference', input);
      expect(result).toEqual({
        ok: true,
        value: {
          pushEnabled: dto.pushEnabled,
          nightPushEnabled: dto.nightPushEnabled,
          morningReminderHour: dto.morningReminderHour,
          morningReminderMinute: dto.morningReminderMinute,
          eveningReminderHour: dto.eveningReminderHour,
          eveningReminderMinute: dto.eveningReminderMinute,
          timeFormat: dto.timeFormat,
          weatherMorningEnabled: dto.weatherMorningEnabled,
          weatherMorningHour: dto.weatherMorningHour,
          weatherMorningMinute: dto.weatherMorningMinute,
          weatherEveningEnabled: dto.weatherEveningEnabled,
          weatherEveningHour: dto.weatherEveningHour,
          weatherEveningMinute: dto.weatherEveningMinute,
        },
      });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createPreferenceApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.updatePreference({ pushEnabled: true });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.patch.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.updatePreference({ pushEnabled: true })).rejects.toThrow(
        'Invalid updatePreference response',
      );
    });
  });
});
