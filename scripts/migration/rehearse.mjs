// Local PostgreSQL WASM engine only. Never reads production connection variables.
import {PGlite} from '@electric-sql/pglite';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import {createServer} from 'node:net';
import {readFileSync} from 'node:fs';
import {migrate,targetIdentity} from './import.mjs';
const args=process.argv.slice(2),get=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined,manifestPath=get('--manifest');if(!manifestPath)throw Error('需要 --manifest，运行目标固定为本机临时数据库');
const pg=await PGlite.create();let server;
try{await pg.exec(readFileSync('prisma/postgresql/migrations/202610170001_initial/migration.sql','utf8'));const port=await new Promise((resolve,reject)=>{const probe=createServer();probe.on('error',reject);probe.listen(0,'127.0.0.1',()=>{const p=probe.address().port;probe.close(()=>resolve(p));});});server=new PGLiteSocketServer({db:pg,port,host:'127.0.0.1'});await server.start();
 const url=`postgresql://postgres@127.0.0.1:${port}/postgres?schema=kyes&connection_limit=1`;
 const result=await migrate({manifestPath,url,apply:true,expectedTarget:targetIdentity(url),reportPath:get('--report')});console.log(JSON.stringify({...result,engine:'local PGlite PostgreSQL; no Supabase connection'},null,2));
}finally{await server?.stop();await pg.close();}
