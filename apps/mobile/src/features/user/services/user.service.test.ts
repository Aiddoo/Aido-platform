import { createMockHttpClient } from '@src/shared/__tests__';
import {
  createCurrentUserDto,
  createUpdateProfileDto,
  createUserApiError,
  INVALID_DTO,
} from '../__tests__/user.factories';
import { UserService } from './user.service';

describe('UserService', () => {
  let httpClient: ReturnType<typeof createMockHttpClient>;
  let service: UserService;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    service = new UserService(httpClient);
  });

  // ── getCurrentUser ─────────────────────────

  describe('getCurrentUser', () => {
    test('정상 응답 → userId가 id로 매핑된 User 반환', async () => {
      // Given
      const dto = createCurrentUserDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getCurrentUser();

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/auth/me');
      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({
          id: dto.userId,
          email: dto.email,
          name: dto.name,
          createdAt: expect.any(Date),
        }),
      });
    });

    test('name/profileImage null → null 매핑', async () => {
      // Given
      const dto = createCurrentUserDto({ name: null, profileImage: null });
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getCurrentUser();

      // Then
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBeNull();
        expect(result.value.profileImage).toBeNull();
      }
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createUserApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getCurrentUser();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.getCurrentUser()).rejects.toThrow('Invalid getCurrentUser response');
    });
  });

  // ── updateProfile ──────────────────────────

  describe('updateProfile', () => {
    const input = { name: '새이름' };

    test('정상 응답 → name, profileImage만 반환 (message 제외)', async () => {
      // Given
      const dto = createUpdateProfileDto();
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.updateProfile(input);

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/auth/profile', input);
      expect(result).toEqual({
        ok: true,
        value: { name: dto.name, profileImage: dto.profileImage },
      });
    });

    test('name null → null 반환', async () => {
      // Given
      const dto = createUpdateProfileDto({ name: null });
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.updateProfile(input);

      // Then
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBeNull();
      }
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createUserApiError({ code: 'FORBIDDEN', status: 403 });
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.updateProfile(input);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.patch.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.updateProfile(input)).rejects.toThrow('Invalid updateProfile response');
    });
  });
});
