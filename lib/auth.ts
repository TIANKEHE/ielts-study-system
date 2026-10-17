import {boundedPayload} from './http-payload';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {NextRequest,NextResponse} from 'next/server';
import {authConfig,authMode} from './auth-config';
export class AuthFailure extends Error {constructor(message:string,public status:number){super(message);}}
export async function authClient(){const config=authConfig();if(!config)throw new AuthFailure('本地模式不使用云登录',400);const store=await cookies();return createServerClient(config.url,config.key,{cookieOptions:{httpOnly:true,secure:true,sameSite:'lax',path:'/'},cookies:{getAll:()=>store.getAll(),setAll:list=>{try{for(const c of list)store.set(c.name,c.value,c.options);}catch{/* Server components cannot write cookies; proxy refreshes them. */}}}});}
export function checkOrigin(req:NextRequest){const config=authConfig(),expected=config?.origin??new URL(req.url).origin;const origin=req.headers.get('origin');if(origin?origin!==expected:config!==null)throw new AuthFailure('请求来源无效',403);}
export async function requireOwner(req?:NextRequest){
 if(authMode()==='local'){if(req&&!['localhost','127.0.0.1','[::1]'].includes(new URL(req.url).hostname))throw new AuthFailure('本地模式仅允许本机访问',403);return;}
 const config=authConfig()!;const client=await authClient();const {data,error}=await client.auth.getUser();if(error||!data.user)throw new AuthFailure('请先登录',401);if(data.user.id!==config.owner)throw new AuthFailure('该账号无权访问此学习空间',403);
}
export function protectApi(handler:(req:NextRequest)=>Promise<Response>){return async(req:NextRequest)=>{try{await requireOwner(req);if(!['GET','HEAD','OPTIONS'].includes(req.method))checkOrigin(req);}catch(e){return NextResponse.json({error:e instanceof AuthFailure?e.message:'登录服务尚未配置或暂不可用'},{status:e instanceof AuthFailure?e.status:503,headers:{'Cache-Control':'no-store'}});}const response=await handler(req);response.headers.set('Cache-Control','private, no-store');response.headers.set('Vary','Cookie');return authMode()==='supabase'?boundedPayload(response,req):response;};}
