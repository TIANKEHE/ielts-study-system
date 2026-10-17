import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {authClient,checkOrigin,AuthFailure} from '@/lib/auth';
import {authConfig} from '@/lib/auth-config';
export async function POST(req:NextRequest){try{checkOrigin(req);const config=authConfig();if(!config)throw new AuthFailure('本地模式无需登录',400);const {email,password}=z.object({email:z.string().email(),password:z.string().min(8).max(128)}).parse(await req.json());const client=await authClient();const {data,error}=await client.auth.signInWithPassword({email,password});if(error||!data.user)throw new AuthFailure('登录失败，请检查账号和密码',401);if(data.user.id!==config.owner){await client.auth.signOut({scope:'local'});throw new AuthFailure('该账号无权访问此学习空间',403);}return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:e instanceof AuthFailure?e.message:'登录服务尚未配置或暂不可用'},{status:e instanceof AuthFailure?e.status:503,headers:{'Cache-Control':'no-store'}});}}
