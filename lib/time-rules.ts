const formatters=new Map<string,Intl.DateTimeFormat>();
export function localDay(ms:number,zone:string){let f=formatters.get(zone);if(!f){f=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});formatters.set(zone,f);}return f.format(new Date(ms));}
export const HEARTBEAT_LEASE_MS=45000;
export const IDLE_LIMIT_MS=5*60000;
export function confirmedEnd(start:number,confirmed:number,now:number,lastHeartbeat:number,activity:number){return Math.max(start,Math.min(now,now-lastHeartbeat>HEARTBEAT_LEASE_MS?confirmed:now,activity+IDLE_LIMIT_MS));}
export function splitTime(start:number,end:number,zone:string){const parts:{day:string;seconds:number}[]=[];let cursor=start;while(cursor<end){const day=localDay(cursor,zone);if(localDay(end-1,zone)===day){parts.push({day,seconds:(end-cursor)/1000});break;}let lo=cursor+1,hi=Math.min(end,cursor+28*3600000);while(lo<hi){const mid=Math.floor((lo+hi)/2);if(localDay(mid,zone)===day)lo=mid+1;else hi=mid;}parts.push({day,seconds:(lo-cursor)/1000});cursor=lo;}return parts;}
export function mondayOf(day:string){const d=new Date(day+'T12:00:00Z');const weekday=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-weekday);return d.toISOString().slice(0,10);}
export function budgetState(seconds:number,minutes=240){const budget=minutes*60;return {remainingMinutes:Math.max(0,Math.ceil((budget-seconds)/60)),progress:Math.min(100,seconds/budget*100),near:seconds>=Math.max(0,budget-1800)&&seconds<budget,reached:seconds>=budget};}
