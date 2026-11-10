import { Module } from "@nestjs/common";

import { EngagementCommentsModule } from "./comments/engagement-comments.module.js";

@Module({
  imports: [EngagementCommentsModule],
  exports: [EngagementCommentsModule],
})
export class EngagementModule {}
