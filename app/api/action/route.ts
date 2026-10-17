import {protectApi} from '@/lib/auth';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {snapshot,submitAttempt,today,generatePlan} from '@/lib/service';
import {startReviewGroup} from '@/lib/reviews';
import {normalize} from '@/lib/rules';
import {importVocabulary,reorderSources} from '@/lib/import';
import {startCambridgeDaily} from '@/lib/cambridge-plan';
import {startSession,submitSession,TRAINING_MODES} from '@/lib/training';
export const runtime='nodejs';
const wordSchema=z.object({english:z.string().trim().min(1),chinese:z.string().trim().min(1),ipa:z.string().default(''),pos:z.string().default(''),example:z.string().default(''),collocation:z.string().default(''),notes:z.string().default(''),topic:z.string().default(''),aliases:z.string().default(''),forms:z.string().default(''),chapterId:z.string().min(1),sourceId:z.string().optional(),questionNumber:z.string().default('')});
async function handleGET(){try{return NextResponse.json(await snapshot({full:false}));}catch(e){console.error(e);return NextResponse.json({error:'读取数据库失败，请检查数据库初始化状态'},{status:500});}}
async function handlePOST(req:NextRequest){
 try{
 if(req.headers.get('origin')&&new URL(req.headers.get('origin')!).host!==req.headers.get('host'))throw Error('请求来源无效');
 const b=await req.json();const day=await today();
 switch(b.action){
 case 'word':{const w=wordSchema.parse(b.data);const english=normalize(w.english);const {chapterId,aliases,forms,sourceId,questionNumber,...fields}=w;const values={...fields,english,aliases:JSON.stringify(aliases.split('|').map(s=>s.trim()).filter(Boolean)),forms:JSON.stringify(forms.split('|').map(s=>s.trim()).filter(Boolean))};await db.$transaction(async tx=>{const word=b.id?await tx.word.update({where:{id:b.id},data:values}):await tx.word.upsert({where:{english},create:values,update:{}});const source=await tx.source.findFirst({where:{wordId:word.id,chapterId,...(sourceId?{id:sourceId}:{})},orderBy:{position:'asc'}});if(source)await tx.source.update({where:{id:source.id},data:{meaning:w.chinese,questionNumber:questionNumber||null}});else {const max=await tx.source.aggregate({where:{chapterId},_max:{position:true,originalPosition:true}});await tx.source.create({data:{wordId:word.id,chapterId,meaning:w.chinese,questionNumber:questionNumber||null,position:(max._max.position??-1)+1,originalPosition:(max._max.originalPosition??-1)+1}});}});break;}
 case 'import':return NextResponse.json(await importVocabulary(z.object({text:z.string().max(2000000),chapterId:z.string().optional(),bookId:z.string().optional(),volume:z.coerce.number().int().min(8).max(21).optional(),test:z.coerce.number().int().min(1).max(4).optional(),part:z.coerce.number().int().min(1).max(4).optional()}).parse(b)));
 case 'reorder':await reorderSources(z.string().parse(b.chapterId),b.reset?undefined:z.array(z.string()).parse(b.ids));break;
 case 'startCambridgeDaily':return NextResponse.json({session:await startCambridgeDaily()});
 case 'startReviewGroup':return NextResponse.json({session:await startReviewGroup()});
 case 'appearance':await db.setting.update({where:{id:1},data:z.object({theme:z.enum(['light','eye','dark']),fontSize:z.union([z.literal(14),z.literal(16),z.literal(18),z.literal(20)])}).parse(b)});break;
 case 'startSession':return NextResponse.json({session:await startSession(z.object({mode:z.enum(TRAINING_MODES),sourceIds:z.array(z.string()).max(10000).optional(),wordIds:z.array(z.string()).optional(),title:z.string().optional(),fresh:z.boolean().optional()}).parse(b))});
 case 'submitSession':return NextResponse.json(await submitSession(z.object({sessionId:z.string(),revision:z.number().int().min(0),requestId:z.string().uuid(),input:z.string().trim().min(1).max(4000)}).parse(b)));
 case 'resumeSession':return NextResponse.json({session:await db.trainingSession.findUniqueOrThrow({where:{id:z.string().parse(b.id)}})});
 case 'audioSettings':await db.setting.update({where:{id:1},data:z.object({audioAuto:z.boolean(),audioAccent:z.enum(['en-GB','en-US']),audioRate:z.union([z.literal(0.75),z.literal(1),z.literal(1.25)]),audioEveryRepeat:z.boolean()}).parse(b)});break;
 case 'attempt':return NextResponse.json(await submitAttempt(z.object({wordId:z.string(),input:z.string().max(4000),mode:z.enum(['CORRECTION','REVIEW','TRANSLATION','SYNONYM','FORMS']),sourceId:z.string().optional()}).parse(b)));
 case 'useAttempt':{const x=z.object({wordId:z.string(),text:z.string().trim().min(1),rating:z.enum(['NEEDS_WORK','OK','CONFIDENT'])}).parse(b);await db.usageAttempt.create({data:x});break;}
 case 'deleteWord':await db.word.delete({where:{id:z.string().parse(b.id)}});break;
 case 'book':{const x=z.object({name:z.string().trim().min(1),skill:z.enum(['听力','阅读','写作','口语'])}).parse(b);if(b.id)await db.book.update({where:{id:b.id},data:x});else await db.book.create({data:x});break;}
 case 'chapter':{const x=z.object({name:z.string().trim().min(1),bookId:z.string(),sort:z.coerce.number().int().min(0)}).parse(b);if(b.id)await db.chapter.update({where:{id:b.id},data:x});else await db.chapter.create({data:x});break;}
 case 'deleteChapter':await db.chapter.delete({where:{id:b.id}});break;
 case 'deleteBook':await db.book.delete({where:{id:b.id}});break;
 case 'task':{const status=z.enum(['PENDING','ACTIVE','PAUSED','DONE','SKIPPED']).parse(b.status);await db.$transaction(async tx=>{const task=await tx.task.findUniqueOrThrow({where:{id:b.id}});if(['REVIEW','CORRECTION'].includes(task.kind)&&status==='DONE')throw Error('请通过训练完成此任务');if(status==='SKIPPED'&&!b.reason?.trim())throw Error('请填写未完成原因');if(task.kind==='SPEAKING'&&status==='DONE'){const s=await tx.speaking.findUnique({where:{day_part:{day:task.day,part:Number(task.key.split(':')[1])}}});if(!s?.question||!s.answer)throw Error('请先保存口语题目和回答');}await tx.task.update({where:{id:b.id},data:{status,reason:b.reason??'',actual:status==='DONE'?task.planned:task.actual}});if(task.chapterId&&status==='DONE'&&task.status!=='DONE')await tx.chapter.update({where:{id:task.chapterId},data:{studyCount:{increment:1}}});});break;}
 case 'addTask':await db.task.create({data:{day,key:crypto.randomUUID(),title:z.string().trim().min(1).parse(b.title),skill:z.enum(['听力','阅读','写作','口语']).parse(b.skill),kind:'MANUAL',planned:z.coerce.number().int().positive().parse(b.planned),sort:z.coerce.number().int().parse(b.sort??250)}});break;
 case 'editTask':await db.task.update({where:{id:b.id},data:{title:z.string().trim().min(1).parse(b.title),planned:z.coerce.number().int().positive().parse(b.planned),sort:z.coerce.number().int().parse(b.sort)}});break;
 case 'errorType':await db.errorRecord.update({where:{id:b.id},data:{type:z.enum(['拼写错误','词形错误','中文意思混淆','同义替换识别错误','词性或搭配错误','遗忘','其他']).parse(b.type)}});break;
 case 'reflection':await db.reflection.upsert({where:{day},create:{day,notes:z.string().parse(b.notes)},update:{notes:b.notes}});await db.task.updateMany({where:{day,key:'reflection'},data:{status:'DONE',actual:1}});break;
 case 'speaking':{const part=z.coerce.number().int().min(1).max(3).parse(b.part);const data=z.object({question:z.string(),answer:z.string(),keywords:z.string(),improvements:z.string()}).parse(b);await db.$transaction(async tx=>{await tx.speaking.upsert({where:{day_part:{day,part}},create:{day,part,...data,...(b.complete?{status:'DONE'}:{})},update:{...data,...(b.complete?{status:'DONE'}:{})}});if(b.complete){if(!data.question.trim()||!data.answer.trim())throw Error('请填写题目和回答后完成');await tx.task.updateMany({where:{day,key:`speaking:${part}`},data:{status:'DONE',actual:1}});}});break;}
 case 'settings':{const s=z.object({budgetMinutes:z.coerce.number().int().min(15).max(1440).optional(),reviewGroupSize:z.coerce.number().refine(n=>[10,20,30,50].includes(n)).optional(),timezone:z.string().refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'时区无效'),reviewLimit:z.coerce.number().int().min(1).max(10000),writingGoal:z.coerce.number().int().min(1).max(200),newGoal:z.coerce.number().int().min(1).max(1000),target:z.string(),intervals:z.string().refine(v=>{try{const a=JSON.parse(v);return Array.isArray(a)&&a.length>0&&a.every((x,i)=>Number.isInteger(x)&&x>0&&(i===0||x>a[i-1]));}catch{return false;}},'间隔应为递增的正整数数组')}).parse(b);await db.setting.update({where:{id:1},data:s});break;}
 case 'plan':await generatePlan();break;
 default:throw Error('不支持的操作');
 }
 return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'操作失败'},{status:400});}
}

export const GET=protectApi(handleGET);

export const POST=protectApi(handlePOST);
