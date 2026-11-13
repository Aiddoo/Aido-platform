import { Module } from "@nestjs/common";

import { UserBlockReaderPort } from "./application/ports/user-block.reader.port.js";
import { DrizzleUserBlockReader } from "./infrastructure/persistence/drizzle-user-block.reader.js";

// 차단 관계 조회만 둔다. 친구·응원·콕·초대·댓글이 import해도 차단 Module(친구·응원·콕을 import)과 순환이 없게 다른 Module을 import하지 않는다
@Module({
  providers: [{ provide: UserBlockReaderPort, useClass: DrizzleUserBlockReader }],
  exports: [UserBlockReaderPort],
})
export class SocialBlockQueriesModule {}
