import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {execFileSync} from 'node:child_process';
import {writeFileSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
process.env.DATABASE_URL='file:./v2-acceptance.db';
let db:any,service:any,imports:any,training:any,chapter:string,other:string;
const csv='单词,音标,词性,词义\nhare,/heə(r)/,n.,野兔\ninsect,/ˈɪnsekt/,n.,昆虫\nhare,/heə(r)/,n.,野兔\nexist,/ɪɡˈzɪst/,v.,存在、生存';
beforeAll(async()=>{writeFileSync('prisma/v2-acceptance.db','');execFileSync(process.execPath,['node_modules/prisma/build/index.js','db','push','--skip-generate'],{env:process.env});db=(await import('../lib/db')).db;service=await import('../lib/service');imports=await import('../lib/import');training=await import('../lib/training');await (await import('../lib/seed')).initialize();const cs=await db.chapter.findMany({where:{book:{key:'LIU_READING'}},orderBy:{sort:'asc'}});chapter=cs[2].id;other=cs[3].id;vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-01T04:00:00Z'));});
afterAll(async()=>{vi.useRealTimers();await db?.$disconnect();for(const f of ['prisma/v2-acceptance.db','prisma/v2-acceptance.db-journal'])try{unlinkSync(f);}catch{}});
const sources=async(id:string)=>db.source.findMany({where:{chapterId:id,excluded:false},orderBy:{position:'asc'},include:{word:true}});
async function submit(session:any,input:string,id=randomUUID()){return training.submitSession({sessionId:session.id,revision:session.revision,requestId:id,input});}
describe('CSV来源顺序与重复位置',()=>{
 it('中文列顺序识别；hare为第一词、exist为最后词且重复行不丢失',async()=>{await imports.importVocabulary({chapterId:chapter,text:csv});const rows=await sources(chapter);expect(rows.map((s:any)=>s.word.english)).toEqual(['hare','insect','hare','exist']);expect(rows.map((s:any)=>s.position)).toEqual([0,1,2,3]);expect(rows[0].meaning).toBe('野兔');expect(rows[0].word.ipa).toBe('/heə(r)/');expect(rows[0].word.pos).toBe('n.');expect(await db.word.count()).toBe(3);});
 it('同词在其他教材保持独立顺序，断开重连不改变',async()=>{await imports.importVocabulary({chapterId:other,text:'english,chinese\nexist,存在\nhare,野兔'});await db.$disconnect();expect((await sources(other)).map((s:any)=>s.word.english)).toEqual(['exist','hare']);expect((await sources(chapter)).map((s:any)=>s.word.english)).toEqual(['hare','insect','hare','exist']);});
 it('手动调整与原始排序重置均持久化',async()=>{const rows=await sources(other);await imports.reorderSources(other,rows.map((s:any)=>s.id).reverse());expect((await sources(other))[0].word.english).toBe('hare');await imports.reorderSources(other);expect((await sources(other))[0].word.english).toBe('exist');});
});
describe('五遍会话与提交可靠性',()=>{
 let session:any;
 it('模式A按持久化来源顺序建立队列',async()=>{const rows=await sources(chapter);session=await training.startSession({mode:'ALL_FIVE',sourceIds:rows.map((s:any)=>s.id).reverse()});expect(JSON.parse(session.queue).map((q:any)=>q.english)).toEqual(['hare','insect','hare','exist']);});
 it('相同提交标识只计一次；过期版本不能再记录',async()=>{const id=randomUUID(),old=session;const a=await submit(old,'hare',id),b=await submit(old,'hare',id);expect(a.session.correctCount).toBe(1);expect(b.session.correctCount).toBe(1);session=a.session;await expect(submit(old,'hare')).rejects.toThrow('进度已更新');expect(await db.attempt.count()).toBe(1);});
 it('错误不加次数，错误历史逐次保留；暂停和重连可恢复词位及次数',async()=>{session=(await submit(session,'haer')).session;expect(session.correctCount).toBe(1);expect(session.currentErrors).toBe(1);const oldId=session.id;await db.$disconnect();session=await training.startSession({mode:'ALL_FIVE',sourceIds:(await sources(chapter)).map((s:any)=>s.id)});expect(session.id).toBe(oldId);expect(session.cursor).toBe(0);expect(session.correctCount).toBe(1);expect(await db.errorRecord.count()).toBe(1);});
 it('每词五次后自动推进，重复hare的位置仍需另做五次',async()=>{for(let i=0;i<4;i++)session=(await submit(session,'hare')).session;expect(session.cursor).toBe(1);for(let i=0;i<5;i++)session=(await submit(session,'insect')).session;expect(session.cursor).toBe(2);expect(session.correctCount).toBe(0);for(let i=0;i<5;i++)session=(await submit(session,'hare')).session;expect(session.cursor).toBe(3);expect(JSON.parse(session.queue)[session.cursor].english).toBe('exist');for(let i=0;i<5;i++)session=(await submit(session,'exist')).session;expect(session.completedAt).not.toBeNull();expect(await db.attempt.count()).toBe(21);expect(await db.review.count({where:{word:{english:'hare'},completedAt:null}})).toBe(1);});
 it('模式B首次正确通过，首次错误进入独立五遍',async()=>{let s=await training.startSession({mode:'TEST_THEN_FIVE',sourceIds:(await sources(chapter)).map((s:any)=>s.id)});s=(await submit(s,'hare')).session;expect(s.cursor).toBe(1);s=(await submit(s,'inset')).session;expect(s.phase).toBe('CORRECTION');expect(s.correctCount).toBe(0);for(let i=0;i<5;i++)s=(await submit(s,'insect')).session;expect(s.cursor).toBe(2);expect(await db.errorRecord.count()).toBe(2);});
 it('追加导入不移动原有行，旧会话快照不会因追加而变化',async()=>{const before=await sources(chapter);await imports.importVocabulary({chapterId:chapter,text:'english,chinese\nworm,蠕虫\nhare,野兔'});const rows=await sources(chapter);expect(rows.slice(0,4).map((s:any)=>s.id)).toEqual(before.map((s:any)=>s.id));expect(rows.map((s:any)=>s.position)).toEqual([0,1,2,3,4,5]);expect(JSON.parse(session.queue)).toHaveLength(4);});
});
describe('剑桥教材与计划优先级',()=>{
 it('8–21册，每册4Test×4Part；整册导入按行定位并保留题号',async()=>{const cam=await db.book.findUnique({where:{key:'CAMBRIDGE'},include:{chapters:true}});expect(cam.chapters.filter((c:any)=>c.volume)).toHaveLength(224);await imports.importVocabulary({bookId:cam.id,volume:8,text:'english,chinese,test,part,question\nhare,野兔,1,1,2\nexist,存在,2,3,28'});const rows=await db.source.findMany({where:{chapter:{bookId:cam.id}},include:{chapter:true}});expect(rows.map((r:any)=>[r.chapter.volume,r.chapter.test,r.chapter.part,r.questionNumber])).toEqual([[8,1,1,'2'],[8,2,3,'28']]);});
 it('剑桥到期复习先于剑桥新学、其他复习和其他科目，阅读仍至少2章',async()=>{await db.review.updateMany({where:{word:{english:'hare'},completedAt:null},data:{dueDay:'2026-11-01'}});await service.generatePlan();await service.generatePlan();const tasks=await db.task.findMany({where:{day:'2026-11-01'},orderBy:{sort:'asc'}});expect(tasks[0].isCambridge).toBe(true);expect(tasks[0].kind).toBe('REVIEW');const lastCam=Math.max(...tasks.map((t:any,i:number)=>t.isCambridge?i:-1));expect(tasks.slice(0,lastCam+1).every((t:any)=>t.isCambridge)).toBe(true);expect(tasks.filter((t:any)=>t.skill==='阅读'&&t.kind==='NEW')).toHaveLength(2);});
 it('刘洪波22章编号名称顺序正确，ID和原第3章来源不变',async()=>{const cs=await db.chapter.findMany({where:{book:{key:'LIU_READING'}},orderBy:{sort:'asc'}});expect(cs).toHaveLength(22);expect(cs[2].id).toBe(chapter);expect(cs[2].name).toBe('第3章 · 动物保护');expect(cs[17].name).toBe('第18章 · 沙场争锋');expect(cs[21].name).toBe('第22章 · 日期时间');expect(await db.source.count({where:{chapterId:chapter}})).toBe(6);});
 it('发音默认英式、1倍、开启自动与每遍重播',async()=>{const s=await db.setting.findUnique({where:{id:1}});expect([s.audioAuto,s.audioAccent,s.audioRate,s.audioEveryRepeat]).toEqual([true,'en-GB',1,true]);});
 it('备份恢复后保留来源顺序、重复位置、未完成会话和幂等提交记录',async()=>{const snapshot=await service.snapshot();const before=await db.trainingSession.findFirst({where:{mode:'TEST_THEN_FIVE',completedAt:null}});const receipts=await db.trainingSubmission.count();writeFileSync('work/v2-roundtrip.json',JSON.stringify({version:2,...snapshot}));await db.$disconnect();execFileSync(process.execPath,['scripts/restore.mjs','work/v2-roundtrip.json','--replace'],{env:process.env});expect((await db.trainingSession.findUnique({where:{id:before.id}})).cursor).toBe(before.cursor);expect(await db.trainingSubmission.count()).toBe(receipts);expect((await sources(chapter)).map((s:any)=>s.word.english)).toEqual(['hare','insect','hare','exist','worm','hare']);unlinkSync('work/v2-roundtrip.json');});

 it('编辑重复词的指定来源行不会改写其他位置的释义和题号',async()=>{const rows=await sources(chapter),target=rows[2];const {POST}=await import('../app/api/action/route');const {NextRequest}=await import('next/server');const response=await POST(new NextRequest('http://localhost/api/action',{method:'POST',body:JSON.stringify({action:'word',id:target.wordId,data:{english:'hare',chinese:'野兔（复现）',chapterId:chapter,sourceId:target.id,questionNumber:'12'}})}));expect(response.status).toBe(200);expect((await db.source.findUnique({where:{id:rows[0].id}})).meaning).toBe('野兔');expect((await db.source.findUnique({where:{id:target.id}})).questionNumber).toBe('12');expect(await db.source.count({where:{chapterId:chapter}})).toBe(6);});
 it('CSV导出按来源行保留重复位置与稳定顺序',async()=>{const {GET}=await import('../app/api/export/route');const {NextRequest}=await import('next/server');const response=await GET(new NextRequest('http://localhost/api/export?format=csv&chapter='+chapter));const {parseCSV}=await import('../lib/rules');const rows=parseCSV(await response.text());expect(rows.slice(1).map(r=>r[0])).toEqual(['hare','insect','hare','exist','worm','hare']);});

});

describe('场景与顺序两阶段',()=>{
 it('两个独立分组排在册数结构前，允许原始文件缺失释义且保留重复位置',async()=>{
 const scene=await db.chapter.findUniqueOrThrow({where:{key:'cambridge:scene'}}),sequence=await db.chapter.findUniqueOrThrow({where:{key:'cambridge:sequence'}});
 expect(scene.sort).toBeLessThan(sequence.sort);expect(sequence.sort).toBeLessThan(0);
 await imports.importVocabulary({chapterId:scene.id,text:'单词,音标,词性,词义\nalpha,/a/,,\nexist,,,存在\nalpha,/a/,,'});
 await imports.importVocabulary({chapterId:sequence.id,text:'单词,音标,词性,词义\nexist,,,\nalpha,/a/,,字母'});
 const a=await sources(scene.id),b=await sources(sequence.id);
 expect(a.map((r:any)=>r.word.english)).toEqual(['alpha','exist','alpha']);expect(b.map((r:any)=>r.word.english)).toEqual(['exist','alpha']);
 const first=await training.startSession({sourceIds:a.map((r:any)=>r.id),mode:'ALL_FIVE'}),second=await training.startSession({sourceIds:b.map((r:any)=>r.id),mode:'ALL_FIVE'});
 expect(JSON.parse(second.queue)[0].chinese).toBe('');expect(first.id).not.toBe(second.id);
 let current=first;for(let i=0;i<5;i++)current=(await submit(current,'alpha')).session;
 expect(current.cursor).toBe(1);expect((await db.trainingSession.findUnique({where:{id:second.id}})).cursor).toBe(0);
 expect((await db.source.findUnique({where:{id:b[1].id}})).learnedCount).toBe(0);
 await db.task.deleteMany({where:{key:'cambridge:daily'}});await service.generatePlan();expect((await db.task.findFirst({where:{key:'cambridge:daily'}})).chapterId).toBe(scene.id);
 });
});

describe('大词表模式 B',()=>{
 it('超过 SQLite 参数上限的整组按数据库位置加载，首次通过与五遍纠错均可恢复',async()=>{
 const c=await db.chapter.create({data:{name:'大词表回归',sort:99,bookId:(await db.chapter.findUnique({where:{id:chapter}})).bookId}});
 const word=await db.word.create({data:{english:'batchregression',chinese:'批次回归'}});
 await db.source.createMany({data:Array.from({length:1647},(_,position)=>({wordId:word.id,chapterId:c.id,position,originalPosition:position,meaning:'批次回归'}))});
 const rows=await sources(c.id);let session=await training.startSession({sourceIds:rows.map((r:any)=>r.id).reverse(),mode:'TEST_THEN_FIVE'});
 expect(JSON.parse(session.queue).map((r:any)=>r.sourceId)).toEqual(rows.map((r:any)=>r.id));
 session=(await submit(session,'batchregression')).session;expect(session.cursor).toBe(1);
 session=(await submit(session,'wrong')).session;expect(session.phase).toBe('CORRECTION');expect(session.correctCount).toBe(0);
 for(let i=0;i<5;i++)session=(await submit(session,'batchregression')).session;
 expect(session.cursor).toBe(2);expect(session.phase).toBe('TEST');
 const restored=await training.startSession({sourceIds:rows.map((r:any)=>r.id),mode:'TEST_THEN_FIVE'});expect(restored.id).toBe(session.id);expect(restored.cursor).toBe(2);
 });
});
