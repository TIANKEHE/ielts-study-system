import {NextRequest,NextResponse} from 'next/server';
import {createServerClient} from '@supabase/ssr';
import {authConfig,authMode} from './lib/auth-config';
export async function proxy(req:NextRequest){
 let config;try{if(authMode()==='local')return NextResponse.next();config=authConfig()!;}catch{return NextResponse.next();} // API/page guards independently fail closed.
 let response=NextResponse.next({request:{headers:req.headers}});
 const client=createServerClient(config.url,config.key,{cookieOptions:{httpOnly:true,secure:true,sameSite:'lax',path:'/'},cookies:{getAll:()=>req.cookies.getAll(),setAll:items=>{for(const c of items)req.cookies.set(c.name,c.value);response=NextResponse.next({request:{headers:req.headers}});for(const c of items)response.cookies.set(c.name,c.value,c.options);}}});
 await client.auth.getUser();response.headers.set('Cache-Control','private, no-store');return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
