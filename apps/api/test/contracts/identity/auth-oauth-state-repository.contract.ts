import type {
  AuthOAuthStateRepositoryPort,
  NewAuthOAuthState,
} from "#api/modules/identity/auth/application/ports/auth-oauth-state.repository.port";
import type { AuthOAuthState } from "#api/modules/identity/auth/domain/auth-oauth-state.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_OTHER_USER_ID,
  AUTH_FIXTURE_USER_ID,
} from "#test/fixtures/identity/auth-session.fixture";

const EXPIRES_AT = AUTH_FIXTURE_NOW.add({ minutes: 10 });
let stateSequence = 0;

async function createState(
  repository: AuthOAuthStateRepositoryPort,
  overrides: Partial<NewAuthOAuthState> = {},
): Promise<AuthOAuthState> {
  stateSequence += 1;
  const state = `state-${stateSequence}`;
  await repository.create({
    state,
    provider: "GOOGLE",
    redirectUri: "aido://auth/callback",
    expiresAt: EXPIRES_AT,
    ...overrides,
  });
  const created = await repository.findByState(overrides.state ?? state, AUTH_FIXTURE_NOW);
  if (created == null) {
    throw new Error("만든 OAuth state를 찾지 못했다");
  }
  return created;
}

async function saveLoginExchange(
  repository: AuthOAuthStateRepositoryPort,
  state: AuthOAuthState,
): Promise<string> {
  const exchangeCode = repository.generateExchangeCode();
  await repository.saveExchangeData(state.id, {
    exchangeCode,
    accessToken: "access-token",
    refreshToken: "refresh-token",
    userId: AUTH_FIXTURE_USER_ID,
    userName: "아이도",
    accountRestored: false,
    isNewUser: true,
  });
  return exchangeCode;
}

export function describeAuthOAuthStateRepositoryContract(
  createRepository: () => Promise<AuthOAuthStateRepositoryPort>,
): void {
  describe("OAuth state 저장소 계약", () => {
    it("만든 state는 만료 전까지 시작 정보와 함께 읽는다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const created = await createState(repository, {
        provider: "KAKAO",
        redirectUri: "aido://auth/kakao",
        mode: "link",
        initiatingUserId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
      });
      const atExpiry = await repository.findByState(created.state, EXPIRES_AT);

      // Then
      expect(created.toPrimitives()).toMatchObject({
        provider: "KAKAO",
        redirectUri: "aido://auth/kakao",
        mode: "link",
        initiatingUserId: AUTH_FIXTURE_USER_ID,
        exchangeCode: null,
        expiresAt: EXPIRES_AT,
        exchangedAt: null,
      });
      expect(atExpiry).toBeNull();
    });

    it("모드·시작 사용자를 비우면 null로 읽는다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const created = await createState(repository);

      // Then
      expect(created.toPrimitives()).toMatchObject({ mode: null, initiatingUserId: null });
    });

    it("로그인 교환 코드로 저장한 토큰을 평문으로 다시 읽는다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createState(repository);

      // When
      const exchangeCode = await saveLoginExchange(repository, created);
      const found = await repository.findByExchangeCode(exchangeCode, AUTH_FIXTURE_NOW);

      // Then
      expect(found?.loginExchange()).toEqual({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        userId: AUTH_FIXTURE_USER_ID,
      });
      expect(found?.toPrimitives()).toMatchObject({
        userName: "아이도",
        accountRestored: false,
        isNewUser: true,
      });
    });

    it("교환 코드는 한 번만 소비되고 소비하면 토큰을 지운다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createState(repository);
      const exchangeCode = await saveLoginExchange(repository, created);
      const input = {
        id: created.id,
        exchangeCode,
        at: AUTH_FIXTURE_NOW,
        purpose: "login",
      } as const;

      // When
      const first = await repository.consumeExchangeCode(input);
      const second = await repository.consumeExchangeCode(input);
      const byCode = await repository.findByExchangeCode(exchangeCode, AUTH_FIXTURE_NOW);
      const byState = await repository.findByState(created.state, AUTH_FIXTURE_NOW);

      // Then
      expect({ first, second, byCode }).toEqual({ first: true, second: false, byCode: null });
      expect(byState?.toPrimitives()).toMatchObject({
        accessToken: null,
        refreshToken: null,
        exchangedAt: AUTH_FIXTURE_NOW,
      });
    });

    it("만료됐거나 코드가 다르면 소비하지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createState(repository);
      const exchangeCode = await saveLoginExchange(repository, created);

      // When
      const expired = await repository.consumeExchangeCode({
        id: created.id,
        exchangeCode,
        at: EXPIRES_AT,
        purpose: "login",
      });
      const wrongCode = await repository.consumeExchangeCode({
        id: created.id,
        exchangeCode: "other-code",
        at: AUTH_FIXTURE_NOW,
        purpose: "login",
      });

      // Then
      expect({ expired, wrongCode }).toEqual({ expired: false, wrongCode: false });
    });

    it("연결 교환은 공급자 계정 id를 남기고 시작한 사용자만 소비한다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createState(repository, {
        mode: "link",
        initiatingUserId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
      });
      const exchangeCode = repository.generateExchangeCode();
      await repository.saveLinkingData(created.id, {
        exchangeCode,
        provider: "NAVER",
        providerAccountId: "naver-account",
      });
      const linkInput = { id: created.id, exchangeCode, at: AUTH_FIXTURE_NOW } as const;

      // When
      const found = await repository.findByExchangeCode(exchangeCode, AUTH_FIXTURE_NOW);
      const byOther = await repository.consumeExchangeCode({
        ...linkInput,
        purpose: "link",
        actorUserId: UserId.reconstitute(AUTH_FIXTURE_OTHER_USER_ID),
      });
      const byOwner = await repository.consumeExchangeCode({
        ...linkInput,
        purpose: "link",
        actorUserId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
      });

      // Then
      expect(found?.provider).toBe("NAVER");
      expect(found?.linkedProviderAccountId()).toBe("naver-account");
      expect({ byOther, byOwner }).toEqual({ byOther: false, byOwner: true });
    });

    it("시작 사용자가 없는 옛 연결 state는 누구의 연결이든 소비하고 로그인 state는 연결로 소비하지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const legacyLink = await createState(repository, { mode: "link" });
      const login = await createState(repository, { mode: "login" });
      const legacyCode = repository.generateExchangeCode();
      const loginCode = repository.generateExchangeCode();
      const linking = { provider: "GOOGLE", providerAccountId: "google-account" } as const;
      await repository.saveLinkingData(legacyLink.id, {
        ...linking,
        exchangeCode: legacyCode,
      });
      await repository.saveLinkingData(login.id, { ...linking, exchangeCode: loginCode });

      // When
      const legacy = await repository.consumeExchangeCode({
        id: legacyLink.id,
        exchangeCode: legacyCode,
        at: AUTH_FIXTURE_NOW,
        purpose: "link",
        actorUserId: UserId.reconstitute(AUTH_FIXTURE_OTHER_USER_ID),
      });
      const loginAsLink = await repository.consumeExchangeCode({
        id: login.id,
        exchangeCode: loginCode,
        at: AUTH_FIXTURE_NOW,
        purpose: "link",
        actorUserId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
      });

      // Then
      expect({ legacy, loginAsLink }).toEqual({ legacy: true, loginAsLink: false });
    });

    it("교환 코드는 만들 때마다 다르다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const codes = [repository.generateExchangeCode(), repository.generateExchangeCode()];

      // Then
      expect(codes[0]).not.toBe(codes[1]);
    });
  });
}
