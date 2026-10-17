import {authMode} from '@/lib/auth-config';
import {requireOwner,AuthFailure} from '@/lib/auth';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
import LearningApp from './ui';
export default async function Page(){try{await requireOwner();}catch(e){if(e instanceof AuthFailure)redirect('/login');return <main><h1>kyes</h1><p>云端登录尚未配置，请先设置生产环境变量。</p></main>;}return <LearningApp cloudAuth={authMode()==='supabase'}/>;}
