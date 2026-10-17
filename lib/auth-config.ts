export function authMode(env:NodeJS.ProcessEnv=process.env){
 const local=env.DATABASE_URL?.startsWith('file:')&&!env.VERCEL;
 if(local&&env.KYES_AUTH_MODE!=='supabase')return 'local' as const;
 if(env.KYES_AUTH_MODE!=='supabase')throw Error('云端必须配置 KYES_AUTH_MODE=supabase');
 return 'supabase' as const;
}
export function authConfig(){
 if(authMode()==='local')return null;
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY,owner=process.env.SUPABASE_ALLOWED_USER_ID,site=process.env.APP_URL||(process.env.VERCEL&&process.env.VERCEL_PROJECT_PRODUCTION_URL?`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`:undefined);
 if(!url||!key||!owner||!site)throw Error('缺少 Supabase 登录环境变量');
 if(new URL(url).protocol!=='https:'||new URL(site).protocol!=='https:'||!/^[-0-9a-f]{36}$/i.test(owner))throw Error('Supabase 登录配置无效');
 return {url,key,owner,origin:new URL(site).origin};
}
