import { defineConfig } from "./define-config.js";
import { encryptionSchema } from "./schemas/security.schema.js";

export const encryptionConfig = defineConfig(
  "encryption",
  encryptionSchema.transform((env) => ({
    key: env.TOKEN_ENCRYPTION_KEY,
    salt: env.TOKEN_ENCRYPTION_SALT,
  })),
  (env) => ({
    TOKEN_ENCRYPTION_KEY: env.TOKEN_ENCRYPTION_KEY,
    TOKEN_ENCRYPTION_SALT: env.TOKEN_ENCRYPTION_SALT,
  }),
);
