import { and, type ModelAccessor } from "@prisma/orm-postgres/orm-client";

import type { Contract } from "../../../../../generated/prisma8/contract.d.js";

/**
 * 사용자와 viewer 사이에 어느 방향으로든 차단이 없을 때만 참이다.
 *
 * 콕·응원 기록처럼 상대 사용자가 정해진 행을 고를 때 relation filter로 붙여 한 SQL 안의
 * NOT EXISTS로 처리한다. 차단 관계를 행마다 따로 조회하지 않는다.
 */
export function hasNoBlockWith(user: ModelAccessor<Contract, "User", "public">, viewerId: string) {
  return and(
    user.initiatedBlocks.none((block) => block.blockedId.eq(viewerId)),
    user.receivedBlocks.none((block) => block.blockerId.eq(viewerId)),
  );
}
