import { describe, expect, it } from 'vitest'
import { rangeRuns, selectionOffsets } from './textRanges.js'

describe('UTF-16 coding ranges',()=>{
  it('keeps JavaScript offsets for emoji and overlapping codings',()=>{const text='A😀BC',runs=rangeRuns(text,[{id:'a',start_offset:1,end_offset:3},{id:'b',start_offset:2,end_offset:5}]);expect(runs.map(r=>r.text).join('')).toBe(text);expect(runs.some(r=>r.codings.length===2)).toBe(true)})
  it('maps a DOM selection to text offsets',()=>{const el=document.createElement('div');el.innerHTML='<span>甲乙</span><span>丙丁</span>';document.body.append(el);const range=document.createRange();range.setStart(el.firstChild.firstChild,1);range.setEnd(el.lastChild.firstChild,1);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);expect(selectionOffsets(el,selection)).toEqual({start:1,end:3,text:'乙丙'})})
})
