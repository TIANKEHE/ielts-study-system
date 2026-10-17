import {NextResponse} from 'next/server';
import {authClient,protectApi} from '@/lib/auth';
export const POST=protectApi(async()=>{await(await authClient()).auth.signOut({scope:'local'});return NextResponse.json({ok:true});});
