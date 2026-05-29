import { describe, it, expect } from 'vitest'
import { parseLabelFmt, formatFieldValue } from './card-format'

describe('parseLabelFmt', () => {
  it('parses a JSON label and fills missing fields with defaults', () => {
    const raw = JSON.stringify({ text: 'Hello', bold: true })
    expect(parseLabelFmt(raw)).toEqual({
      text: 'Hello', size: 16, bold: true, italic: false, underline: false, strike: false, color: '#374151',
    })
  })

  it('keeps all provided formatting fields', () => {
    const fmt = { text: 'X', size: 24, bold: true, italic: true, underline: true, strike: true, color: '#ff0000' }
    expect(parseLabelFmt(JSON.stringify(fmt))).toEqual(fmt)
  })

  it('treats a plain string as the label text', () => {
    expect(parseLabelFmt('just text')).toEqual({
      text: 'just text', size: 16, bold: false, italic: false, underline: false, strike: false, color: '#374151',
    })
  })

  it('treats invalid JSON as plain text', () => {
    expect(parseLabelFmt('{ not json').text).toBe('{ not json')
  })

  it('treats a JSON object without a text field as plain text', () => {
    const raw = JSON.stringify({ size: 20 })
    expect(parseLabelFmt(raw).text).toBe(raw)
  })

  it('handles an empty string', () => {
    expect(parseLabelFmt('').text).toBe('')
  })
})

describe('formatFieldValue', () => {
  it('passes through non-DATE values unchanged', () => {
    expect(formatFieldValue('TEXT', 'hello')).toBe('hello')
    expect(formatFieldValue('NUMBER', '42')).toBe('42')
    expect(formatFieldValue('SELECT', 'option')).toBe('option')
  })

  it('passes through an empty DATE value', () => {
    expect(formatFieldValue('DATE', '')).toBe('')
  })

  it('passes through an unparseable DATE value untouched', () => {
    expect(formatFieldValue('DATE', 'not-a-date')).toBe('not-a-date')
  })

  it('localizes a valid DATE value to dd/mm/yy', () => {
    const out = formatFieldValue('DATE', '2024-06-15T12:00:00')
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{2}$/)
  })
})
