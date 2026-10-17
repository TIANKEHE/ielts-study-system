import {db} from './db';
export const READING_TOPICS=['自然地理','植物研究','动物保护','太空探索','学校教育','科技发明','文化历史','语言演化','娱乐活动','物品材料','时尚潮流','饮食健康','建筑场所','交通旅游','国家政府','社会经济','法律法规','沙场争锋','社会角色','行为动作','身心健康','日期时间'];
export async function upgradeCatalog(){
 if(await db.dataMigration.findUnique({where:{id:'catalog-v2'}}))return;
 await db.$transaction(async tx=>{
 if(await tx.dataMigration.findUnique({where:{id:'catalog-v2'}}))return;
 const cam=await tx.book.upsert({where:{key:'CAMBRIDGE'},create:{key:'CAMBRIDGE',name:'剑桥雅思真题词汇（Cambridge IELTS Vocabulary）',skill:'听力',sort:-100},update:{}});
 for(let volume=8;volume<=21;volume++)for(let test=1;test<=4;test++)for(let part=1;part<=4;part++){
 const key=`cambridge:${volume}:${test}:${part}`;
 await tx.chapter.upsert({where:{key},create:{key,volume,test,part,bookId:cam.id,name:`Cambridge IELTS ${volume} · Test ${test} · Listening Part ${part}`,sort:(volume-8)*16+(test-1)*4+part-1},update:{}});
 }
 const reading=await tx.book.findFirst({where:{OR:[{key:'LIU_READING'},{skill:'阅读',name:{contains:'刘洪波'}}]},include:{chapters:{orderBy:{sort:'asc'}}}});
 const mappings=[];
 if(reading){await tx.book.update({where:{id:reading.id},data:{key:'LIU_READING'}});
 const used=new Set<string>();
 for(let index=0;index<22;index++){
 const number=index+1;
 const numbered=reading.chapters.filter(c=>Number(c.name.match(/第\s*(\d+)\s*章/)?.[1])===number);
 if(numbered.length>1)throw Error(`阅读第${number}章编号重复，迁移已回滚，请先检查章节`);
 const c=numbered[0]??reading.chapters.find(c=>c.sort===index&&!used.has(c.id))??reading.chapters.find(c=>!used.has(c.id));
 const name=`第${number}章 · ${READING_TOPICS[index]}`;
 if(c){used.add(c.id);await tx.chapter.update({where:{id:c.id},data:{name,sort:index,key:`liu:${number}`}});await tx.task.updateMany({where:{chapterId:c.id,title:`${reading.name} · ${c.name}`},data:{title:`${reading.name} · ${name}`}});mappings.push({id:c.id,before:c.name,after:name});}
 else await tx.chapter.create({data:{bookId:reading.id,key:`liu:${number}`,name,sort:index}});
 }
 }
 await tx.dataMigration.create({data:{id:'catalog-v2',details:JSON.stringify({readingMappings:mappings,cambridgeBookId:cam.id})}});
 },{timeout:60000});
}

export async function ensureCambridgeLists(){
 const book=await db.book.findUnique({where:{key:'CAMBRIDGE'}});if(!book)return;
 for(const [key,name,sort] of [['cambridge:scene','第一阶段 · 场景类（剑桥 4–21）',-2],['cambridge:sequence','第二阶段 · 顺序类（剑桥 4–21）',-1]] as const)
 await db.chapter.upsert({where:{key},create:{key,name,sort,bookId:book.id},update:{}});
}

export async function upgradeSubjectCatalog(){
 if(await db.dataMigration.findUnique({where:{id:'subject-pages-v4'}}))return;
 await db.$transaction(async tx=>{
 const reading=await tx.book.findUnique({where:{key:'LIU_READING'}});
 if(reading)await tx.book.update({where:{id:reading.id},data:{name:'刘洪波《雅思词汇真经》'}});
 await tx.book.upsert({where:{key:'LISTENING_COLLECTED'},create:{key:'LISTENING_COLLECTED',name:'做题词汇积累',skill:'听力',sort:5,chapters:{create:{name:'日常做题词汇',key:'listening:collected',sort:0}}},update:{}});
 const completed=await tx.source.findMany({where:{learnedCount:{gt:0},firstLearnedAt:null,lastLearnedAt:{not:null}},select:{id:true,lastLearnedAt:true}});
 for(const row of completed)await tx.source.update({where:{id:row.id},data:{firstLearnedAt:row.lastLearnedAt}});
 const first=new Map<string,Date>();let cursor:string|undefined;
 for(;;){const receipts=await tx.trainingSubmission.findMany({orderBy:{id:'asc'},take:25,...(cursor?{cursor:{id:cursor},skip:1}:{}),select:{id:true,response:true,createdAt:true}});if(!receipts.length)break;
 for(const receipt of receipts){const r=JSON.parse(receipt.response);if(r.result?.advanced&&['ALL_FIVE','TEST_THEN_FIVE','TRANSLATION','CLOZE'].includes(r.session?.mode)){const sourceId=JSON.parse(r.session.queue)[r.session.cursor-1]?.sourceId;if(sourceId&&(!first.has(sourceId)||receipt.createdAt<first.get(sourceId)!))first.set(sourceId,receipt.createdAt);}}cursor=receipts.at(-1)!.id;}
 for(const [id,date] of first)await tx.source.updateMany({where:{id},data:{firstLearnedAt:date}});
 await tx.dataMigration.create({data:{id:'subject-pages-v4',details:'Non-destructive subject navigation; retain all book/source IDs; backfill source first completion.'}});
 });
}
