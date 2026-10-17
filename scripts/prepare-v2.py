"""Non-destructive preflight/backfill. Run once before prisma db push, with server stopped."""
import sqlite3, pathlib, json, datetime, re
root=pathlib.Path(__file__).resolve().parent.parent
path=root/'prisma/learning.db'
con=sqlite3.connect(path)
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
backup=root/'work/v2'/('learning-before-v2-'+stamp+'.db')
backup.parent.mkdir(parents=True,exist_ok=True)
with sqlite3.connect(backup) as target:con.backup(target)
counts={t:con.execute('SELECT count(*) FROM "'+t+'"').fetchone()[0] for t in ['Word','Source','Attempt','ErrorRecord','Correction','Review','Task']}
existing={r[1] for r in con.execute('PRAGMA table_info("Source")')}
report={'backup':str(backup),'before':counts,'backfilled':0,'repairedFields':0,'excludedHeaders':0}
if 'position' not in existing:
 with con:
  for name,kind,default in [('position','INTEGER','0'),('originalPosition','INTEGER','0'),('importBatch','TEXT','NULL'),('questionNumber','TEXT','NULL'),('excluded','BOOLEAN','false')]:con.execute(f'ALTER TABLE "Source" ADD COLUMN "{name}" {kind}'+(' NOT NULL' if default!='NULL' else '')+f' DEFAULT {default}')
  for (chapter,) in con.execute('SELECT DISTINCT chapterId FROM Source').fetchall():
   for i,(sid,) in enumerate(con.execute('SELECT id FROM Source WHERE chapterId=? ORDER BY rowid',(chapter,)).fetchall()):
    con.execute('UPDATE Source SET position=?,originalPosition=?,importBatch=? WHERE id=?',(i,i,'legacy-v1',sid));report['backfilled']+=1
  headers=con.execute('SELECT s.chapterId,s.id FROM Source s JOIN Word w ON s.wordId=w.id WHERE w.english=? AND w.chinese=? AND w.ipa=? AND w.pos=?',('单词','音标','词性','词义')).fetchall()
  for chapter,sid in headers:
   con.execute('UPDATE Source SET excluded=1 WHERE id=?',(sid,));report['excludedHeaders']+=1
   for wid,english,chinese,ipa,pos in con.execute('SELECT w.id,w.english,w.chinese,w.ipa,w.pos FROM Word w JOIN Source s ON s.wordId=w.id WHERE s.chapterId=? AND s.excluded=0',(chapter,)).fetchall():
    if re.search('[\u4e00-\u9fff]',pos) and not re.search('[\u4e00-\u9fff]',chinese):
     con.execute('UPDATE Source SET meaning=? WHERE wordId=? AND chapterId=?',(pos,wid,chapter))
     if con.execute('SELECT count(*) FROM Source WHERE wordId=? AND chapterId!=?',(wid,chapter)).fetchone()[0]==0:
      con.execute('UPDATE Word SET chinese=?,ipa=?,pos=? WHERE id=?',(pos,chinese,ipa,wid));report['repairedFields']+=1
report['after']={t:con.execute('SELECT count(*) FROM "'+t+'"').fetchone()[0] for t in counts}
assert counts==report['after'],'Unexpected record count change'
(root/'work/v2/migration-preflight.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
con.close()
