import { createMockHttpClient } from '@src/shared/__tests__';

import {
  createAcceptFriendRequestDto,
  createFriendApiError,
  createFriendsListDto,
  createReceivedRequestsDto,
  createReorderFriendDto,
  createSearchUsersDto,
  createSendFriendRequestDto,
  createSentRequestsDto,
  INVALID_DTO,
} from '../__tests__/friend.factories';
import { isFriendError } from '../models/friend.error';
import { FriendService } from './friend.service';

describe('FriendService', () => {
  let httpClient: ReturnType<typeof createMockHttpClient>;
  let service: FriendService;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    service = new FriendService(httpClient);
  });

  // ── sendRequestByTag ─────────────────────────

  describe('sendRequestByTag', () => {
    test('빈 문자열 → FriendError.EMPTY_TAG', async () => {
      // Given & When
      const result = await service.sendRequestByTag('  ');

      // Then
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(isFriendError(result.error)).toBe(true);
        expect(result.error.code).toBe('FRIEND_EMPTY_TAG');
      }
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    test('잘못된 형식 → FriendError.INVALID_TAG', async () => {
      // Given & When
      const result = await service.sendRequestByTag('abc');

      // Then
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(isFriendError(result.error)).toBe(true);
        expect(result.error.code).toBe('FRIEND_INVALID_TAG');
      }
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    test('정상 태그 → SendRequestResult 반환', async () => {
      // Given
      const dto = createSendFriendRequestDto();
      httpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.sendRequestByTag('ABCD1234');

      // Then
      expect(httpClient.post).toHaveBeenCalledWith('v1/follows/ABCD1234');
      expect(result).toEqual({
        ok: true,
        value: { autoAccepted: dto.autoAccepted },
      });
    });

    test('자기 자신에게 요청 → FOLLOW_0901 에러', async () => {
      // Given
      const apiError = createFriendApiError({ code: 'FOLLOW_0901' });
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.sendRequestByTag('ABCD1234');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('이미 친구 → FOLLOW_0902 에러', async () => {
      // Given
      const apiError = createFriendApiError({
        code: 'FOLLOW_0902',
        message: '이미 친구인 사용자에요',
      });
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.sendRequestByTag('ABCD1234');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('프리미엄 한도 → FOLLOW_0909 에러', async () => {
      // Given
      const apiError = createFriendApiError({
        code: 'FOLLOW_0909',
        message: '친구 수 한도에 도달했어요',
      });
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.sendRequestByTag('ABCD1234');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.sendRequestByTag('ABCD1234')).rejects.toThrow(
        'Invalid sendRequest response',
      );
    });
  });

  // ── getFriends ───────────────────────────────

  describe('getFriends', () => {
    test('정상 응답 → Page<FriendUser> 반환', async () => {
      // Given
      const dto = createFriendsListDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getFriends({ cursor: 'c1', limit: 10 });

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/follows/friends', {
        params: { cursor: 'c1', limit: 10 },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(2);
        expect(result.value.items[0]?.friendsSince).toBeInstanceOf(Date);
      }
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createFriendApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getFriends();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.getFriends()).rejects.toThrow('Invalid getFriends response');
    });
  });

  // ── getReceivedRequests ──────────────────────

  describe('getReceivedRequests', () => {
    test('정상 응답 → Page<FriendRequest> 반환', async () => {
      // Given
      const dto = createReceivedRequestsDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getReceivedRequests();

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/follows/requests/received', {
        params: { cursor: undefined, limit: undefined },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0]?.requestedAt).toBeInstanceOf(Date);
      }
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createFriendApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getReceivedRequests();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.getReceivedRequests()).rejects.toThrow(
        'Invalid getReceivedRequests response',
      );
    });
  });

  // ── getSentRequests ──────────────────────────

  describe('getSentRequests', () => {
    test('정상 응답 → Page<FriendRequest> 반환', async () => {
      // Given
      const dto = createSentRequestsDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getSentRequests({ cursor: 'c1', limit: 10 });

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/follows/requests/sent', {
        params: { cursor: 'c1', limit: 10 },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0]?.requestedAt).toBeInstanceOf(Date);
      }
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createFriendApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getSentRequests();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.getSentRequests()).rejects.toThrow('Invalid getSentRequests response');
    });
  });

  // ── acceptRequest ────────────────────────────

  describe('acceptRequest', () => {
    test('정상 응답 → void 반환', async () => {
      // Given
      const dto = createAcceptFriendRequestDto();
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.acceptRequest('user-1');

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/follows/user-1/accept');
      expect(result).toEqual({ ok: true, value: undefined });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createFriendApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.acceptRequest('user-1');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  // ── removeFriend ─────────────────────────────

  describe('removeFriend', () => {
    test('정상 응답 → void 반환', async () => {
      // Given
      httpClient.delete.mockResolvedValue({
        ok: true,
        value: { message: '친구를 삭제했어요.' },
      });

      // When
      const result = await service.removeFriend('user-1');

      // Then
      expect(httpClient.delete).toHaveBeenCalledWith('v1/follows/user-1');
      expect(result).toEqual({ ok: true, value: undefined });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createFriendApiError();
      httpClient.delete.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.removeFriend('user-1');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  // ── reorderFriend ──────────────────────────

  describe('reorderFriend', () => {
    test('정상 응답 → FriendUser 반환', async () => {
      // Given
      const dto = createReorderFriendDto();
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.reorderFriend('follow-1', {
        targetFollowId: 'follow-2',
        position: 'after',
      });

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/follows/friends/follow-1/reorder', {
        targetFollowId: 'follow-2',
        position: 'after',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.followId).toBe(dto.friend.followId);
        expect(result.value.friendsSince).toBeInstanceOf(Date);
      }
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createFriendApiError({ code: 'FOLLOW_0910', status: 404 });
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.reorderFriend('follow-1', { position: 'before' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.patch.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.reorderFriend('follow-1', { position: 'before' })).rejects.toThrow(
        'Invalid reorderFriend response',
      );
    });
  });

  // ── searchUsers ─────────────────────────

  describe('searchUsers', () => {
    test('2자 미만 검색어 → FriendError, HTTP 미호출', async () => {
      // Given & When
      const result = await service.searchUsers({ query: ' a ' });

      // Then
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(isFriendError(result.error)).toBe(true);
        expect(result.error.code).toBe('FRIEND_SEARCH_QUERY_TOO_SHORT');
      }
      expect(httpClient.get).not.toHaveBeenCalled();
    });

    test('정상 검색어 → trim된 q/cursor/limit로 GET 호출 후 Page 반환', async () => {
      // Given
      const dto = createSearchUsersDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.searchUsers({ query: '  홍길동  ', cursor: 'c1', limit: 20 });

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/follows/search', {
        params: { q: '홍길동', cursor: 'c1', limit: 20 },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(4);
        expect(result.value.nextCursor).toBeNull();
        // 동명이인 2명이 태그로 구분됨
        const hongs = result.value.items.filter((u) => u.name === '홍길동');
        expect(hongs).toHaveLength(2);
        expect(new Set(hongs.map((u) => u.userTag)).size).toBe(2);
      }
    });

    test('HTTP 에러 → Result.err pass-through', async () => {
      // Given
      const apiError = createFriendApiError({ code: 'FOLLOW_0911', status: 400 });
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.searchUsers({ query: '홍길동' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.searchUsers({ query: '홍길동' })).rejects.toThrow(
        'Invalid searchUsers response',
      );
    });
  });
});
