import { z } from "zod";

import { NOTIFICATION_TYPE } from "../../vocabulary/notification.constants.js";

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPE);
