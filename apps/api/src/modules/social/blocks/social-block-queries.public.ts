// 차단 관계 조회만 연다. social-blocks.public은 친구·응원·콕 Module을 함께 열어 그 slice들이 쓰면 순환이 된다
export {
  UserBlockReaderPort,
  type UserBlockRelation,
} from "./application/ports/user-block.reader.port.js";
export { hasNoBlockWith } from "./infrastructure/persistence/drizzle-user-block.reader.js";
export { SocialBlockQueriesModule } from "./social-block-queries.module.js";
