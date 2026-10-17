import {it,expect} from 'vitest';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {Prisma as SQLite} from '@prisma/client';
import {Prisma as Postgres} from '../generated/postgres';
it('SQLite与PostgreSQL所有模型、约束和字段保持同步',()=>{execFileSync(process.execPath,['scripts/generate-clients.mjs','--check']);expect(Postgres.dmmf.datamodel.models).toEqual(SQLite.dmmf.datamodel.models);});
const cloud=()=>({...process.env,VERCEL:'1',KYES_AUTH_MODE:'supabase',DATABASE_URL:`postgresql://test:${randomBytes(8).toString('hex')}@127.0.0.1:1/postgres?schema=kyes&sslmode=require`,SUPABASE_URL:'https://auth.example.invalid',SUPABASE_PUBLISHABLE_KEY:'placeholder-for-offline-test',SUPABASE_ALLOWED_USER_ID:'00000000-0000-4000-8000-000000000001',APP_URL:'https://kyes.example.invalid'});
it('合法云构建配置只校验配置而不建立数据库连接',()=>{const result=spawnSync(process.execPath,['scripts/check-cloud-env.mjs'],{env:cloud(),encoding:'utf8'});expect(result.status).toBe(0);expect(result.stdout).toContain('未连接');});
it('云部署拒绝SQLite、关闭登录、公开Schema或无TLS配置',()=>{for(const update of [{DATABASE_URL:'file:./learning.db'},{KYES_AUTH_MODE:'local'},{DATABASE_URL:'postgresql://test@127.0.0.1/postgres?schema=public&sslmode=require'},{DATABASE_URL:'postgresql://test@127.0.0.1/postgres?schema=kyes'}]){const result=spawnSync(process.execPath,['scripts/check-cloud-env.mjs'],{env:{...cloud(),...update},encoding:'utf8'});expect(result.status).not.toBe(0);}});
it('配置错误输出不包含密码或连接字符串',()=>{const env=cloud();env.SUPABASE_ALLOWED_USER_ID='invalid';const result=spawnSync(process.execPath,['scripts/check-cloud-env.mjs'],{env,encoding:'utf8'});expect(result.stderr).not.toContain(env.DATABASE_URL);expect(result.stderr).not.toContain(new URL(env.DATABASE_URL).password);});

it('首次Vercel构建使用系统提供的正式域名，缺失时拒绝构建',()=>{const env=cloud();delete (env as any).APP_URL;(env as any).VERCEL_PROJECT_PRODUCTION_URL='kyes-test.vercel.app';expect(spawnSync(process.execPath,['scripts/check-cloud-env.mjs'],{env,encoding:'utf8'}).status).toBe(0);delete (env as any).VERCEL_PROJECT_PRODUCTION_URL;expect(spawnSync(process.execPath,['scripts/check-cloud-env.mjs'],{env,encoding:'utf8'}).status).not.toBe(0);});
