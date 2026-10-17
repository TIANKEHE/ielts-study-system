"""Upgrade the existing v1 database without resetting it. Stop the server first."""
import pathlib,sqlite3,runpy,json
root=pathlib.Path(__file__).resolve().parent.parent
runpy.run_path(str(root/'scripts/prepare-v2.py'),run_name='__main__')
con=sqlite3.connect(root/'prisma/learning.db')
if not con.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='TrainingSession'").fetchone():
 sql=(root/'scripts/migrations/v2-additive.sql').read_text()
 con.executescript('BEGIN IMMEDIATE;\n'+sql+'\nCOMMIT;')
with con:
 if not con.execute('SELECT 1 FROM DataMigration WHERE id=?',('source-progress-v2',)).fetchone():
  con.execute('''UPDATE Source SET learnedCount=MAX(learnedCount,CASE WHEN (SELECT firstLearnedAt FROM Word WHERE id=Source.wordId) IS NOT NULL THEN 1 ELSE 0 END),lastLearnedAt=COALESCE(lastLearnedAt,(SELECT lastLearnedAt FROM Word WHERE id=Source.wordId)),errorCount=MAX(errorCount,(SELECT count(*) FROM ErrorRecord WHERE sourceId=Source.id)) WHERE importBatch='legacy-v1' ''')
  con.execute('INSERT INTO DataMigration(id,details) VALUES (?,?)',('source-progress-v2','Preserved legacy source order, original IDs and progress.'))
violations=con.execute('PRAGMA foreign_key_check').fetchall()
if violations:raise RuntimeError(violations)
print('v2 additive schema verified; foreign keys valid. Next: prisma generate, build, start.')
con.close()
