import {
  createAuthApiError,
  INVALID_DTO,
} from '@src/features/identity/auth/__tests__/auth.fixtures';
import { createHttpClientStub } from '@src/shared/__tests__';
import { toInstant } from '@src/shared/date/instant';

import { createConsentDto, createUpdateMarketingConsentDto } from '../__tests__/consent.fixtures';
import { ConsentService } from './consent.service';

describe('ConsentService', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;
  let service: ConsentService;

  beforeEach(() => {
    httpClient = createHttpClientStub();
    service = new ConsentService(httpClient);
  });

  // ── getConsent ──────────────────────────────

  describe('getConsent', () => {
    test('정상 응답 → ISO 문자열을 Instant로 변환', async () => {
      // Given
      const termsAgreedAt = '2026-01-01T00:00:00.000Z';
      const privacyAgreedAt = '2026-01-01T00:00:00.000Z';
      const marketingAgreedAt = '2026-02-01T00:00:00.000Z';
      const dto = createConsentDto({ termsAgreedAt, privacyAgreedAt, marketingAgreedAt });
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getConsent();

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/auth/consent', { signal: undefined });
      expect(result).toEqual({
        ok: true,
        value: {
          termsAgreedAt: toInstant(termsAgreedAt),
          privacyAgreedAt: toInstant(privacyAgreedAt),
          agreedTermsVersion: dto.agreedTermsVersion,
          marketingAgreedAt: toInstant(marketingAgreedAt),
          marketingPushAgreedAt: null,
          aiDataSharingDecision: 'UNDECIDED',
          aiDataSharingAgreedAt: null,
          aiDataSharingConsentVersion: null,
        },
      });
    });

    test('marketingAgreedAt null → null 유지', async () => {
      // Given
      const dto = createConsentDto({ marketingAgreedAt: null });
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getConsent();

      // Then
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.marketingAgreedAt).toBeNull();
      }
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getConsent();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.getConsent()).rejects.toThrow('Invalid getConsent response');
    });
  });

  // ── updateMarketingConsent ──────────────────

  describe('updateMarketingConsent', () => {
    test('동의 → ISO를 Instant로 변환', async () => {
      // Given
      const marketingAgreedAt = '2026-02-01T00:00:00.000Z';
      const dto = createUpdateMarketingConsentDto({ marketingAgreedAt });
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.updateMarketingConsent({ agreed: true });

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/auth/consent/marketing', {
        agreed: true,
      });
      expect(result).toEqual({
        ok: true,
        value: { marketingAgreedAt: toInstant(marketingAgreedAt) },
      });
    });

    test('철회 → marketingAgreedAt null', async () => {
      // Given
      const dto = createUpdateMarketingConsentDto({ marketingAgreedAt: null });
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.updateMarketingConsent({ agreed: false });

      // Then
      expect(result).toEqual({ ok: true, value: { marketingAgreedAt: null } });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.updateMarketingConsent({ agreed: false });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.patch.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.updateMarketingConsent({ agreed: true })).rejects.toThrow(
        'Invalid updateMarketingConsent response',
      );
    });
  });
});
