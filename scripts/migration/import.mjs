import {PrismaClient} from '../../generated/postgres/index.js';
import {verifyFiles,verifyTarget,rows,ORDER,clientModel,expectedRow,auditRelations} from './dataset.mjs';
import {writeFileSync} from 'node:fs';
export function targetIdentity(url){const u=new URL(url);if(!['postgres:','postgresql:'].includes(u.protocol)||u.searchParams.get('schema')!=='kyes')throw Error('目标必须是PostgreSQL且schema=kyes');return `${u.hostname}:${u.port||5432}${u.pathname}?schema=kyes`;}
export async function migrate({manifestPath,url,apply=false,expectedTarget,reportPath,onProgress}){
 const manifest=await verifyFiles(manifestPath);const relations=await auditRelations(manifestPath);
 const summary={relations,mode:apply?'apply':'plan',tables:Object.fromEntries(ORDER.map(n=>[n,manifest.tables[n].count])),clockPolicy:'仅迁移目标中的活动时段结算到最后确认时间，源库及原始备份不变'};
 if(!apply)return summary;
 if(!url||expectedTarget!==targetIdentity(url))throw Error('必须显式确认目标 --expected-target，拒绝写入');
 const db=new PrismaClient({datasourceUrl:url});
 try{const report=await db.$transaction(async tx=>{
 await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(1802090417)');
 // Locks also prevent the web app from initializing or modifying data during import.
 for(const name of ORDER)await tx.$executeRawUnsafe(`LOCK TABLE "kyes"."${name}" IN ACCESS EXCLUSIVE MODE`);
 for(const name of ORDER)if(await tx[clientModel(name)].count())throw Error('目标非空，拒绝覆盖 '+name);
 for(const name of ORDER){let batch=[];const model=manifest.models.find(m=>m.name===name);for await(const raw of rows(manifestPath,name)){const record=expectedRow(raw,name);for(const f of model.fields)if(f.type==='DateTime'&&record[f.name]!==null)record[f.name]=new Date(record[f.name]);batch.push(record);if(batch.length===(name==='TrainingSubmission'?100:200)){await tx[clientModel(name)].createMany({data:batch});batch=[];}}if(batch.length)await tx[clientModel(name)].createMany({data:batch});onProgress?.({stage:'imported',table:name});}
 const verified=await verifyTarget(tx,manifestPath,onProgress);return {success:true,relations,target:targetIdentity(url),tables:verified,clockPolicy:summary.clockPolicy};
 },{timeout:1800000,maxWait:15000,isolationLevel:'Serializable'});
 if(reportPath){try{writeFileSync(reportPath,JSON.stringify(report,null,2),{mode:0o600});}catch{return {...report,reportSaved:false,warning:'迁移已提交并核对，但报告写入失败；不要重复导入，请保存本次输出。'};}}return report;
 }finally{await db.$disconnect();}
}
if(process.argv[1]?.endsWith('/import.mjs')){const args=process.argv.slice(2),get=flag=>args.includes(flag)?args[args.indexOf(flag)+1]:undefined;try{const manifestPath=get('--manifest');if(!manifestPath)throw Error('需要 --manifest；默认仅检查，不连接数据库');console.log(JSON.stringify(await migrate({manifestPath,url:process.env.MIGRATION_DATABASE_URL,apply:args.includes('--apply'),expectedTarget:get('--expected-target'),reportPath:get('--report')}),null,2));}catch(e){console.error('迁移未确认完成；源SQLite未修改。请先核对目标，不要直接重试或清空。',e.message?.includes('目标')||e.message?.includes('校验')||e.message?.includes('清单')?e.message:'请检查本地报告和目标配置（不输出连接字符串）');process.exitCode=1;}}
