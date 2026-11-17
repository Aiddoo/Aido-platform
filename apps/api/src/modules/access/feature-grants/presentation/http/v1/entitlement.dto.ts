import { entitlementSnapshotSchema } from "@aido/api/contracts/entitlement";
import type { z } from "zod";

export const EntitlementSnapshotDto = entitlementSnapshotSchema.meta({
  id: "EntitlementSnapshotDto",
});
export type EntitlementSnapshotDto = z.infer<typeof EntitlementSnapshotDto>;
