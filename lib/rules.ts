export const normalize = (s: string) => s.trim().toLowerCase();
export function matches(input: string, answer: string, aliases: string[] = []) { return [answer,...aliases].some(a=>normalize(a)===normalize(input)); }
export function dayInZone(date: Date, timezone: string) { return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
export function addDays(day: string,n: number) { const d=new Date(day+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
export function nextStage(stage: number, correct: boolean, intervals: number[]) { return {stage:correct?Math.min(stage+1,intervals.length):0,days:correct?(stage+1<intervals.length?intervals[stage+1]-intervals[stage]:intervals[intervals.length-1]):1}; }
export function correctionStep(count:number, correct:boolean) { return Math.min(5,count+(correct?1:0)); }
export function mastery(success:number) { return success>=5?'MASTERED':success>=2?'FAMILIAR':'LEARNING'; }
export function parseCSV(text:string) { const rows:string[][]=[]; let row:string[]=[],cell='',quoted=false; const s=text.replace(/^\uFEFF/,''); for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&s[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;} if(quoted)throw Error('CSV 引号未闭合'); row.push(cell);if(row.some(Boolean))rows.push(row);return rows; }
export function csvCell(s:unknown){return '"'+String(s??'').replaceAll('"','""')+'"';}
