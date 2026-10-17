import {PrismaClient} from '@prisma/client';
import {readFileSync,copyFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const input=process.argv[2];
if(!input||!process.argv.includes('--replace'))throw Error('用法: node --env-file=.env scripts/restore.mjs 备份.json --replace（将替换当前数据）');
const backup=JSON.parse(readFileSync(input,'utf8'));
if(![1,2,3].includes(backup.version)||!backup.settings||!Array.isArray(backup.words))throw Error('备份格式不支持');
const path=resolve('prisma', (process.env.DATABASE_URL||'file:./learning.db').replace(/^file:/,''));
const db=new PrismaClient();
await db.$queryRawUnsafe('PRAGMA wal_checkpoint(FULL)');
if(existsSync(path))copyFileSync(path,`${path}.before-restore-${Date.now()}.bak`);
const clean=(object,omit)=>Object.fromEntries(Object.entries(object).filter(([k])=>!omit.includes(k)));
try{await db.$transaction(async tx=>{
for(const model of ['studyClock','studySpan','trainingSubmission','trainingSession','dataMigration','usageAttempt','errorRecord','attempt','review','correction','source','task','speaking','reflection','word','chapter','book','setting'])await tx[model].deleteMany();
await tx.setting.create({data:backup.settings});
for(const book of backup.books){await tx.book.create({data:clean(book,['chapters'])});for(const chapter of book.chapters)await tx.chapter.create({data:clean(chapter,['sources'])});}
for(const word of backup.words){await tx.word.create({data:clean(word,['sources'])});for(const source of word.sources)await tx.source.create({data:clean(source,['chapter'])});}
for(const [key,model] of [['corrections','correction'],['attempts','attempt'],['errors','errorRecord'],['reviews','review'],['tasks','task'],['speaking','speaking'],['reflections','reflection'],['usageAttempts','usageAttempt'],['sessions','trainingSession'],['submissions','trainingSubmission'],['migrations','dataMigration']])for(const item of (backup[key]??[]))await tx[model].create({data:model==='task'?clean(item,['assignedSkill']):item});
for(const span of backup.studySpans??[])await tx.studySpan.create({data:span.endedAt?span:{...span,endedAt:span.confirmedUntil,activeKey:null,endReason:'备份恢复，按最后确认时间结算'}});
if(backup.studyClock)await tx.studyClock.create({data:{...backup.studyClock,state:'PAUSED',ownerId:null,activeSpanId:null,lastHeartbeatAt:null,reason:'备份恢复后请确认继续'}});
},{timeout:60000});console.log('恢复完成；原数据库副本已保留。');}finally{await db.$disconnect();}
