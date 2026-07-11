import { reorderFriendSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ReorderFriendDto extends createZodDto(reorderFriendSchema) {}
