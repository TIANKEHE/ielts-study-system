import {randomUUID} from 'node:crypto';
import {db} from './db';
import {parseCSV,normalize} from './rules';
const headerNames:Record<string,string[]>={english:['english','word','单词','英文','英文单词','答案'],chinese:['chinese','meaning','中文','中文含义','中文释义','释义','词义'],ipa:['ipa','phonetic','音标'],pos:['pos','词性'],example:['example','例句'],topic:['topic','话题'],volume:['volume','book','册数','册'],test:['test','测试'],part:['part','部分'],questionNumber:['question','question_number','questionnumber','题号']};
export function parseVocabularyCSV(text:string,allowMissingMeaning=false){
 const rows=parseCSV(text);if(!rows.length)throw Error('CSV 没有词汇行');
 const header=rows[0].map(c=>normalize(c));
 const hasHeader=header.some(c=>headerNames.english.includes(c))&&header.some(c=>headerNames.chinese.includes(c));
 const positions=Object.fromEntries(Object.entries(headerNames).map(([key,names])=>[key,hasHeader?header.findIndex(c=>names.includes(c)):['english','chinese','ipa','pos','example','topic','questionNumber'].indexOf(key)]));
 if(hasHeader)rows.shift();if(!rows.length||rows.length>3000)throw Error('每次请导入 1–3000 条词汇');
 return rows.map((r,i)=>{const cell=(key:string)=>positions[key]>=0?(r[positions[key]]??'').trim():'';const english=normalize(cell('english')),chinese=cell('chinese');if(!english||(!chinese&&!allowMissingMeaning))throw Error(`词汇第 ${i+1} 行缺少英文或中文释义`);
 const num=(key:string,min:number,max:number)=>{const s=cell(key);if(!s)return undefined;const n=Number(s.replace(/[^\d]/g,''));if(!Number.isInteger(n)||n<min||n>max)throw Error(`第 ${i+1} 行 ${key} 无效`);return n;};
 return {english,chinese,ipa:cell('ipa'),pos:cell('pos'),example:cell('example'),topic:cell('topic'),questionNumber:cell('questionNumber')||null,volume:num('volume',8,21),test:num('test',1,4),part:num('part',1,4)};});
}
export async function importVocabulary(data:{text:string,chapterId?:string,bookId?:string,volume?:number,test?:number,part?:number}){
 const target=data.chapterId?await db.chapter.findUniqueOrThrow({where:{id:data.chapterId}}):null;
 const isList=['cambridge:scene','cambridge:sequence'].includes(target?.key??'');
 const rows=parseVocabularyCSV(data.text,isList);const batch=randomUUID();
 return db.$transaction(async tx=>{
 const book=data.bookId?await tx.book.findUniqueOrThrow({where:{id:data.bookId}}):null;
 const maxima=new Map<string,number>();
 for(const row of rows){for(const key of ['volume','test','part'] as const)if(row[key]&&data[key]&&row[key]!==data[key])throw Error('CSV 的册数、Test 或 Part 超出所选导入范围');let chapterId=data.chapterId;
 if(!chapterId){if(book?.key!=='CAMBRIDGE')throw Error('请选择导入章节');const volume=row.volume??data.volume,test=row.test??data.test,part=row.part??data.part;if(!volume||!test||!part)throw Error('整册或整 Test 导入需提供 volume、test、part 列以定位每一行');const c=await tx.chapter.findUnique({where:{key:`cambridge:${volume}:${test}:${part}`}});if(!c)throw Error('剑桥册数、Test 或 Part 无效');chapterId=c.id;}
 else {const c=await tx.chapter.findUniqueOrThrow({where:{id:chapterId}});if(c.volume&&((row.volume&&row.volume!==c.volume)||(row.test&&row.test!==c.test)||(row.part&&row.part!==c.part)))throw Error('CSV 行的册数、Test、Part 与所选章节冲突');}
 if(!maxima.has(chapterId)){const m=await tx.source.aggregate({where:{chapterId},_max:{originalPosition:true}});maxima.set(chapterId,(m._max.originalPosition??-1)+1);}
 const originalPosition=maxima.get(chapterId)!;maxima.set(chapterId,originalPosition+1);
 const max=await tx.source.aggregate({where:{chapterId},_max:{position:true}});const position=(max._max.position??-1)+1;
 const {volume,test,part,questionNumber,...fields}=row;
 const word=await tx.word.upsert({where:{english:row.english},create:fields,update:{}});
 await tx.source.create({data:{wordId:word.id,chapterId,meaning:row.chinese,position,originalPosition,importBatch:batch,questionNumber}});
 }
 return {imported:rows.length,batch};
 },{timeout:60000});
}
export async function reorderSources(chapterId:string,ids?:string[]){return db.$transaction(async tx=>{const sources=await tx.source.findMany({where:{chapterId},orderBy:{originalPosition:'asc'}});const order=ids??sources.map(s=>s.id);if(order.length!==sources.length||new Set(order).size!==order.length||order.some(id=>!sources.some(s=>s.id===id)))throw Error('排序必须包含此章节的全部来源行，请刷新后重试');for(const [position,id] of order.entries())await tx.source.update({where:{id},data:{position}});});}
