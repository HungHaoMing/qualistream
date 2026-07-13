import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Config } from './config.js'
import type { Database } from './db.js'

export type TokenVerifier = (token: string) => Promise<DecodedIdToken>
export function firebaseVerifier(config: Config): TokenVerifier {
  if (!getApps().length) {
    const credential = config.FIREBASE_CLIENT_EMAIL && config.FIREBASE_PRIVATE_KEY
      ? cert({ projectId: config.FIREBASE_PROJECT_ID, clientEmail: config.FIREBASE_CLIENT_EMAIL, privateKey: config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') })
      : applicationDefault()
    initializeApp({ credential, projectId: config.FIREBASE_PROJECT_ID })
  }
  return token => getAuth().verifyIdToken(token, true)
}
export function authenticate(db: Database, verify: TokenVerifier) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization
    if (!header?.startsWith('Bearer ')) return reply.code(401).send({ error: 'authentication_required' })
    try {
      const decoded = await verify(header.slice(7))
      const result = await db.query('SELECT id FROM users WHERE firebase_uid=$1 AND approved=true', [decoded.uid])
      if (!result.rowCount) return reply.code(403).send({ error: 'account_not_approved' })
      request.firebaseUser = decoded; request.localUserId = result.rows[0].id
    } catch (error) {
      if (reply.sent) return
      request.log.warn({ err: error instanceof Error ? error.name : 'unknown' }, 'authentication rejected')
      return reply.code(401).send({ error: 'invalid_token' })
    }
  }
}
export async function requireProject(db: Database, userId: string, projectId: string) {
  return Boolean((await db.query('SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2', [projectId, userId])).rowCount)
}
