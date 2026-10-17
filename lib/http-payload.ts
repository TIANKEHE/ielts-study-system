import {gzipSync} from 'node:zlib';
import {NextRequest,NextResponse} from 'next/server';
export async function boundedPayload(response:Response,req:NextRequest){
 response.headers.set('Cache-Control','private, no-store');response.headers.set('Vary','Cookie, Accept-Encoding');
 if(!response.headers.get('Content-Type')?.includes('application/json'))return response;
 const body=Buffer.from(await response.arrayBuffer());
 if(body.length>1024*1024&&/(?:^|,)\s*gzip(?:\s*;\s*q=(?!0(?:\.0*)?(?:\s|,|$))[^,]+)?(?:\s*,|\s*$)/i.test(req.headers.get('Accept-Encoding')||'')){
 const compressed=gzipSync(body);if(compressed.length<=3000000){const headers=new Headers(response.headers);headers.set('Content-Encoding','gzip');headers.set('Content-Length',String(compressed.length));return new Response(compressed,{status:response.status,headers});}
 }
 if(body.length>4000000)return NextResponse.json({error:'响应过大，请使用本机完整备份流程或缩小查询范围'},{status:413,headers:{'Cache-Control':'no-store'}});
 return new Response(body,{status:response.status,headers:response.headers});
}
