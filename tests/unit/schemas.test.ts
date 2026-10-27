import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema } from '../../shared/utils/schemas'

describe('registerSchema', () => {
  it('trims the name and normalizes the email', () => {
    expect(registerSchema.parse({ name: '  Ada  ', email: ' Ada@Example.COM ', password: '12345678' }))
      .toEqual({ name: 'Ada', email: 'ada@example.com', password: '12345678' })
  })

  it('keeps passwords between 8 and 128 characters', () => {
    const base = { name: 'Ada', email: 'ada@example.com' }
    expect(registerSchema.safeParse({ ...base, password: '1234567' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, password: 'x'.repeat(128) }).success).toBe(true)
    expect(registerSchema.safeParse({ ...base, password: 'x'.repeat(129) }).success).toBe(false)
  })

  it('does not trim passwords', () => {
    const { password } = registerSchema.parse({ name: 'Ada', email: 'ada@example.com', password: '  spaced  ' })
    expect(password).toBe('  spaced  ')
  })
})

describe('loginSchema', () => {
  it('requires both fields', () => {
    const result = loginSchema.safeParse({ email: '', password: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map(issue => issue.path[0])).toEqual(['email', 'password'])
  })
})
