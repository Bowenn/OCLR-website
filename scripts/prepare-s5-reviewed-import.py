"""Attach MP-evidenced colors to MainSheet scores; never pre-approve results."""
import collections
import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
d=root/'docs/imports'
a=json.loads((d/'s5-archive.json').read_text())
s=json.loads((d/'s5-source-records.json').read_text())
r=json.loads((d/'s5-match-source-snapshot.json').read_text())
known={p['osuId']:p['teamId'] for p in a['players']}
pool_ids={m['beatmapId'] for p in a['pools'][:4] for m in p['maps']}
raw={m['id']:m for m in r['matches']}
evidence=[]
for m,source in zip(a['matches'],s['matches'],strict=True):
    mp=raw[source['mpId']]
    assert mp['complete'] and m['id']==source['id'].lower() and m['mpUrls']==[mp['url']]
    games=[g for g in mp['games'] if g['endTime'] and g['beatmapId'] in pool_ids]
    sides={}
    detail={}
    for color in ['red','blue']:
        scores=[p for g in games for p in g['scores'] if p['team']==color and p['score']>0 and p['osuId'] in known]
        votes=collections.Counter(known[p['osuId']] for p in scores)
        assert len(votes)==1, (m['id'],color,votes)
        sides[color]=next(iter(votes))
        assert sides[color] in [m['teamA'],m['teamB']]
        detail[color]={'teamId':sides[color],'positiveScoreOccurrences':dict(votes),'supportingUids':sorted({p['osuId'] for p in scores})}
    assert sides['red']!=sides['blue']
    note='比分依 MainSheet；紅藍隊由原始 MP 比賽圖池內完整對局的已知 UID 核對。rawScore 未重算，games 留空不代表原房無遊戲，逐局來源保留於獨立 MP 快照。此紀錄等待管理介面核准。'
    m['review']=dict(status='pending',workingScore=source['score'],rawScore=None,possibleScore=None,note=note,
        startedAt=mp['startTime'],redTeamId=sides['red'],blueTeamId=sides['blue'],games=[])
    m['roomOpenedAt']=mp['startTime']
    evidence.append(dict(matchId=m['id'],mpUrl=mp['url'],source=source['source'],score=source['score'],sides=detail,
        evidenceGameIds=[g['id'] for g in games]))
a['notes'][1]='34 場比分依 MainSheet 待管理介面核准；紅藍隊已由原始 MP 已知 UID 核對。原表時間的時區仍未知，scheduledAt 留空；MP 開房 UTC 時間另存。'
a['links'].append(dict(label='S5 原始 MP 快照與紅藍隊核對',url='https://github.com/OCLR-dev/OCLR-website/tree/codex/issue-288-s5-sources/docs/imports'))
a['sourceFacts'].append(dict(category='review',label='MP 紅藍隊核對與比分依據',source='34 場原始 MP／MainSheet',text='34 場原始 MP 均完整取得；已知 UID 在比賽圖池內完整對局的紅藍隊歸屬均無跨隊衝突。A6、A8、A16、A26 紅藍順序與 MainSheet 左右欄相反；workingScore 一律按 MainSheet teamA／teamB 順序，不按紅藍順序。比分採主辦者指定 MainSheet；未將暖身、重打或 MP 單局勝數重新判為賽果。'))
(d/'s5-reviewed-import.json').write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n')
(d/'s5-match-side-evidence.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
print({'matches':len(evidence),'rawGames':sum(len(m['games']) for m in r['matches']),'reversed':[m['id'] for m in a['matches'] if m['teamA']!=m['review']['redTeamId']]})
