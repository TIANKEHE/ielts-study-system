import {PrismaClient,Prisma} from '../../generated/postgres/index.js';
import {mkdirSync,createWriteStream,writeFileSync} from 'node:fs';
import {createGzip} from 'node:zlib';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {pipeline} from 'node:stream/promises';
import {dirname,resolve} from 'node:path';
import {ORDER,clientModel,canonical,verifyFiles,auditRelations} from './dataset.mjs';
import {targetIdentity} from './import.mjs';
export async function exportPostgres({url,output}){
 targetIdentity(url);mkdirSync(dirname(resolve(output)),{recursive:true});mkdirSync(output,{recursive:false,mode:0o700});const db=new PrismaClient({datasourceUrl:url});
 const models=Prisma.dmmf.datamodel.models.map(m=>({name:m.name,primaryKey:m.fields.find(f=>f.isId).name,fields:m.fields.filter(f=>f.kind!=='object').map(f=>({name:f.name,type:f.type,required:f.isRequired})),relations:m.fields.filter(f=>f.kind==='object'&&f.relationFromFields?.length).map(f=>({fields:f.relationFromFields,target:f.type,targetFields:f.relationToFields}))}));
 const manifest={format:1,sourceType:'postgresql',createdAt:new Date().toISOString(),models,tables:{}};
 try{await db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');for(const name of ORDER){const model=models.find(m=>m.name===name),delegate=tx[clientModel(name)],file=name+'.jsonl.gz',hash=createHash('sha256'),zip=createGzip(),out=createWriteStream(output+'/'+file,{mode:0o600});const done=pipeline(zip,out);done.catch(()=>{});let cursor,count=0;
 try{for(;;){const batch=await delegate.findMany({orderBy:{[model.primaryKey]:'asc'},take:name==='TrainingSubmission'?5:100,...(cursor!==undefined?{cursor:{[model.primaryKey]:cursor},skip:1}:{})});if(!batch.length)break;for(const row of batch){const line=JSON.stringify(canonical(row,model))+'\n';hash.update(line);if(!zip.write(line))await once(zip,'drain');count++;}cursor=batch.at(-1)[model.primaryKey];}zip.end();await done;}catch(e){zip.destroy();out.destroy();throw e;}
 manifest.tables[name]={count,file,sha256:hash.digest('hex')};}
 },{timeout:600000,maxWait:15000,isolationLevel:'RepeatableRead'});
 const path=output+'/manifest.json';writeFileSync(path,JSON.stringify(manifest,null,2),{mode:0o600});await verifyFiles(path);const relations=await auditRelations(path);return {success:true,tables:manifest.tables,relations};
 }finally{await db.$disconnect();}
}
if(process.argv[1]?.endsWith('/export-postgres.mjs')){const i=process.argv.indexOf('--output');try{if(i<0||!process.argv[i+1]||!process.env.BACKUP_DATABASE_URL)throw Error('需要私有环境 BACKUP_DATABASE_URL 和新 --output 目录');console.log(JSON.stringify(await exportPostgres({url:process.env.BACKUP_DATABASE_URL,output:process.argv[i+1]}),null,2));}catch{console.error('云端备份未完成；没有修改源数据库。请检查连接及输出目录，不输出密码。');process.exitCode=1;}}
