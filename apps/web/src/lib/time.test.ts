import { describe, it, expect } from 'vitest'
import { formatTime, formatSessionTime, formatDuration } from './time'

describe('formatTime', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(5)).toBe('0:05')
    expect(formatTime(65)).toBe('1:05')
    expect(formatTime(600)).toBe('10:00')
  })

  it('prefixes a minus sign for negative (over-time) values', () => {
    expect(formatTime(-5)).toBe('-0:05')
    expect(formatTime(-65)).toBe('-1:05')
  })
})

describe('formatSessionTime', () => {
  it('uses MM:SS under an hour', () => {
    expect(formatSessionTime(0)).toBe('00:00')
    expect(formatSessionTime(5)).toBe('00:05')
    expect(formatSessionTime(125)).toBe('02:05')
    expect(formatSessionTime(3599)).toBe('59:59')
  })

  it('switches to "Hh MMmin" at or past an hour', () => {
    expect(formatSessionTime(3600)).toBe('1h 00min')
    expect(formatSessionTime(3660)).toBe('1h 01min')
    expect(formatSessionTime(7325)).toBe('2h 02min')
  })
})

describe('formatDuration', () => {
  it('shows seconds only under a minute', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(59)).toBe('59s')
  })

  it('shows whole minutes with no trailing seconds', () => {
    expect(formatDuration(60)).toBe('1min')
    expect(formatDuration(180)).toBe('3min')
  })

  it('shows minutes and seconds when both present', () => {
    expect(formatDuration(90)).toBe('1min 30s')
    expect(formatDuration(200)).toBe('3min 20s')
  })
})
