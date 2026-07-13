import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'), PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1), FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(), FIREBASE_PRIVATE_KEY: z.string().optional(),
  ALLOWED_ORIGINS: z.string().min(1), TRUST_PROXY: z.coerce.boolean().default(false),
  REQUEST_BODY_LIMIT: z.coerce.number().int().positive().default(1_048_576),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
})
export type Config = z.infer<typeof schema>
export function loadConfig(env = process.env): Config { return schema.parse(env) }
