import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.js'
describe('configuration',()=>{it('requires server-only security configuration',()=>{expect(()=>loadConfig({})).toThrow();expect(loadConfig({DATABASE_URL:'postgres://db',FIREBASE_PROJECT_ID:'p',ALLOWED_ORIGINS:'https://app.example'}).RATE_LIMIT_MAX).toBe(120)})})
