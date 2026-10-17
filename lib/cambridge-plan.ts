import type {Prisma} from '@prisma/client';
import {dayInZone} from './rules';
import {CAMBRIDGE_DAILY_GOAL} from './subjects';
export async function cambridgeProgress(tx:Prisma.TransactionClient,day:string,timezone:string){
 const rows=await tx.source.findMany({where:{excluded:false,chapter:{book:{key:'CAMBRIDGE'}}},orderBy:[{chapter:{sort:'asc'}},{position:'asc'},{originalPosition:'asc'}]});
 const first=new Map<string,Date>();for(const s of rows){if(s.firstLearnedAt){const old=first.get(s.wordId);if(!old||s.firstLearnedAt<old)first.set(s.wordId,s.firstLearnedAt);}}
 const learnedToday=[...first.values()].filter(d=>dayInZone(d,timezone)===day).length;
 const remaining=new Set(rows.filter(s=>!first.has(s.wordId)).map(s=>s.wordId)).size;
 return {learnedToday,completed:first.size,remaining,target:Math.min(CAMBRIDGE_DAILY_GOAL,learnedToday+remaining),rows};
}
export async function syncCambridgeTask(tx:Prisma.TransactionClient,day:string,timezone:string){const p=await cambridgeProgress(tx,day,timezone);const task=await tx.task.findUnique({where:{day_key:{day,key:'cambridge:daily'}}});await tx.task.updateMany({where:{day,key:'cambridge:daily'},data:{actual:p.learnedToday,planned:p.target,status:p.target>0&&p.learnedToday>=p.target?'DONE':task?.status==='DONE'?'PENDING':task?.status??'PENDING'}});return p;}
export async function startCambridgeDaily(){
 const {db}=await import('./db'),{startSession}=await import('./training');const setting=await db.setting.findUniqueOrThrow({where:{id:1}}),day=dayInZone(new Date(),setting.timezone);
 const p=await cambridgeProgress(db,day,setting.timezone);
 // Resume the original queue and partial five-write count, even across days.
 const open=await db.trainingSession.findMany({where:{mode:'TEST_THEN_FIVE',completedAt:null},orderBy:{updatedAt:'desc'}}),ids=new Set(p.rows.map(s=>s.id));
 for(const session of open){const q=JSON.parse(session.queue);if(q.length&&ids.has(q[session.cursor]?.sourceId))return session;}
 if(p.learnedToday>=p.target&&p.target>0)throw Error('今日新词目标已完成，可继续复习或自行选择教材练习');
 const chapter=p.rows.find(s=>s.learnedCount===0)?.chapterId;
 const pending=p.rows.filter(s=>s.chapterId===chapter&&s.learnedCount===0),already=new Set(p.rows.filter(s=>s.firstLearnedAt).map(s=>s.wordId)),selected:string[]=[],newWords=new Set<string>();
 for(const s of pending){if(!already.has(s.wordId)&&!newWords.has(s.wordId)&&newWords.size>=Math.max(0,p.target-p.learnedToday))break;selected.push(s.id);if(!already.has(s.wordId))newWords.add(s.wordId);}
 return startSession({mode:'TEST_THEN_FIVE',sourceIds:selected,title:'剑桥真题词汇 · 每日新学'});
}
