import {db} from './db';
import type {Prisma} from '@prisma/client';
import {HEARTBEAT_LEASE_MS,IDLE_LIMIT_MS,confirmedEnd,localDay,splitTime,mondayOf} from './time-rules';
export type ClockCommand={command:'start'|'pause'|'resume'|'end'|'heartbeat'|'suspend'|'switch'|'takeover';clientId:string;skill?:string;module?:string;budgeted?:boolean;activityAt?:number};
async function ensure(tx:Prisma.TransactionClient){return tx.studyClock.upsert({where:{id:1},create:{id:1},update:{}});}
async function settle(tx:Prisma.TransactionClient,clock:Awaited<ReturnType<typeof ensure>>,now:Date,reason:string,stale=false){
 if(clock.activeSpanId){const span=await tx.studySpan.findUnique({where:{id:clock.activeSpanId}});if(span&&!span.endedAt){const end=stale?span.confirmedUntil:new Date(confirmedEnd(+span.startedAt,+span.confirmedUntil,+now,+(clock.lastHeartbeatAt??now),+(clock.lastActivityAt??now)));await tx.studySpan.update({where:{id:span.id},data:{confirmedUntil:end,endedAt:end,activeKey:null,endReason:reason}});}}
 return tx.studyClock.update({where:{id:1},data:{state:stale?'NEEDS_CONFIRMATION':'PAUSED',ownerId:null,activeSpanId:null,reason}});
}
async function reconcile(tx:Prisma.TransactionClient,now:Date){const c=await ensure(tx);if(c.state==='RUNNING'&&c.lastHeartbeatAt&&+now-+c.lastHeartbeatAt>HEARTBEAT_LEASE_MS)return settle(tx,c,now,'连接中断，仅保留最后确认的时间',true);return c;}
export async function commandClock(input:ClockCommand){
 await db.$transaction(async tx=>{const now=new Date();let c=await reconcile(tx,now);
 if(input.command==='heartbeat'){
 if(c.state!=='RUNNING'||c.ownerId!==input.clientId||!c.activeSpanId)return;
 const activity=new Date(Math.max(+(c.lastActivityAt??now),Math.min(+now,input.activityAt??+(c.lastActivityAt??now))));
 if(+now-+activity>=IDLE_LIMIT_MS){await settle(tx,{...c,lastActivityAt:activity},now,'已连续 5 分钟无操作，请确认是否继续');await tx.studyClock.update({where:{id:1},data:{state:'NEEDS_CONFIRMATION'}});return;}
 await tx.studySpan.update({where:{id:c.activeSpanId},data:{confirmedUntil:now}});await tx.studyClock.update({where:{id:1},data:{lastHeartbeatAt:now,lastActivityAt:activity}});return;
 }
 if(input.command==='suspend'){if(c.ownerId===input.clientId&&c.state==='RUNNING')await settle(tx,c,now,'页面离开或关闭，已暂停');return;}
 if(input.command==='pause'||input.command==='end'){if(c.state==='RUNNING')c=await settle(tx,c,now,input.command==='end'?'主动结束':'主动暂停',c.ownerId!==input.clientId);if(input.command==='end')await tx.studyClock.update({where:{id:1},data:{state:'ENDED',ownerId:null,activeSpanId:null,reason:'本次计时已结束'}});return;}
 if(input.command==='switch'&&(c.state!=='RUNNING'||c.ownerId!==input.clientId))return;
 if(c.state==='RUNNING'){
 if(c.ownerId!==input.clientId&&input.command!=='takeover')return;
 const changed=(input.skill??c.skill)!==c.skill||(input.module??c.module)!==c.module||(input.budgeted??c.budgeted)!==c.budgeted;
 if(c.ownerId===input.clientId&&!changed)return;
 c=await settle(tx,c,now,input.command==='takeover'?'由另一标签页接管':'切换学习模块',c.ownerId!==input.clientId);
 }
 const skill=input.skill??c.skill,module=input.module??c.module,budgeted=input.budgeted??c.budgeted;
 const span=await tx.studySpan.create({data:{activeKey:'active',skill,module,budgeted,startedAt:now,confirmedUntil:now}});
 await tx.studyClock.update({where:{id:1},data:{state:'RUNNING',ownerId:input.clientId,skill,module,budgeted,activeSpanId:span.id,lastHeartbeatAt:now,lastActivityAt:now,reason:''}});
 });
 return clockSnapshot();
}
export async function clockSnapshot(){
 const clock=await db.$transaction(tx=>reconcile(tx,new Date()));const settings=await db.setting.findUniqueOrThrow({where:{id:1}});const now=new Date(),day=localDay(+now,settings.timezone);
 const spans=await db.studySpan.findMany({orderBy:{startedAt:'asc'}});
 const map=new Map<string,{day:string;total:number;budgeted:number;skills:Record<string,number>;modules:Record<string,number>}>();
 for(const s of spans)for(const part of splitTime(+s.startedAt,+(s.endedAt??s.confirmedUntil),settings.timezone)){const entry=map.get(part.day)??{day:part.day,total:0,budgeted:0,skills:{听力:0,阅读:0,写作:0,口语:0},modules:{} as Record<string,number>};entry.total+=part.seconds;if(s.budgeted)entry.budgeted+=part.seconds;entry.skills[s.skill]=(entry.skills[s.skill]??0)+part.seconds;entry.modules[s.module]=(entry.modules[s.module]??0)+part.seconds;map.set(part.day,entry);}
 const daily=[...map.values()].sort((a,b)=>a.day.localeCompare(b.day));const aggregate=(key:(day:string)=>string)=>{const m=new Map<string,number>();for(const d of daily){const k=key(d.day);m.set(k,(m.get(k)??0)+d.total);}return [...m].map(([period,seconds])=>({period,seconds})).sort((a,b)=>a.period.localeCompare(b.period));};
 const today=map.get(day)??{day,total:0,budgeted:0,skills:{听力:0,阅读:0,写作:0,口语:0},modules:{} as Record<string,number>};
 return {timezone:settings.timezone,clock,serverNow:now.toISOString(),day,budgetMinutes:settings.budgetMinutes,today,daily:daily.slice(-90),weekly:aggregate(mondayOf).slice(-12),monthly:aggregate(d=>d.slice(0,7)).slice(-12),leaseMs:HEARTBEAT_LEASE_MS};
}
