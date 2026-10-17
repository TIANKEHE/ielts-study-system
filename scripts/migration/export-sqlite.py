"""Read-only, consistent SQLite snapshot and streamed private migration dataset."""
import argparse,sqlite3,pathlib,datetime,json,hashlib,os,gzip
p=argparse.ArgumentParser();p.add_argument('--source',default='prisma/learning.db');p.add_argument('--output',required=True);p.add_argument('--metadata',required=True);a=p.parse_args()
source=pathlib.Path(a.source).resolve();output=pathlib.Path(a.output).resolve()
if output.exists():raise SystemExit('输出目录已存在；拒绝覆盖备份')
if not source.is_file():raise SystemExit('SQLite源文件不存在')
output.mkdir(parents=True,mode=0o700)
backup=output/'source.db.gz'
con=sqlite3.connect(':memory:')
if source.name.endswith('.gz'):
 with gzip.open(source,'rb') as f:con.deserialize(f.read())
else:
 original=sqlite3.connect('file:'+str(source)+'?mode=ro',uri=True);original.backup(con);original.close()
image=con.serialize();source_hash=hashlib.sha256(image).hexdigest()
with gzip.open(backup,'wb',compresslevel=6) as out:out.write(image)
del image
os.chmod(backup,0o600);con.row_factory=sqlite3.Row
if con.execute('PRAGMA integrity_check').fetchone()[0]!='ok' or con.execute('PRAGMA foreign_key_check').fetchall():raise SystemExit('SQLite完整性/外键检查失败')
metadata=json.loads(pathlib.Path(a.metadata).read_text());manifest={'format':1,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256':source_hash,'tables':{},'models':metadata}
for model in metadata:
 name=model['name'];columns={row[1] for row in con.execute('PRAGMA table_info("'+name+'")')};fields=model['fields']
 if set(f['name'] for f in fields)!=columns:raise SystemExit(name+'结构与代码不一致，请先检查本地版本，未修改源库')
 digest=hashlib.sha256();count=0;file=output/(name+'.jsonl.gz')
 with gzip.open(file,'wt',encoding='utf-8',newline='') as out:
  for row in con.execute('SELECT * FROM "'+name+'" ORDER BY "'+model['primaryKey']+'"'):
   data=dict(row)
   for f in fields:
    value=data[f['name']]
    if value is None:continue
    if f['type']=='DateTime':
     dt=datetime.datetime.fromtimestamp(value/1000,datetime.timezone.utc) if isinstance(value,(int,float)) else datetime.datetime.fromisoformat(str(value).replace('Z','+00:00'))
     if dt.tzinfo is None:dt=dt.replace(tzinfo=datetime.timezone.utc)
     data[f['name']]=dt.astimezone(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
    elif f['type']=='Boolean':data[f['name']]=bool(value)
    elif f['type']=='Float' and isinstance(value,float) and value.is_integer():data[f['name']]=int(value)
   line=json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n';out.write(line);digest.update(line.encode());count+=1
 os.chmod(file,0o600);manifest['tables'][name]={'count':count,'file':file.name,'sha256':digest.hexdigest()}
(output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));os.chmod(output/'manifest.json',0o600)
print(json.dumps({'dataset':str(output),'tables':{k:v['count'] for k,v in manifest['tables'].items()},'integrity':'ok'},ensure_ascii=False))
