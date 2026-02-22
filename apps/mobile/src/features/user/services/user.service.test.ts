import type { CurrentUser, UpdateProfileResponse } from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';

import { UserService } from './user.service';

// -- Fixtures --

const validCurrentUser: CurrentUser = {
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  email: 'test@example.com',
  sessionId: 'clz7x5p8k0002qz0z8z8z8z8z',
  userTag: 'TEST2025',
  role: 'USER',
  status: 'ACTIVE',
  emailVerifiedAt: '2026-01-15T10:30:00.000Z',
  subscriptionStatus: 'ACTIVE',
  subscriptionExpiresAt: null,
  name: '테스트',
  profileImage: null,
  createdAt: '2026-01-01T09:00:00.000Z',
  providers: ['CREDENTIAL'],
};

const validUpdateProfileResponse: UpdateProfileResponse = {
  message: '프로필이 수정되었습니다.',
  name: '새이름',
  profileImage: 'https://example.com/new.jpg',
};

// -- Mock helpers --

const createMockHttpClient = (): HttpClient => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
});

const mockResolvedGet = (client: HttpClient, value: unknown) => {
  (client.get as jest.Mock).mockResolvedValue(value);
};

const mockResolvedPatch = (client: HttpClient, value: unknown) => {
  (client.patch as jest.Mock).mockResolvedValue(value);
};

describe('UserService', () => {
  let httpClient: HttpClient;
  let service: UserService;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    service = new UserService(httpClient);
  });

  // -- getCurrentUser --

  describe('getCurrentUser', () => {
    test('정상 응답 시 도메인 모델로 변환한다', async () => {
      // Given
      mockResolvedGet(httpClient, { ok: true, value: validCurrentUser });

      // When
      const result = await service.getCurrentUser();

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/auth/me');
      expect(result).toEqual({
        ok: true,
        value: {
          id: 'clz7x5p8k0001qz0z8z8z8z8z',
          email: 'test@example.com',
          name: '테스트',
          profileImage: null,
          userTag: 'TEST2025',
          subscriptionStatus: 'ACTIVE',
          createdAt: new Date('2026-01-01T09:00:00.000Z'),
          providers: ['CREDENTIAL'],
        },
      });
    });

    test('name이 null이면 null 그대로 전달한다', async () => {
      // Given
      mockResolvedGet(httpClient, { ok: true, value: { ...validCurrentUser, name: null } });

      // When
      const result = await service.getCurrentUser();

      // Then
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBeNull();
      }
    });

    test('HTTP 에러 시 Result.err를 반환한다', async () => {
      // Given
      const apiError = new ApiError('USER_NOT_FOUND', '사용자를 찾을 수 없습니다', 404);
      mockResolvedGet(httpClient, { ok: false, error: apiError });

      // When
      const result = await service.getCurrentUser();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 시 ParseError를 throw한다', async () => {
      // Given
      mockResolvedGet(httpClient, { ok: true, value: { invalid: 'data' } });

      // When & Then
      await expect(service.getCurrentUser()).rejects.toThrow(ParseError);
    });
  });

  // -- updateProfile --

  describe('updateProfile', () => {
    test('정상 응답 시 UpdateProfileResult를 반환한다', async () => {
      // Given
      mockResolvedPatch(httpClient, { ok: true, value: validUpdateProfileResponse });
      const input = { name: '새이름' };

      // When
      const result = await service.updateProfile(input);

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/auth/profile', input);
      expect(result).toEqual({
        ok: true,
        value: {
          name: '새이름',
          profileImage: 'https://example.com/new.jpg',
        },
      });
    });

    test('name이 null이면 null 그대로 전달한다', async () => {
      // Given
      mockResolvedPatch(httpClient, {
        ok: true,
        value: { ...validUpdateProfileResponse, name: null },
      });

      // When
      const result = await service.updateProfile({ profileImage: null });

      // Then
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBeNull();
      }
    });

    test('HTTP 에러 시 Result.err를 반환한다', async () => {
      // Given
      const apiError = new ApiError('INVALID_PARAMETER', '잘못된 입력', 400);
      mockResolvedPatch(httpClient, { ok: false, error: apiError });

      // When
      const result = await service.updateProfile({ name: '' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 시 ParseError를 throw한다', async () => {
      // Given
      mockResolvedPatch(httpClient, { ok: true, value: { invalid: 'data' } });

      // When & Then
      await expect(service.updateProfile({ name: 'test' })).rejects.toThrow(ParseError);
    });
  });
});
