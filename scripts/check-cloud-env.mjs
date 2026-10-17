function parse(name){try{return new URL(process.env[name]);}catch{throw Error(name+'格式无效（已隐藏值）');}}
function check(){
 const required=['DATABASE_URL','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ALLOWED_USER_ID'];
 if(process.env.KYES_AUTH_MODE!=='supabase')throw Error('Vercel必须启用Supabase单用户登录');
 for(const name of required)if(!process.env[name])throw Error('缺少环境变量 '+name);
 const site=process.env.APP_URL||(process.env.VERCEL&&process.env.VERCEL_PROJECT_PRODUCTION_URL?`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`:undefined);
 if(!site)throw Error('缺少APP_URL或Vercel正式域名');
 try{if(new URL(site).protocol!=='https:')throw Error();}catch{throw Error('正式网站地址必须为HTTPS');}
 const url=parse('DATABASE_URL');if(!['postgresql:','postgres:'].includes(url.protocol)||url.searchParams.get('schema')!=='kyes')throw Error('云端数据库必须为PostgreSQL，schema=kyes');
 if(url.searchParams.get('sslmode')!=='require')throw Error('云端数据库连接必须使用sslmode=require');
 if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(process.env.SUPABASE_ALLOWED_USER_ID))throw Error('允许访问的用户UUID无效');
 for(const key of ['SUPABASE_URL'])if(parse(key).protocol!=='https:')throw Error(key+'必须为HTTPS');
 console.log('云端构建配置检查通过（未连接或修改数据库）');
}
try{check();}catch(e){console.error(e.message);process.exitCode=1;}
