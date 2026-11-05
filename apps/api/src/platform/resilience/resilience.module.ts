import { Global, Module } from "@nestjs/common";

import { OutboundPolicyRegistry } from "./outbound-policy.registry.js";

@Global()
@Module({
  providers: [OutboundPolicyRegistry],
  exports: [OutboundPolicyRegistry],
})
export class ResilienceModule {}
