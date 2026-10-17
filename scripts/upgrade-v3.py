"""Add kyes timer, review grouping and preferences without replacing any data."""
import sqlite3,pathlib,datetime,json
root=pathlib.Path(__file__).resolve().parent.parent
path=root/'prisma/learning.db'
con=sqlite3.connect(path,timeout=30)
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
backup=root/'work/v3'/('before-v3-'+stamp+'.db');backup.parent.mkdir(parents=True,exist_ok=True)
with sqlite3.connect(backup) as target:con.backup(target)
ids={t:[r[0] for r in con.execute('SELECT id FROM "'+t+'"')] for t in ['Word','Source','Attempt','ErrorRecord','Review','Correction','TrainingSession','Task','Chapter','Book']}
positions=con.execute('SELECT id,wordId,chapterId,position,originalPosition FROM Source ORDER BY id').fetchall()
if 'budgetMinutes' not in {r[1] for r in con.execute('PRAGMA table_info(Setting)')}:
 con.executescript('BEGIN IMMEDIATE;\n'+(root/'scripts/migrations/v3-additive.sql').read_text()+'\nCOMMIT;')
for table,keys in ids.items():assert set(keys)<={r[0] for r in con.execute('SELECT id FROM "'+table+'"')},table
assert positions==con.execute('SELECT id,wordId,chapterId,position,originalPosition FROM Source ORDER BY id').fetchall()
assert not con.execute('PRAGMA foreign_key_check').fetchall()
report={'backup':str(backup),'retainedIds':{k:len(v) for k,v in ids.items()},'sourcePositionsUnchanged':True}
(root/'work/v3/migration-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False));con.close()
