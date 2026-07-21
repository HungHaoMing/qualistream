export function buildTextRuns(text, codings = []) {
  const characters = Array.from(text)
  const boundaries = new Set([0, characters.length])
  for (const coding of codings) {
    boundaries.add(Math.max(0, Math.min(characters.length, coding.start_offset)))
    boundaries.add(Math.max(0, Math.min(characters.length, coding.end_offset)))
  }
  const points = [...boundaries].sort((a, b) => a - b)
  return points.slice(0, -1).map((start, index) => {
    const end = points[index + 1]
    return { start, end, text: characters.slice(start, end).join(''), codings: codings.filter(c => c.start_offset < end && c.end_offset > start) }
  }).filter(run => run.text)
}

export function textareaSelection(element) {
  const nativeStart = element.selectionStart ?? 0
  const nativeEnd = element.selectionEnd ?? nativeStart
  const start = Array.from(element.value.slice(0, nativeStart)).length
  const end = Array.from(element.value.slice(0, nativeEnd)).length
  return { start, end, text: Array.from(element.value).slice(start, end).join('') }
}
