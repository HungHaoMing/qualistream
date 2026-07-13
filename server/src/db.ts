import pg from 'pg'
const { Pool } = pg
export type Database = pg.Pool
export function createDatabase(connectionString: string): Database {
  return new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, statement_timeout: 15_000 })
}
export async function transaction<T>(db: Database, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect()
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result }
  catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
}
