import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { FriendshipId } from "./friendship-id.vo.js";
import { Friendship } from "./friendship.aggregate.js";

const CREATED_AT = Temporal.Instant.from("2027-01-08T12:00:00Z");
const LATER = CREATED_AT.add({ seconds: 5 });

function createRequest(): Friendship {
  return Friendship.create({
    id: FriendshipId.reconstitute("clz7x5p8k0010qz0z8z8z8z8z"),
    followerId: UserId.reconstitute("clz7x5p8k0001qz0z8z8z8z8z"),
    followingId: UserId.reconstitute("clz7x5p8k0002qz0z8z8z8z8z"),
    now: CREATED_AT,
  });
}

describe("Friendship 상태 전이", () => {
  it("새 친구 요청은 대기 상태이고 친구 목록 순서 0, 생성·수정 시각이 같다", () => {
    // Given
    const friendship = createRequest();

    // When
    const primitives = friendship.toPrimitives();

    // Then
    expect(primitives).toEqual({
      id: "clz7x5p8k0010qz0z8z8z8z8z",
      followerId: "clz7x5p8k0001qz0z8z8z8z8z",
      followingId: "clz7x5p8k0002qz0z8z8z8z8z",
      status: "PENDING",
      sortOrder: 0,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });
  });

  it("수락하면 친구 목록 자리와 친구가 된 시각을 함께 바꾼다", () => {
    // Given
    const friendship = createRequest();

    // When
    const isChanged = friendship.accept(4, LATER);

    // Then
    expect(isChanged).toBe(true);
    expect(friendship.isAccepted()).toBe(true);
    expect(friendship.toPrimitives()).toMatchObject({
      status: "ACCEPTED",
      sortOrder: 4,
      createdAt: CREATED_AT,
      updatedAt: LATER,
    });
  });

  it("이미 같은 자리에 수락된 관계를 다시 수락하면 바꾸지 않는다", () => {
    // Given
    const friendship = createRequest();
    friendship.accept(4, CREATED_AT);

    // When
    const isChanged = friendship.accept(4, LATER);

    // Then
    expect(isChanged).toBe(false);
    expect(friendship.updatedAt).toEqual(CREATED_AT);
  });

  it("수락된 관계도 다른 자리로 다시 수락하면 그 자리로 옮긴다", () => {
    // Given
    const friendship = createRequest();
    friendship.accept(1, CREATED_AT);

    // When
    const isChanged = friendship.accept(3, LATER);

    // Then
    expect(isChanged).toBe(true);
    expect(friendship.sortOrder).toBe(3);
    expect(friendship.updatedAt).toEqual(LATER);
  });

  it.each([
    { name: "같은 자리", sortOrder: 2, isChanged: false, updatedAt: CREATED_AT },
    { name: "다른 자리", sortOrder: 5, isChanged: true, updatedAt: LATER },
  ])("$name로 옮기면 바뀜=$isChanged", ({ sortOrder, isChanged, updatedAt }) => {
    // Given
    const friendship = createRequest();
    friendship.accept(2, CREATED_AT);

    // When
    const result = friendship.moveTo(sortOrder, LATER);

    // Then
    expect(result).toBe(isChanged);
    expect(friendship.sortOrder).toBe(sortOrder);
    expect(friendship.updatedAt).toEqual(updatedAt);
  });
});
