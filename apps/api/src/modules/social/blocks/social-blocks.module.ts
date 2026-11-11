import { Module } from "@nestjs/common";

import { UserBlockReaderPort } from "./application/ports/user-block.reader.port.js";
import { UserBlockController } from "./presentation/http/v1/user-block.controller.js";
import { SOCIAL_BLOCKS_PROVIDERS } from "./social-blocks.providers.js";

// 친구·콕·응원·댓글이 UserBlockReaderPort를 소비하고, 이 모듈은 다른 slice 모듈을 import하지 않는다
@Module({
  controllers: [UserBlockController],
  providers: [...SOCIAL_BLOCKS_PROVIDERS],
  exports: [UserBlockReaderPort],
})
export class SocialBlocksModule {}
