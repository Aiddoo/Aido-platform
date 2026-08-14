import { notificationOpenedResponseSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class NotificationOpenedResponseDto extends createZodDto(notificationOpenedResponseSchema) {}
