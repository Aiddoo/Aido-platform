import { Global, Module } from "@nestjs/common";

import { RequestClientReader } from "./request-client.store.js";

@Global()
@Module({
  providers: [RequestClientReader],
  exports: [RequestClientReader],
})
export class RequestClientModule {}
