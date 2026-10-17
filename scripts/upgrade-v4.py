"""Add source first-completion timestamp without resetting or rebuilding SQLite."""
import sqlite3,datetime,pathlib,json
root=pathlib.Path(__file__).resolve().parent.parent
folder=root/'work'/'structure';folder.mkdir(parents=True,exist_ok=True)
source=sqlite3.connect(root/'prisma'/'learning.db')
backup=folder/('before-v4-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.db')
source.backup(sqlite3.connect(backup))
columns=[row[1] for row in source.execute('PRAGMA table_info(Source)')]
if 'firstLearnedAt' not in columns:source.execute('ALTER TABLE Source ADD COLUMN firstLearnedAt DATETIME')
source.commit();source.close()
print(json.dumps({'backup':str(backup),'change':'Source.firstLearnedAt added if absent; no data deleted'},ensure_ascii=False))
