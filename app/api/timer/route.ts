import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {clockSnapshot,commandClock} from '@/lib/timer';
export async function GET(){return NextResponse.json(await clockSnapshot());}
export async function POST(req:NextRequest){try{if(req.headers.get('origin')&&new URL(req.headers.get('origin')!).host!==req.headers.get('host'))throw Error('请求来源无效');const input=z.object({command:z.enum(['start','pause','resume','end','heartbeat','suspend','switch','takeover']),clientId:z.string().min(1),skill:z.enum(['听力','阅读','写作','口语']).optional(),module:z.string().trim().min(1).max(300).optional(),budgeted:z.boolean().optional(),activityAt:z.number().optional()}).parse(await req.json());return NextResponse.json(await commandClock(input));}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
