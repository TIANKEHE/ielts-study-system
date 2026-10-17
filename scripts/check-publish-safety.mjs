// Read-only staged-file audit. Does not initialize, commit, create a remote, or push.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
try{execFileSync('git',['rev-parse','--show-toplevel'],{stdio:'pipe'});}catch{console.error('当前目录不是 Git 仓库；未初始化、暂存、连接或推送。');process.exit(1);}
const files=execFileSync('git',['diff','--cached','--name-only','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const blocked=[];
for(const file of files){
 if(/(^|\/)(work|outputs|exports|backups|node_modules|\.next[^/]*)\//.test(file)||/(^|\/)\.env(?:\..*)?$/.test(file)&&!file.endsWith('.env.example')||/\.(?:db(?:[.-].*)?|sqlite3?(?:-.*)?|bak|backup|csv|tsv|jsonl|pem|key|p12|pfx)$/i.test(file)){blocked.push(file);continue;}
 try{const text=execFileSync('git',['show',':'+file],{encoding:'utf8',maxBuffer:4000000});if(/(?:sk-[A-Za-z0-9_-]{24,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text))blocked.push(file);}catch{blocked.push(file);}
}
if(blocked.length){console.error('拒绝提交以下需人工检查的文件（未输出内容）：\n'+blocked.join('\n'));process.exit(1);}
console.log(`已检查 ${files.length} 个暂存文件的敏感路径及常见密钥模式。尚未执行提交或推送；推送前仍须核对仓库 URL、可见性与推送范围。`);
