import {Prisma} from '@prisma/client';
import {writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const args=process.argv.slice(2),output=args[args.indexOf('--output')+1];if(!args.includes('--output')||!output)throw Error('用法: node scripts/migration/export.mjs --output work/migration-日期');
mkdirSync('work/supabase',{recursive:true});const metadata=resolve('work/supabase/models.json');const models=Prisma.dmmf.datamodel.models.map(m=>({name:m.name,primaryKey:m.fields.find(f=>f.isId).name,fields:m.fields.filter(f=>f.kind!=='object').map(f=>({name:f.name,type:f.type,required:f.isRequired})),relations:m.fields.filter(f=>f.kind==='object'&&f.relationFromFields?.length).map(f=>({fields:f.relationFromFields,target:f.type,targetFields:f.relationToFields}))}));
writeFileSync(metadata,JSON.stringify(models));execFileSync('python3',['scripts/migration/export-sqlite.py',...args,'--metadata',metadata],{stdio:'inherit'});
