import {db} from './db';
import {upgradeCatalog,ensureCambridgeLists,upgradeSubjectCatalog} from './catalog';
const groups=(n:number,label:string)=>Array.from({length:n},(_,i)=>`第${i+1}${label}`);
export async function initialize(){
 await db.setting.upsert({where:{id:1},create:{id:1},update:{}});
 if(await db.book.count()){await upgradeCatalog();await ensureCambridgeLists();await upgradeSubjectCatalog();return;}
 await db.$transaction(async tx=>{if(await tx.book.count())return;
 const books:[string,string,string[]][]=[['179考点词','听力',groups(6,'组')],['核心场景词','听力',['着装','个人信息','招聘','交通','旅游','工作','银行','医疗','地区','地理方位','地名','新闻报道','选课','授课','图书馆','电脑房','调查问卷','学校生活']],['同义替换','听力',groups(5,'组')],['补充词汇（72变、多一次 · 待确认）','听力',['待确认分组']],['不规则动词','听力',groups(2,'组')],['刘洪波雅思阅读词汇材料','阅读',groups(22,'章')],['新航道雅思写作语料库','写作',['教育','科技','环境','动物','旅游文化','犯罪','社会生活','家庭','国际','工作','老龄化']],['口语话题库','口语',['Part 1','Part 2','Part 3']]];
 for(const [i,[name,skill,chapters]] of books.entries())await tx.book.create({data:{name,skill,sort:i,chapters:{create:chapters.map((name,sort)=>({name,sort}))}}});
 });
 await upgradeCatalog();await ensureCambridgeLists();await upgradeSubjectCatalog();
}
