import { createMockStorage, createMockSyncStorage } from '@src/shared/__tests__';
import { STORAGE_KEYS } from '@src/shared/constants/storage-keys.constant';
import { FIRST_RUN_FLAG, resolveInitialAuthStatus } from './auth-boot';

describe('앱 부팅 인증 처리 — 낙관적 부팅 (클라이언트는 세션을 먼저 끊지 않는다)', () => {
  let secureStorage: ReturnType<typeof createMockStorage>;
  let flags: ReturnType<typeof createMockSyncStorage>;
  let validateSession: jest.Mock<Promise<boolean>, []>;

  beforeEach(() => {
    secureStorage = createMockStorage();
    flags = createMockSyncStorage();
    validateSession = jest.fn<Promise<boolean>, []>().mockResolvedValue(true);
  });

  it('앱 업데이트(플래그 없음 + 리프레시 토큰 존재): 토큰을 보존하고 인증 상태로 시작한다 — 강제 로그아웃 금지', async () => {
    // Given — 구버전에서 업데이트: MMKV에 첫 실행 플래그가 없지만 키체인에 유효한 세션이 있음
    flags.getString.mockReturnValue(undefined);
    secureStorage.get.mockResolvedValue('valid-refresh-token');

    // When
    const status = await resolveInitialAuthStatus(secureStorage, flags, validateSession);

    // Then — 토큰 삭제 절대 금지 + 플래그 심기 + 인증 유지 + 백그라운드 검증 1회 위임
    expect(status).toBe('authenticated');
    expect(secureStorage.remove).not.toHaveBeenCalled();
    expect(flags.set).toHaveBeenCalledWith(FIRST_RUN_FLAG, '1');
    expect(validateSession).toHaveBeenCalledTimes(1);
  });

  it('정상 재실행(플래그 있음 + 토큰 존재): 아무것도 건드리지 않고 인증 상태를 유지한다', async () => {
    // Given — 이미 실행된 적 있는 설치
    flags.getString.mockReturnValue('1');
    secureStorage.get.mockResolvedValue('valid-refresh-token');

    // When
    const status = await resolveInitialAuthStatus(secureStorage, flags, validateSession);

    // Then — 기존(1.3.5+) 유저 무영향: 검증 호출조차 없음
    expect(status).toBe('authenticated');
    expect(secureStorage.remove).not.toHaveBeenCalled();
    expect(flags.set).not.toHaveBeenCalled();
    expect(validateSession).not.toHaveBeenCalled();
  });

  it('신규 설치(플래그 없음 + 토큰 없음): 플래그만 심고 미인증으로 시작한다', async () => {
    // Given
    flags.getString.mockReturnValue(undefined);
    secureStorage.get.mockResolvedValue(null);

    // When
    const status = await resolveInitialAuthStatus(secureStorage, flags, validateSession);

    // Then — 검증할 세션이 없으므로 refresh 호출 없음
    expect(status).toBe('unauthenticated');
    expect(flags.set).toHaveBeenCalledWith(FIRST_RUN_FLAG, '1');
    expect(secureStorage.remove).not.toHaveBeenCalled();
    expect(validateSession).not.toHaveBeenCalled();
  });

  it('재실행(플래그 있음) + 토큰 없음: 미인증으로 시작한다', async () => {
    // Given — 로그아웃된 기존 설치
    flags.getString.mockReturnValue('1');
    secureStorage.get.mockResolvedValue(null);

    // When
    const status = await resolveInitialAuthStatus(secureStorage, flags, validateSession);

    // Then
    expect(status).toBe('unauthenticated');
    expect(secureStorage.remove).not.toHaveBeenCalled();
    expect(validateSession).not.toHaveBeenCalled();
  });

  it('백그라운드 검증은 부팅을 막지 않는다: 검증이 끝나지 않아도 즉시 인증 상태로 resolve한다', async () => {
    // Given — 검증(refresh)이 영원히 pending인 상황(오프라인 타임아웃 대기 등)
    flags.getString.mockReturnValue(undefined);
    secureStorage.get.mockResolvedValue('valid-refresh-token');
    validateSession.mockReturnValue(new Promise<boolean>(() => {}));

    // When — await가 검증 완료를 기다린다면 이 테스트는 타임아웃으로 실패한다
    const status = await resolveInitialAuthStatus(secureStorage, flags, validateSession);

    // Then
    expect(status).toBe('authenticated');
  });

  it('백그라운드 검증이 실패(false)해도 부팅 결과는 인증 유지이고 토큰을 직접 지우지 않는다', async () => {
    // Given — transient 실패(네트워크 등): 세션 종료 판정은 refresher의 definitive 경로만 담당
    flags.getString.mockReturnValue(undefined);
    secureStorage.get.mockResolvedValue('valid-refresh-token');
    validateSession.mockResolvedValue(false);

    // When
    const status = await resolveInitialAuthStatus(secureStorage, flags, validateSession);
    await Promise.resolve(); // fire-and-forget 검증의 마이크로태스크 소진

    // Then
    expect(status).toBe('authenticated');
    expect(secureStorage.remove).not.toHaveBeenCalled();
  });

  it('백그라운드 검증이 reject해도(방어) 부팅은 영향받지 않는다', async () => {
    // Given — refresher는 설계상 reject하지 않지만, 예외가 새어도 부팅/세션은 안전해야 함
    flags.getString.mockReturnValue(undefined);
    secureStorage.get.mockResolvedValue('valid-refresh-token');
    validateSession.mockRejectedValue(new Error('unexpected'));

    // When
    const status = await resolveInitialAuthStatus(secureStorage, flags, validateSession);
    await Promise.resolve(); // unhandled rejection이 있으면 jest가 테스트를 실패시킨다

    // Then
    expect(status).toBe('authenticated');
    expect(secureStorage.remove).not.toHaveBeenCalled();
  });

  it('세션 존재 판단은 리프레시 토큰 기준이다 (액세스 토큰 만료/부재와 무관)', async () => {
    // Given
    flags.getString.mockReturnValue('1');
    secureStorage.get.mockResolvedValue('valid-refresh-token');

    // When
    await resolveInitialAuthStatus(secureStorage, flags, validateSession);

    // Then — 액세스 토큰은 어차피 만료 시 refresh로 재발급되므로 세션의 근거가 아니다
    expect(secureStorage.get).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN);
    expect(secureStorage.get).not.toHaveBeenCalledWith(STORAGE_KEYS.ACCESS_TOKEN);
  });
});
