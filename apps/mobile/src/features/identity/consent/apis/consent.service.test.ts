import {
  createAuthApiError,
  INVALID_DTO,
} from '@src/features/identity/auth/__tests__/auth.fixtures';
import { toInstant } from '@src/shared/date/instant';
import { createHttpClientStub } from '@src/testing/core';

import { createConsentDto, createUpdateMarketingConsentDto } from '../__tests__/consent.fixtures';
import { ConsentService } from './consent.service';

describe('ConsentService', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;
  let service: ConsentService;

  beforeEach(() => {
    httpClient = createHttpClientStub();
    service = new ConsentService(httpClient);
  });

  describe('getConsent', () => {
    it('서버 응답이 성공하면 ISO 문자열을 Instant로 변환', async () => {
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

    it('marketingAgreedAt null → null 유지', async () => {
      // Given
      const dto = createConsentDto({ marketingAgreedAt: null });
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getConsent();

      // Then
      expect(result).toMatchObject({ ok: true, value: { marketingAgreedAt: null } });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getConsent();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.getConsent();

      // Then
      await expect(result).rejects.toThrow('Invalid getConsent response');
    });
  });

  describe('updateMarketingConsent', () => {
    it('동의 → ISO를 Instant로 변환', async () => {
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
        value: { marketingAgreedAt: toInstant(marketingAgreedAt), marketingWithdrawnAt: null },
      });
    });

    it('철회 → marketingAgreedAt null, 서버가 처리한 철회 시각을 Instant로 변환', async () => {
      // Given
      const dto = createUpdateMarketingConsentDto({
        marketingAgreedAt: null,
        marketingWithdrawnAt: '2026-03-02T12:00:00.000Z',
      });
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.updateMarketingConsent({ agreed: false });

      // Then
      expect(result).toEqual({
        ok: true,
        value: {
          marketingAgreedAt: null,
          marketingWithdrawnAt: toInstant('2026-03-02T12:00:00.000Z'),
        },
      });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.updateMarketingConsent({ agreed: false });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.patch.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.updateMarketingConsent({ agreed: true });

      // Then
      await expect(result).rejects.toThrow('Invalid updateMarketingConsent response');
    });
  });
});
