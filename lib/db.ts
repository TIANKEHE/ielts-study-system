import {PrismaClient} from '@prisma/client';
import {PrismaClient as PostgresClient} from '../generated/postgres';
const g=globalThis as unknown as {prisma?:PrismaClient};
const postgres=/^postgres(?:ql)?:/.test(process.env.DATABASE_URL||'');
const create=()=>{
 const client=(postgres?new PostgresClient({transactionOptions:{isolationLevel:'Serializable',maxWait:10000,timeout:30000}}):new PrismaClient()) as unknown as PrismaClient;
 if(!postgres)return client;
 // Serverless requests can race; replay only transactions explicitly rolled back by PostgreSQL.
 return new Proxy(client,{get(target,key){if(key==='$transaction')return async(...args:unknown[])=>{for(let attempt=0;;attempt++){try{return await (target.$transaction as Function).apply(target,args);}catch(e){if((e as {code?:string}).code!=='P2034'||attempt>=3)throw e;await new Promise(r=>setTimeout(r,30*(attempt+1)));}}};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
};
export const db=g.prisma??create();
g.prisma=db;
