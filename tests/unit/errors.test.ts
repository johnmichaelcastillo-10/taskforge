import { describe, expect, it } from 'vitest'
import { errorMessage, fieldErrors, safeRedirect } from '../../app/utils/errors'

describe('safeRedirect', () => {
  it('keeps paths on this site', () => {
    expect(safeRedirect('/projects?view=board')).toBe('/projects?view=board')
  })

  it('falls back for anything that could leave the site', () => {
    for (const target of ['https://evil.example', '//evil.example', '/\\evil.example', 'projects', undefined, ['/a']]) {
      expect(safeRedirect(target)).toBe('/dashboard')
    }
  })
})

describe('request errors', () => {
  // The shape ofetch gives a failed request: the response body under `data`.
  const failure = {
    data: {
      message: 'Check the highlighted fields.',
      data: { fieldErrors: { email: ['Enter a valid email address.'], password: ['Too short.', 'Too common.'] } },
    },
  }

  it('reads the server message, with a fallback', () => {
    expect(errorMessage(failure)).toBe('Check the highlighted fields.')
    expect(errorMessage(new Error('network down'))).toBe('Something went wrong. Try again.')
  })

  it('turns field errors into form errors', () => {
    expect(fieldErrors(failure)).toEqual([
      { name: 'email', message: 'Enter a valid email address.' },
      { name: 'password', message: 'Too short.' },
      { name: 'password', message: 'Too common.' },
    ])
    expect(fieldErrors(null)).toEqual([])
  })
})
