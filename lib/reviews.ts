import {Prisma} from '@prisma/client';
import {db} from './db';
import {dayInZone} from './rules';
export async function reviewPage(page=1,pageSize=20){
 const setting=await db.setting.findUniqueOrThrow({where:{id:1}}),day=dayInZone(new Date(),setting.timezone);
 const where={reviews:{some:{completedAt:null,dueDay:{lte:day}}}};
 const [due,overdue,frequent,todayDue]=await Promise.all([db.word.count({where}),db.word.count({where:{reviews:{some:{completedAt:null,dueDay:{lt:day}}}}}),db.word.count({where:{errorCount:{gte:3}}}),db.word.count({where:{reviews:{some:{completedAt:null,dueDay:day}}}})]);
 const ids=await db.$queryRaw<{id:string;dueDay:string;cambridge:number}[]>(Prisma.sql`SELECT w.id,MIN(r.dueDay) AS dueDay,MAX(CASE WHEN b.key='CAMBRIDGE' THEN 1 ELSE 0 END) AS cambridge FROM Word w JOIN Review r ON r.wordId=w.id AND r.completedAt IS NULL AND r.dueDay<=${day} LEFT JOIN Source s ON s.wordId=w.id AND s.excluded=0 LEFT JOIN Chapter c ON c.id=s.chapterId LEFT JOIN Book b ON b.id=c.bookId GROUP BY w.id ORDER BY cambridge DESC,w.errorCount DESC,MIN(r.dueDay) ASC,w.id ASC LIMIT ${pageSize} OFFSET ${(page-1)*pageSize}`);
 const words=await db.word.findMany({where:{id:{in:ids.map(x=>x.id)}},select:{id:true,english:true,chinese:true,errorCount:true}});
 return {page,pageSize,total:due,pages:Math.max(1,Math.ceil(due/pageSize)),summary:{due,todayDue,overdue,frequent,estimatedMinutes:Math.ceil(due*0.5)},items:ids.map(id=>({...words.find(w=>w.id===id.id)!,dueDay:id.dueDay,cambridge:Boolean(id.cambridge)}))};
}
export async function startReviewGroup(){const open=await db.trainingSession.findFirst({where:{mode:'REVIEW',isReviewGroup:true,completedAt:null},orderBy:{createdAt:'desc'}});if(open)return open;const s=await db.setting.findUniqueOrThrow({where:{id:1}});const page=await reviewPage(1,s.reviewGroupSize);if(!page.items.length)throw Error('今天的到期复习已完成');const {startSession}=await import('./training');const session=await startSession({mode:'REVIEW',wordIds:page.items.map(w=>w.id),title:`智能复习 · ${page.items.length} 词一组`});return db.trainingSession.update({where:{id:session.id},data:{isReviewGroup:true}});}
