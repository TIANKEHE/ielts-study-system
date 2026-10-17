import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {reviewPage} from '@/lib/reviews';
export async function GET(req:NextRequest){try{const page=z.coerce.number().int().min(1).parse(req.nextUrl.searchParams.get('page')??1),size=z.coerce.number().int().min(1).max(50).parse(req.nextUrl.searchParams.get('size')??20);return NextResponse.json(await reviewPage(page,size));}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
