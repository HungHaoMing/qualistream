import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createDatabase } from './db.js'
const config=loadConfig(),db=createDatabase(config.DATABASE_URL),app=await buildApp(config,db)
app.addHook('onClose',async()=>db.end())
await app.listen({host:config.HOST,port:config.PORT})
