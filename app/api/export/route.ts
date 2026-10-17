import {NextRequest} from 'next/server';
import {snapshot} from '@/lib/service';
import {csvCell} from '@/lib/rules';
export async function GET(req:NextRequest){
 const data=await snapshot();const csv=req.nextUrl.searchParams.get('format')==='csv';
 const text=csv?'\uFEFF'+[['english','chinese','ipa','pos','example','topic','volume','test','part','question','position','book_name','chapter_name','source_id'],...data.sources.filter(s=>!req.nextUrl.searchParams.get('chapter')||s.chapterId===req.nextUrl.searchParams.get('chapter')).map(s=>[s.word.english,s.meaning,s.word.ipa,s.word.pos,s.word.example,s.word.topic,s.chapter.volume,s.chapter.test,s.chapter.part,s.questionNumber,s.position,s.chapter.book.name,s.chapter.name,s.id])].map(r=>r.map(csvCell).join(',')).join('\r\n'):JSON.stringify({version:3,exportedAt:new Date().toISOString(),...data},null,2);
 return new Response(text,{headers:{'Content-Type':csv?'text/csv; charset=utf-8':'application/json','Content-Disposition':`attachment; filename="kyes-${data.day}.${csv?'csv':'json'}"`}});
}
