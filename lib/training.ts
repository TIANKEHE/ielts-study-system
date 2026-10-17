import {createHash} from 'node:crypto';
import {db} from './db';
import {syncCambridgeTask} from './cambridge-plan';
import {recordAttempt} from './service';
import {addDays,dayInZone} from './rules';
export type TrainingItem={wordId:string;sourceId?:string;english:string;chinese:string;ipa:string;pos:string;label:string;questionNumber?:string|null;example?:string};
export const TRAINING_MODES=['ALL_FIVE','TEST_THEN_FIVE','CLOZE','REVIEW','TRANSLATION','SYNONYM','FORMS'] as const;
export type TrainingMode=typeof TRAINING_MODES[number];
export async function startSession(data:{mode:TrainingMode,sourceIds?:string[],wordIds?:string[],title?:string,fresh?:boolean}){
 let items:TrainingItem[]=[];
 if(data.sourceIds?.length){
 // Keep each query below SQLite's bind-variable limit. Large IN queries with
 // nested relation ordering can panic the Prisma engine when it splits them.
 const sources=[];
 for(let offset=0;offset<data.sourceIds.length;offset+=200){
 const batch=await db.source.findMany({where:{id:{in:data.sourceIds.slice(offset,offset+200)},excluded:false},include:{word:true,chapter:{include:{book:true}}}});
 sources.push(...batch);
 }
 if(sources.length!==data.sourceIds.length)throw Error('来源行已变化，请刷新后重试');
 // Use stored material positions, independent of request order and batch boundaries.
 const sorted=sources.sort((a,b)=>a.chapter.book.sort-b.chapter.book.sort||a.chapter.sort-b.chapter.sort||a.chapterId.localeCompare(b.chapterId)||a.position-b.position||a.originalPosition-b.originalPosition);
 items=sorted.map(s=>({wordId:s.wordId,sourceId:s.id,english:s.word.english,chinese:s.meaning,ipa:s.word.ipa,pos:s.word.pos,label:`${s.chapter.book.name} / ${s.chapter.name}`,questionNumber:s.questionNumber,example:s.word.example}));
 }else if(data.wordIds?.length){for(const id of [...new Set(data.wordIds)]){const w=await db.word.findUniqueOrThrow({where:{id},include:{sources:{where:{excluded:false},orderBy:[{chapter:{book:{sort:'asc'}}},{chapter:{sort:'asc'}},{position:'asc'}],include:{chapter:{include:{book:true}}}}}});const s=w.sources[0];items.push({wordId:w.id,sourceId:s?.id,english:w.english,chinese:s?.meaning||w.chinese,ipa:w.ipa,pos:w.pos,label:s?`${s.chapter.book.name} / ${s.chapter.name}`:'共享词条'});}}
 if(data.mode==='CLOZE'){items=items.filter(i=>i.example?.toLowerCase().includes(i.english.toLowerCase()));if(!items.length)throw Error('请先为短语录入包含该英文表达的真实例句，再进行句子填空');}
 if(!items.length)throw Error('此范围还没有可训练的词汇，请先导入真实 CSV');
 const scopeKey=createHash('sha256').update(JSON.stringify(items.map(i=>i.sourceId??i.wordId).slice().sort())).digest('hex');
 const open=await db.trainingSession.findFirst({where:{scopeKey,mode:data.mode,completedAt:null},orderBy:{createdAt:'asc'}});if(open&&!data.fresh)return open;
 return db.$transaction(async tx=>{const session=await tx.trainingSession.create({data:{scopeKey,mode:data.mode,title:data.title||items[0].label,queue:JSON.stringify(items),phase:data.mode==='ALL_FIVE'?'CORRECTION':'TEST'}});
 if(data.mode==='ALL_FIVE'){const legacy=await tx.correction.findFirst({where:{wordId:items[0].wordId,completedAt:null,trainingItemKey:null}});if(legacy){await tx.correction.update({where:{id:legacy.id},data:{trainingItemKey:`${session.id}:0`,sourceId:items[0].sourceId}});return tx.trainingSession.update({where:{id:session.id},data:{correctCount:legacy.count,currentErrors:legacy.errors}});}}
 return session;
 });
}
export async function submitSession(data:{sessionId:string,revision:number,requestId:string,input:string}){
 const requestBody=JSON.stringify({sessionId:data.sessionId,revision:data.revision,input:data.input});
 return db.$transaction(async tx=>{
 const receipt=await tx.trainingSubmission.findUnique({where:{id:data.requestId}});if(receipt){if(receipt.requestBody!==requestBody)throw Error('提交标识已被用于其他答案');return JSON.parse(receipt.response);}
 const session=await tx.trainingSession.findUniqueOrThrow({where:{id:data.sessionId}});if(session.completedAt)throw Error('此轮训练已完成');
 const claim=await tx.trainingSession.updateMany({where:{id:session.id,revision:data.revision,completedAt:null},data:{revision:{increment:1}}});if(claim.count!==1)throw Error('学习进度已更新，请恢复最新会话后继续');
 const queue:TrainingItem[]=JSON.parse(session.queue),item=queue[session.cursor];if(!item)throw Error('训练队列损坏');
 const correctionMode=session.mode==='ALL_FIVE'||(session.mode==='TEST_THEN_FIVE'&&session.phase==='CORRECTION');
 const mode=correctionMode?'CORRECTION':session.mode==='TEST_THEN_FIVE'?'TRANSLATION':session.mode;
 const result=await recordAttempt(tx,{wordId:item.wordId,sourceId:item.sourceId,input:data.input,mode,trainingItemKey:`${session.id}:${session.cursor}`});
 const advance=correctionMode?result.complete:session.mode==='REVIEW'||result.correct;
 let cursor=session.cursor,count=correctionMode?result.count:0,phase=session.phase,currentErrors=session.currentErrors+Number(!result.correct);
 if(session.mode==='TEST_THEN_FIVE'&&!result.correct)phase='CORRECTION';
 if(advance){
 if(['ALL_FIVE','TEST_THEN_FIVE','TRANSLATION','CLOZE'].includes(session.mode)){
 if(item.sourceId){const source=await tx.source.findUniqueOrThrow({where:{id:item.sourceId}});await tx.source.update({where:{id:item.sourceId},data:{learnedCount:{increment:1},firstLearnedAt:source.firstLearnedAt??new Date(),lastLearnedAt:new Date()}});}
 const word=await tx.word.findUniqueOrThrow({where:{id:item.wordId}});await tx.word.update({where:{id:word.id},data:{lastLearnedAt:new Date()}});if(!word.firstLearnedAt){const settings=await tx.setting.findUniqueOrThrow({where:{id:1}}),day=dayInZone(new Date(),settings.timezone),due=addDays(day,JSON.parse(settings.intervals)[0]);await tx.word.update({where:{id:word.id},data:{firstLearnedAt:new Date(),lastLearnedAt:new Date(),mastery:'LEARNING',nextReviewAt:new Date(due+'T12:00:00Z')}});if(!await tx.review.findFirst({where:{wordId:word.id,completedAt:null}}))await tx.review.upsert({where:{wordId_dueDay:{wordId:word.id,dueDay:due}},create:{wordId:word.id,dueDay:due},update:{}});}
 }
 cursor++;count=0;currentErrors=0;phase=session.mode==='ALL_FIVE'?'CORRECTION':'TEST';
 }
 const updated=await tx.trainingSession.update({where:{id:session.id},data:{cursor,correctCount:count,currentErrors,phase,completedAt:cursor===queue.length?new Date():null}});
 if(advance&&item.sourceId&&['ALL_FIVE','TEST_THEN_FIVE','TRANSLATION','CLOZE'].includes(session.mode)){const source=await tx.source.findUnique({where:{id:item.sourceId}});if(source){const settings=await tx.setting.findUniqueOrThrow({where:{id:1}}),today=dayInZone(new Date(),settings.timezone);const learned=await tx.source.findMany({where:{chapterId:source.chapterId,excluded:false,lastLearnedAt:{not:null}}});const doneSources=learned.filter(s=>s.lastLearnedAt&&dayInZone(s.lastLearnedAt,settings.timezone)===today).length;for(const task of await tx.task.findMany({where:{day:dayInZone(new Date(),(await tx.setting.findUniqueOrThrow({where:{id:1}})).timezone),chapterId:source.chapterId,kind:'NEW'}})){await tx.task.update({where:{id:task.id},data:{actual:doneSources,status:doneSources>=task.planned?'DONE':task.status}});if(doneSources>=task.planned&&task.status!=='DONE')await tx.chapter.update({where:{id:source.chapterId},data:{studyCount:{increment:1}}});}}}
 let groupSummary:Record<string,number>|undefined;
 if(advance){const setting=await tx.setting.findUniqueOrThrow({where:{id:1}});await syncCambridgeTask(tx,dayInZone(new Date(),setting.timezone),setting.timezone);}
 if(updated.completedAt&&updated.isReviewGroup){const prior=await tx.trainingSubmission.findMany({where:{sessionId:session.id},select:{response:true}});const previous=prior.map(p=>JSON.parse(p.response).result);const correct=previous.filter(p=>p.correct).length+Number(result.correct),errors=previous.filter(p=>!p.correct).length+Number(!result.correct);const settings=await tx.setting.findUniqueOrThrow({where:{id:1}});const day=dayInZone(new Date(),settings.timezone);const remaining=await tx.word.count({where:{reviews:{some:{completedAt:null,dueDay:{lte:day}}}}});groupSummary={completed:cursor,correct,errors,accuracy:Math.round(correct/(correct+errors)*100),remaining};}
 const response={session:updated,result:{...result,advanced:advance},groupSummary};
 await tx.trainingSubmission.create({data:{id:data.requestId,sessionId:session.id,requestBody,response:JSON.stringify(response)}});
 return response;
 },{timeout:20000});
}
