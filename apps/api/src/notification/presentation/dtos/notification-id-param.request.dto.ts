import { notificationIdParamSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class NotificationIdParamDto extends createZodDto(notificationIdParamSchema) {}
