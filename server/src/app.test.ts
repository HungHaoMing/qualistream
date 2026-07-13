import { describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import type { Config } from './config.js'
import type { Database } from './db.js'

const config={NODE_ENV:'test',HOST:'127.0.0.1',PORT:3000,DATABASE_URL:'postgres://unused',FIREBASE_PROJECT_ID:'test',ALLOWED_ORIGINS:'https://app.test',TRUST_PROXY:false,REQUEST_BODY_LIMIT:1048576,RATE_LIMIT_MAX:120} as Config
function fakeDb(rows:any[]=[]){return{query:async()=>({rows,rowCount:rows.length})} as unknown as Database}
describe('API authentication boundary',()=>{
  it('keeps health public but rejects research data without token',async()=>{const app=await buildApp(config,fakeDb(),async()=>({uid:'u'} as any));expect((await app.inject({url:'/health'})).statusCode).toBe(200);expect((await app.inject({url:'/v1/projects'})).statusCode).toBe(401);await app.close()})
  it('rejects invalid and unapproved Firebase identities',async()=>{const invalid=await buildApp(config,fakeDb(),async()=>{throw new Error('bad token')});expect((await invalid.inject({url:'/v1/projects',headers:{authorization:'Bearer bad'}})).statusCode).toBe(401);await invalid.close();const unapproved=await buildApp(config,fakeDb(),async()=>({uid:'u'} as any));expect((await unapproved.inject({url:'/v1/projects',headers:{authorization:'Bearer valid'}})).statusCode).toBe(403);await unapproved.close()})
})
