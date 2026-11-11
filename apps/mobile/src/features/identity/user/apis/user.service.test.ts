import { createHttpClientStub } from '@src/testing/core';

import {
  createCurrentUserDto,
  createUpdateProfileDto,
  createUserApiError,
  INVALID_DTO,
} from '../__tests__/user.fixtures';
import { UserService } from './user.service';

describe('UserService', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;
  let service: UserService;

  beforeEach(() => {
    httpClient = createHttpClientStub();
    service = new UserService(httpClient);
  });

  describe('getCurrentUser', () => {
    it('서버 응답이 성공하면 userId가 id로 매핑된 User 반환', async () => {
      // Given
      const dto = createCurrentUserDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getCurrentUser();

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/auth/me', { signal: undefined });
      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({
          id: dto.userId,
          email: dto.email,
          name: dto.name,
          createdAt: expect.any(String),
        }),
      });
    });

    it('name/profileImage null → null 매핑', async () => {
      // Given
      const dto = createCurrentUserDto({ name: null, profileImage: null });
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getCurrentUser();

      // Then
      expect(result).toMatchObject({ ok: true, value: { name: null, profileImage: null } });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createUserApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getCurrentUser();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.getCurrentUser();

      // Then
      await expect(result).rejects.toThrow('Invalid getCurrentUser response');
    });

    it('프리미엄 효력·권한이 빠진 응답 → ParseError throw', async () => {
      // Given
      const { isPremium: _isPremium, entitlements: _entitlements, ...dto } = createCurrentUserDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = service.getCurrentUser();

      // Then
      await expect(result).rejects.toThrow('Invalid getCurrentUser response');
    });
  });

  describe('updateProfile', () => {
    const input = { name: '새이름' };

    it('서버 응답이 성공하면 name, profileImage만 반환 (message 제외)', async () => {
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

    it('name null → null 반환', async () => {
      // Given
      const dto = createUpdateProfileDto({ name: null });
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.updateProfile(input);

      // Then
      expect(result).toMatchObject({ ok: true, value: { name: null } });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createUserApiError({ code: 'FORBIDDEN', status: 403 });
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.updateProfile(input);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.patch.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.updateProfile(input);

      // Then
      await expect(result).rejects.toThrow('Invalid updateProfile response');
    });
  });
});
