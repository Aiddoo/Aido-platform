import { AuthOAuthState, type AuthOAuthStateProps } from "./auth-oauth-state.aggregate.js";

const at = new Date("2027-01-01T00:00:00.000Z");

function givenState(overrides: Partial<AuthOAuthStateProps> = {}): AuthOAuthState {
  return AuthOAuthState.reconstitute({
    id: 1,
    expiresAt: new Date(at.getTime() + 60_000),
    exchangedAt: null,
    mode: "link",
    initiatingUserId: "owner",
    ...overrides,
  });
}

describe("AuthOAuthState — 일회용 교환 상태", () => {
  it.each([
    { offset: -1, validity: "expired" },
    { offset: 0, validity: "expired" },
    { offset: 1, validity: "valid" },
  ])("만료 시각 차이 $offset ms의 교환 가능 상태를 판정한다", ({ offset, validity }) => {
    // Given
    const state = givenState({ expiresAt: new Date(at.getTime() + offset) });
    // When
    const result = state.validityAt(at);
    // Then
    expect(result).toBe(validity);
  });

  it.each([null, "", "owner"])("legacy actor %s 또는 소유자의 link 교환을 허용한다", (actor) => {
    // Given
    const state = givenState({ initiatingUserId: actor });
    // When
    const allowed = state.canLinkFor("owner");
    // Then
    expect(allowed).toBe(true);
  });

  it.each([
    { mode: "link", initiatingUserId: "other" },
    { mode: "login", initiatingUserId: "owner" },
    { mode: null, initiatingUserId: null },
    { mode: "", initiatingUserId: "" },
  ])("link 목적 또는 소유자가 다르면 연결할 수 없다: $mode/$initiatingUserId", (props) => {
    // Given
    const state = givenState(props);
    // When
    const allowed = state.canLinkFor("owner");
    // Then
    expect(allowed).toBe(false);
  });

  it("유효한 상태는 한 번만 소비하고 입력·출력 Date 변경으로 상태가 바뀌지 않는다", () => {
    // Given
    const expiresAt = new Date(at.getTime() + 60_000);
    const consumedAt = new Date(at);
    const state = givenState({ expiresAt });
    expiresAt.setTime(0);
    // When
    const consumed = state.consume(consumedAt);
    consumedAt.setTime(0);
    state.exchangedAt?.setTime(0);
    // Then
    expect(consumed).toBe(true);
    expect(state.exchangedAt).toEqual(at);
    expect(state.consume(at)).toBe(false);
    expect(state.validityAt(new Date(at.getTime() + 120_000))).toBe("exchanged");
  });

  it("만료된 상태는 소비되지 않는다", () => {
    // Given
    const state = givenState({ expiresAt: at });
    // When
    const consumed = state.consume(at);
    // Then
    expect(consumed).toBe(false);
    expect(state.exchangedAt).toBeNull();
  });
});
