export function rangeRuns(text, codings) {
  const points=new Set([0,text.length]);for(const c of codings){points.add(c.start_offset);points.add(c.end_offset)}const sorted=[...points].filter(n=>n>=0&&n<=text.length).sort((a,b)=>a-b),runs=[];for(let i=0;i<sorted.length-1;i++){const start=sorted[i],end=sorted[i+1];if(start===end)continue;runs.push({start,end,text:text.slice(start,end),codings:codings.filter(c=>c.start_offset<end&&c.end_offset>start)})}return runs
}
export function selectionOffsets(container,selection) {
  if(!selection?.rangeCount||selection.isCollapsed)return null;const range=selection.getRangeAt(0);if(!container.contains(range.commonAncestorContainer))return null;const before=range.cloneRange();before.selectNodeContents(container);before.setEnd(range.startContainer,range.startOffset);const start=before.toString().length,end=start+range.toString().length;return end>start?{start,end,text:range.toString()}:null
}
