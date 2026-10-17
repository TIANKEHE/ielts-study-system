import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const source=readFileSync('prisma/schema.prisma','utf8');
const pg=source.replace('provider = "prisma-client-js"','provider = "prisma-client-js"\n output = "../../generated/postgres"\n binaryTargets = ["native", "rhel-openssl-3.0.x"]').replace('provider = "sqlite"','provider = "postgresql"').replace(' url = env("DATABASE_URL")',' url = env("DATABASE_URL")\n directUrl = env("DIRECT_URL")');
mkdirSync('prisma/postgresql',{recursive:true});
if(process.argv.includes('--check')){if(readFileSync('prisma/postgresql/schema.prisma','utf8')!==pg)throw Error('PostgreSQL schema与SQLite模型不同步');process.exit(0);}
writeFileSync('prisma/postgresql/schema.prisma',pg);
if(!process.argv.includes('--schema-only'))for(const schema of ['prisma/schema.prisma','prisma/postgresql/schema.prisma'])execFileSync(process.execPath,['node_modules/prisma/build/index.js','generate','--schema',schema],{stdio:'inherit'});
