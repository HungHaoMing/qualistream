import { describe, expect, it } from 'vitest'
import { buildTextRuns } from './textRanges.js'

describe('buildTextRuns', () => {
  it('preserves text with overlapping codings', () => {
    const runs = buildTextRuns('行政負擔很重', [
      { start_offset: 0, end_offset: 4, code: { name: '行政' } },
      { start_offset: 2, end_offset: 6, code: { name: '負擔' } },
    ])
    expect(runs.map(r => r.text).join('')).toBe('行政負擔很重')
    expect(runs.some(r => r.codings.length === 2)).toBe(true)
  })

  it('uses Unicode code points for emoji selections', () => {
    const runs = buildTextRuns('A😀B', [{ start_offset: 1, end_offset: 2, code: { name: 'emoji' } }])
    expect(runs.map(r => r.text).join('')).toBe('A😀B')
    expect(runs.find(r => r.codings.length)?.text).toBe('😀')
  })
})
