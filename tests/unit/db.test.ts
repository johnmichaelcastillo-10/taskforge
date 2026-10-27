import { describe, expect, it } from 'vitest'
import { sqliteFilePath } from '../../server/utils/db'

describe('sqliteFilePath', () => {
  it('returns the path of a local SQLite file', () => {
    expect(sqliteFilePath('file:./data/taskforge.db')).toBe('./data/taskforge.db')
    expect(sqliteFilePath('file:/app/data/taskforge.db')).toBe('/app/data/taskforge.db')
  })

  it('ignores query parameters', () => {
    expect(sqliteFilePath('file:./data/taskforge.db?mode=ro')).toBe('./data/taskforge.db')
  })

  it('returns null for in-memory and remote databases', () => {
    expect(sqliteFilePath(':memory:')).toBeNull()
    expect(sqliteFilePath('file::memory:')).toBeNull()
    expect(sqliteFilePath('libsql://taskforge-example.turso.io')).toBeNull()
  })
})
