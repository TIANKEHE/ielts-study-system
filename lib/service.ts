import {db} from './db';
import type {Prisma} from '@prisma/client';
import {addDays,dayInZone,matches,correctionStep,nextStage,mastery} from './rules';
import {syncCambridgeTask,cambridgeProgress} from './cambridge-plan';
import {initialize} from './seed';
export async function today(){const s=await db.setting.findUniqueOrThrow({where:{id:1}});return dayInZone(new Date(),s.timezone);}
export async function generatePlan(){
 const day=await today(),settings=await db.setting.findUniqueOrThrow({where:{id:1}});
 const rebase=!await db.dataMigration.findUnique({where:{id:'plan-priority-v2'}});const prior=await db.task.findMany({where:{day}});const orderUpdate=(key:string,sort:number,isCambridge=false)=>rebase||prior.find(t=>t.key===key)?.isCambridge!==isCambridge?{sort}:{};
 const books=await db.book.findMany({include:{chapters:{orderBy:{sort:'asc'},include:{sources:{where:{excluded:false},include:{word:true}}}}},orderBy:{sort:'asc'}});
 const camWords=new Set(books.filter(b=>b.key==='CAMBRIDGE').flatMap(b=>b.chapters.flatMap(c=>c.sources.map(s=>s.wordId))));
 const yesterday=addDays(day,-1),errors=await db.errorRecord.findMany();
 const yesterdayIds=new Set(errors.filter(e=>dayInZone(e.createdAt,settings.timezone)===yesterday).map(e=>e.wordId));
 for(const id of yesterdayIds){if(!camWords.has(id))continue;const reviews=await db.attempt.findMany({where:{wordId:id,mode:'REVIEW'},select:{createdAt:true}});const reviewed=reviews.some(a=>dayInZone(a.createdAt,settings.timezone)===day);const pending=await db.review.findFirst({where:{wordId:id,dueDay:{lte:day},completedAt:null}});if(!reviewed&&!pending)await db.review.upsert({where:{wordId_dueDay:{wordId:id,dueDay:day}},create:{wordId:id,dueDay:day},update:{}});}
 const due=await db.review.findMany({where:{completedAt:null,dueDay:{lte:day}},include:{word:true}});
 const priority=due.sort((a,b)=>Number(camWords.has(b.wordId))-Number(camWords.has(a.wordId))||Number(yesterdayIds.has(b.wordId))-Number(yesterdayIds.has(a.wordId))||b.word.errorCount-a.word.errorCount||a.dueDay.localeCompare(b.dueDay)).slice(0,settings.reviewLimit);
 for(const [i,r] of priority.entries()){const isCambridge=camWords.has(r.wordId),sort=(isCambridge?-4000:-2000)+i;await db.task.upsert({where:{day_key:{day,key:`review:${r.wordId}`}},create:{day,key:`review:${r.wordId}`,title:`复习 · ${r.word.chinese}`,skill:'复习',kind:'REVIEW',planned:1,sort,isCambridge},update:{isCambridge,...orderUpdate(`review:${r.wordId}`,sort,isCambridge)}});}
 const corrections=await db.correction.findMany({where:{completedAt:null},include:{word:{include:{sources:{include:{chapter:{include:{book:true}}}}}}}});
 for(const c of corrections){const isCambridge=camWords.has(c.wordId),sort=isCambridge?-3900:-2100;await db.task.upsert({where:{day_key:{day,key:`correction:${c.wordId}`}},create:{day,key:`correction:${c.wordId}`,title:`纠错 · ${c.word.chinese}`,skill:c.word.sources[0]?.chapter.book.skill??'听力',kind:'CORRECTION',planned:5,actual:c.count,sort,isCambridge},update:{isCambridge,...orderUpdate(`correction:${c.wordId}`,sort,isCambridge)}});}
 const chapterPriority=(c:typeof books[number]['chapters'][number])=>errors.filter(e=>c.sources.some(s=>s.id===e.sourceId)&&dayInZone(e.createdAt,settings.timezone)>=addDays(day,-7)).length;
 for(const book of books){
 if(book.key==='CAMBRIDGE'){const lists=book.chapters.filter(c=>['cambridge:scene','cambridge:sequence'].includes(c.key??'')&&c.sources.length);const candidates=lists.length?lists:book.chapters.filter(c=>c.sources.length);const chapter=candidates.find(c=>c.sources.some(s=>s.learnedCount===0))??candidates[0]??book.chapters[0];if(chapter)await db.task.upsert({where:{day_key:{day,key:'cambridge:daily'}},create:{day,key:'cambridge:daily',title:candidates.length?chapter.name+' · 真题词汇默写':'剑桥雅思真题词汇 · 选择范围并导入',skill:'听力',kind:'NEW',chapterId:chapter.id,planned:candidates.length?Math.min(settings.newGoal,chapter.sources.length):settings.newGoal,isCambridge:true,sort:-3800},update:{isCambridge:true,...orderUpdate('cambridge:daily',-3800,true)}});const placeholder=await db.task.findUnique({where:{day_key:{day,key:'cambridge:daily'}}});if(candidates.length&&placeholder?.title==='剑桥雅思真题词汇 · 选择范围并导入'&&placeholder.status!=='DONE')await db.task.update({where:{id:placeholder.id},data:{chapterId:chapter.id,title:chapter.name+' · 真题词汇默写',planned:Math.min(settings.newGoal,chapter.sources.length)}});continue;}
 if(book.skill==='口语'||book.key==='LISTENING_COLLECTED')continue;
 const existing=await db.task.findMany({where:{day,chapterId:{in:book.chapters.map(c=>c.id)},kind:'NEW'}});
 if(existing.length){if(rebase)for(const t of existing)await db.task.update({where:{id:t.id},data:{sort:100+book.sort*100+(book.chapters.find(c=>c.id===t.chapterId)?.sort??0)}});continue;}
 let chapters=book.chapters;
 if(book.skill==='阅读')chapters=[...chapters].sort((a,b)=>chapterPriority(b)-chapterPriority(a)||a.studyCount-b.studyCount||a.sort-b.sort).slice(0,2);
 else if(book.name!=='179考点词')chapters=[...chapters].sort((a,b)=>chapterPriority(b)-chapterPriority(a)||a.studyCount-b.studyCount||a.sort-b.sort).slice(0,1);
 for(const c of chapters)await db.task.upsert({where:{day_key:{day,key:`chapter:${c.id}`}},create:{day,key:`chapter:${c.id}`,title:`${book.name} · ${c.name}`,skill:book.skill,kind:'NEW',chapterId:c.id,planned:book.skill==='写作'?settings.writingGoal:settings.newGoal,sort:100+book.sort*100+c.sort},update:{}});
 }
 await syncCambridgeTask(db,day,settings.timezone);
 for(let part=1;part<=3;part++){await db.speaking.upsert({where:{day_part:{day,part}},create:{day,part},update:{}});await db.task.upsert({where:{day_key:{day,key:`speaking:${part}`}},create:{day,key:`speaking:${part}`,title:`口语 Part ${part} · 话题练习`,skill:'口语',kind:'SPEAKING',planned:1,sort:2000+part},update:orderUpdate(`speaking:${part}`,2000+part)});}
 await db.task.upsert({where:{day_key:{day,key:'reflection'}},create:{day,key:'reflection',title:'记录今日复盘与明日计划',skill:'复盘',kind:'REFLECTION',planned:1,sort:3000},update:orderUpdate('reflection',3000)});
 await db.dataMigration.upsert({where:{id:'plan-priority-v2'},create:{id:'plan-priority-v2',details:'Rebased existing automatic tasks once; preserve subsequent manual ordering.'},update:{}});
}
export async function snapshot(options:{full?:boolean}={}){
 await initialize();await generatePlan();const day=await today(),full=options.full!==false;
 const [settings,books,words,tasks,attempts,errors,corrections,reviews,speaking,reflections,usageAttempts,sessions,submissions,migrations,sources,studyClock,studySpans]=await Promise.all([
 db.setting.findUniqueOrThrow({where:{id:1}}),db.book.findMany({orderBy:{sort:'asc'},include:{chapters:{orderBy:{sort:'asc'},include:{sources:true}}}}),db.word.findMany({include:{sources:{include:{chapter:{include:{book:true}}}}},orderBy:{createdAt:'desc'}}),db.task.findMany({orderBy:[{day:'desc'},{sort:'asc'}]}),db.attempt.findMany({orderBy:{createdAt:'desc'}}),db.errorRecord.findMany({orderBy:{createdAt:'desc'}}),db.correction.findMany({orderBy:{createdAt:'desc'}}),full?db.review.findMany({orderBy:{dueDay:'asc'}}):Promise.resolve([]),db.speaking.findMany(),db.reflection.findMany(),db.usageAttempt.findMany({orderBy:{createdAt:'desc'}}),db.trainingSession.findMany({where:full?{}:{completedAt:null},take:full?undefined:20,orderBy:{updatedAt:'desc'}}),full?db.trainingSubmission.findMany():Promise.resolve([]),db.dataMigration.findMany(),db.source.findMany({where:{excluded:false},orderBy:[{chapter:{book:{sort:'asc'}}},{chapter:{sort:'asc'}},{position:'asc'},{originalPosition:'asc'}],include:{word:true,chapter:{include:{book:true}}}}),full?db.studyClock.findUnique({where:{id:1}}):Promise.resolve(null),full?db.studySpan.findMany():Promise.resolve([])]);
 const {reviewPage}=await import('./reviews');const reviewSummary=(await reviewPage(1,settings.reviewGroupSize)).summary;
 const todayReviews=await db.review.findMany({where:{dueDay:day},select:{completedAt:true}});const todayReviewStats={due:todayReviews.length,onTime:todayReviews.filter(r=>r.completedAt&&dayInZone(r.completedAt,settings.timezone)<=day).length};
 const visibleTasks=tasks.map(t=>{if(t.isCambridge)return {...t,assignedSkill:'听力'};if(t.skill!=='复习')return t;const word=words.find(w=>w.id===t.key.split(':')[1]);return {...t,assignedSkill:word?.sources.slice().sort((a,b)=>a.chapter.book.sort-b.chapter.book.sort)[0]?.chapter.book.skill??'听力'};});
 const camProgress=await cambridgeProgress(db,day,settings.timezone);
 const camIds=new Set(camProgress.rows.map(s=>s.wordId));const yesterdayIds=new Set(errors.filter(e=>camIds.has(e.wordId)&&dayInZone(e.createdAt,settings.timezone)===addDays(day,-1)).map(e=>e.wordId));
 const reviewedIds=new Set(attempts.filter(a=>a.mode==='REVIEW'&&dayInZone(a.createdAt,settings.timezone)===day).map(a=>a.wordId));
 const cambridgeStats={...camProgress,rows:undefined,yesterdayErrors:[...yesterdayIds].filter(id=>!reviewedIds.has(id)),reviewedToday:[...reviewedIds].filter(id=>camIds.has(id)).length};
 return {cambridgeStats,day,settings,books,words,sources,tasks:visibleTasks,attempts,errors,corrections,reviews,reviewSummary,todayReviewStats,speaking,reflections,usageAttempts,sessions,submissions,migrations,studyClock,studySpans};
}
export type AttemptInput={wordId:string,input:string,mode:string,sourceId?:string,trainingItemKey?:string};
export async function submitAttempt(data:AttemptInput){return db.$transaction(tx=>recordAttempt(tx,data));}
export async function recordAttempt(tx:Prisma.TransactionClient,data:AttemptInput){
 const settings=await tx.setting.findUniqueOrThrow({where:{id:1}}),day=dayInZone(new Date(),settings.timezone),now=new Date();
 const word=await tx.word.findUniqueOrThrow({where:{id:data.wordId}});
 if(!word.confirmed)throw Error('请先人工确认词条答案');
 const sources=await tx.source.findMany({where:{wordId:word.id},include:{chapter:{include:{book:true}}}});
 const source=sources.find(s=>s.id===data.sourceId)??sources[0];
 let answer=word.english,aliases:string[]=JSON.parse(word.aliases);
 if(data.mode==='FORMS'){answer=JSON.parse(word.forms).join(' / ');aliases=[];if(!answer)throw Error('请先录入不规则动词形式');}
 if(data.mode==='SYNONYM'){if(!aliases.length)throw Error('请先设置同义表达');answer=aliases[0];aliases=aliases.slice(1);}
 const correct=matches(data.input,answer,aliases);
 let correction=data.trainingItemKey?await tx.correction.findUnique({where:{trainingItemKey:data.trainingItemKey}}):await tx.correction.findFirst({where:{wordId:word.id,completedAt:null,trainingItemKey:null}});
 if(data.mode==='CORRECTION'&&!correction)correction=await tx.correction.create({data:{wordId:word.id,sourceId:source?.id,trainingItemKey:data.trainingItemKey}});
 await tx.attempt.create({data:{wordId:word.id,input:data.input,answer,correct,mode:data.mode,sourceId:source?.id,sourceLabel:source?`${source.chapter.book.name} / ${source.chapter.name}`:''}});
 if(!correct){
 if(!correction)correction=await tx.correction.create({data:{wordId:word.id,sourceId:source?.id,trainingItemKey:data.trainingItemKey}});
 await tx.correction.update({where:{id:correction.id},data:{errors:{increment:1}}});
 await tx.errorRecord.create({data:{wordId:word.id,input:data.input,answer,sourceId:source?.id,sourceLabel:source?`${source.chapter.book.name} / ${source.chapter.name}`:'',correctionId:correction.id}});
 if(source)await tx.source.update({where:{id:source.id},data:{errorCount:{increment:1}}});
 await tx.word.update({where:{id:word.id},data:{errorCount:{increment:1},mastery:'LEARNING',crossDaySuccess:0}});
 await tx.task.upsert({where:{day_key:{day,key:`correction:${word.id}`}},create:{day,key:`correction:${word.id}`,title:`纠错 · ${word.chinese}`,skill:source?.chapter.book.skill??'听力',kind:'CORRECTION',isCambridge:sources.some(s=>s.chapter.book.key==='CAMBRIDGE'),planned:5,sort:sources.some(s=>s.chapter.book.key==='CAMBRIDGE')?-2900:-2000},update:{status:'PENDING'}});
 }
 let count=correction?.count??0;
 if(data.mode==='CORRECTION'&&correct&&correction){count=correctionStep(count,true);await tx.correction.update({where:{id:correction.id},data:{count,completedAt:count===5?now:null}});
 await tx.task.updateMany({where:{day,key:`correction:${word.id}`},data:{actual:count,status:count===5?'DONE':'ACTIVE'}});
 if(count===5){
 if(!data.trainingItemKey)for(const s of sources){const learned=await tx.word.findMany({where:{sources:{some:{chapterId:s.chapterId}},firstLearnedAt:{not:null}}});const actual=learned.filter(w=>w.firstLearnedAt&&dayInZone(w.firstLearnedAt,settings.timezone)===day).length+(word.firstLearnedAt?0:1);const tasks=await tx.task.findMany({where:{day,chapterId:s.chapterId,kind:'NEW'}});for(const t of tasks){await tx.task.update({where:{id:t.id},data:{actual,status:actual>=t.planned?'DONE':t.status}});if(actual>=t.planned&&t.status!=='DONE')await tx.chapter.update({where:{id:s.chapterId},data:{studyCount:{increment:1}}});}}
 const due=addDays(day,JSON.parse(settings.intervals)[0]);const pending=await tx.review.findFirst({where:{wordId:word.id,completedAt:null}});if(!pending)await tx.review.upsert({where:{wordId_dueDay:{wordId:word.id,dueDay:due}},create:{wordId:word.id,dueDay:due},update:{}});
 await tx.word.update({where:{id:word.id},data:{firstLearnedAt:word.firstLearnedAt??now,lastLearnedAt:now,mastery:word.mastery==='NEW'?'LEARNING':word.mastery,nextReviewAt:new Date((pending?.dueDay??due)+'T12:00:00Z')}});}
 }
 if(data.mode==='REVIEW'){
 const dueReviews=await tx.review.findMany({where:{wordId:word.id,completedAt:null,dueDay:{lte:day}}});if(!dueReviews.length)throw Error('该词当前没有到期复习');
 await tx.review.updateMany({where:{id:{in:dueReviews.map(r=>r.id)}},data:{completedAt:now,success:correct}});
 const progression=nextStage(word.reviewStage,correct,JSON.parse(settings.intervals));const due=addDays(day,progression.days);
 await tx.review.upsert({where:{wordId_dueDay:{wordId:word.id,dueDay:due}},create:{wordId:word.id,dueDay:due},update:{completedAt:null,success:null}});
 const crossed=word.lastReviewedAt?dayInZone(word.lastReviewedAt,settings.timezone)!==day:word.lastLearnedAt?dayInZone(word.lastLearnedAt,settings.timezone)!==day:true;
 const success=correct?word.crossDaySuccess+Number(crossed):0;
 await tx.word.update({where:{id:word.id},data:{reviewStage:progression.stage,crossDaySuccess:success,mastery:mastery(success),lastReviewedAt:now,nextReviewAt:new Date(due+'T12:00:00Z')}});
 await tx.task.updateMany({where:{day,key:`review:${word.id}`},data:{status:'DONE',actual:1}});
 }
 return {correct,count,answer,totalErrors:word.errorCount+Number(!correct),complete:data.mode==='CORRECTION'&&count===5};
}
