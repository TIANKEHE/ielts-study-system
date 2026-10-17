import {authMode} from '@/lib/auth-config';
import {redirect} from 'next/navigation';
import LoginForm from './form';
export const dynamic='force-dynamic';
export default function LoginPage(){if(authMode()==='local')redirect('/');return <main className="login-page"><section className="panel"><h1>kyes</h1><p>登录个人学习空间</p><LoginForm/></section></main>;}
