"""Read allowlisted S5 competition evidence without evaluating workbook formulas.

Outputs a source dossier, NOT an uploadable archive. Personal application fields,
comments, discarded rosters and unrelated sheets are excluded. No network/DB use.
"""

import argparse
import collections
import datetime as dt
import hashlib
import json
import posixpath
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
RID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
ROOT = Path(__file__).resolve().parents[1]
POOL_SHEETS = ["第一轮赛图", "二轮赛图数据", "季后赛R1图池", "Final 图池"]
STATS_SHEETS = ["一轮赛图数据", "二轮赛图数据", "季后赛R1图池数据", "Final图池数据"]


def allowed(name, col, row):
    if name == "队伍表":
        return row in range(3, 48, 4) and col in "ABCDEFGHIJ"
    if name == "测试表":
        return row <= 199 and col in ["C", "D"]
    if name == "对阵表":
        return 2 <= row <= 35 and col in "ABCDEFGHIJKL"
    if name in POOL_SHEETS + STATS_SHEETS:
        return 2 <= row <= 28 and col in "ABCDEFGHIJKLMNOP"
    if name == "教练赛积分":
        return 1 <= row <= 23 and col in "BCDEFGHIJKLMNOPQRST"
    if name == "Cover":
        return (6 <= row <= 11 and col in "GHIJK" and (col, row) != ("I", 9)) or (col, row) == ("I", 21)
    return False


def read_source(path):
    sheets, links, inventory = {}, {}, []
    with zipfile.ZipFile(path) as z:
        strings = ["".join(x.itertext()) for x in ET.fromstring(z.read("xl/sharedStrings.xml"))]
        rels = {x.get("Id"): x.get("Target") for x in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
        for sh in ET.fromstring(z.read("xl/workbook.xml")).find("s:sheets", NS):
            name = sh.get("name")
            target = posixpath.normpath("xl/" + rels[sh.get(RID)])
            root = ET.fromstring(z.read(target))
            inventory.append({"name": name, "state": sh.get("state", "visible"), "declaredDimension": root.find("s:dimension", NS).get("ref")})
            cells = {}
            for cell in root.findall("s:sheetData/s:row/s:c", NS):
                address = cell.get("r")
                col, row = re.fullmatch(r"([A-Z]+)(\d+)", address).groups()
                if not allowed(name, col, int(row)):
                    continue
                raw, formula = cell.find("s:v", NS), cell.find("s:f", NS)
                if raw is None:
                    continue
                value = strings[int(raw.text)] if cell.get("t") == "s" else raw.text
                if value is None or not value.strip():
                    continue
                cells[address] = {"value": value, "formula": formula.text if formula is not None else None}
            sheets[name] = cells
            relpath = posixpath.dirname(target) + "/_rels/" + posixpath.basename(target) + ".rels"
            targets = {x.get("Id"): x.get("Target") for x in ET.fromstring(z.read(relpath))} if relpath in z.namelist() else {}
            links[name] = {}
            for link in root.findall("s:hyperlinks/s:hyperlink", NS):
                address = link.get("ref")
                match = re.fullmatch(r"([A-Z]+)(\d+)", address)
                if not match or not allowed(name, match[1], int(match[2])):
                    continue
                url = targets.get(link.get(RID), "")
                if re.match(r"https://(?:osu\.ppy\.sh|old\.ppy\.sh|docs\.qq\.com)/", url):
                    links[name][address] = url
    return sheets, links, inventory


def prepare(path):
    sheets, links, inventory = read_source(path)

    def v(sheet, address):
        c = sheets.get(sheet, {}).get(address)
        return c["value"].strip() if c and c["formula"] is None else None

    identities = collections.defaultdict(list)
    for row in range(1, 200):
        name, uid = v("测试表", f"C{row}"), v("测试表", f"D{row}")
        if name and uid and uid.isdigit():
            identities[name.casefold()].append({"osuId": int(uid), "name": name, "source": f"测试表!C{row}:D{row}"})

    def identity(name):
        candidates = identities.get(name.strip().casefold(), [])
        return candidates[0] if len({c["osuId"] for c in candidates}) == 1 else None

    teams = []
    for row in range(3, 48, 4):
        letter = unicodedata.normalize("NFKC", v("队伍表", f"A{row}"))
        members = []
        for col, role in zip("CDEFGHIJ", ["Captain", "VICE", "Coach", "Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5"]):
            name = v("队伍表", f"{col}{row}")
            if name:
                members.append({"name": name, "role": role, "identity": identity(name), "source": f"队伍表!{col}{row}"})
        teams.append({"letter": letter, "sourceLetter": v("队伍表", f"A{row}"), "name": v("队伍表", f"B{row}"), "source": f"队伍表!A{row}:J{row}", "members": members})

    draft = json.loads((ROOT / "docs/imports/s5-draft-screenshot.json").read_text())
    differences = []
    for group, team in zip(draft["groups"], teams):
        group["candidateTeam"] = team["letter"]
        group["mappingBasis"] = "Matching roster members and sequential labels; not draft pick order or competition group"
        members = []
        for i, (name, elo) in enumerate(group["members"]):
            role = draft["rowRoles"][i]
            members.append({"name": name, "elo": elo, "role": role, "identity": identity(name)})
            other = next(m for m in team["members"] if m["role"] == role)
            if name.casefold() != other["name"].casefold():
                differences.append({"team": team["letter"], "role": role, "screenshotName": name, "workbookName": other["name"], "source": other["source"], "status": "workbook_selected_by_organizer", "resolution": "Use MainSheet roster per organizer, 2026-10-25; transfer/alias history not confirmed"})
        group["members"] = members
        group["computedMeanElo"] = round(sum(m["elo"] for m in members) / len(members), 6)
        group["avgEloNote"] = "Displayed AvgElo preserved; aggregation/rounding formula not supplied."

    matches = []
    for row in range(2, 36):
        source_date = (dt.datetime(1899, 12, 30) + dt.timedelta(days=float(v("对阵表", f"F{row}")))).date().isoformat()
        minutes = round(float(v("对阵表", f"G{row}")) * 1440)
        a, b = v("对阵表", f"B{row}"), v("对阵表", f"E{row}")
        mp = v("对阵表", f"K{row}")
        video = v("对阵表", f"L{row}")
        video_url = "https://www.bilibili.com/video/" + video if video and re.fullmatch(r"(?:[Bb][Vv][A-Za-z0-9]+|av\d+)", video) else None
        matches.append({"id": v("对阵表", f"A{row}"), "teamA": a[0], "teamB": b[0], "teamALiteral": a, "teamBLiteral": b, "score": [int(v("对阵表", f"C{row}")), int(v("对阵表", f"D{row}"))], "dateAsStored": source_date, "dateSerial": v("对阵表", f"F{row}"), "timeAsStored": f"{minutes // 60:02}:{minutes % 60:02}", "timeZone": None, "mpId": int(mp), "mpUrl": f"https://osu.ppy.sh/community/matches/{mp}", "referee": v("对阵表", f"H{row}"), "streamer": v("对阵表", f"I{row}"), "commentary": v("对阵表", f"J{row}"), "videoLiteral": video, "videoUrl": video_url, "source": f"对阵表!A{row}:L{row}", "status": "transcribed_not_approved", "notes": ["Stored year predates this season; 2021-01-01 is a candidate correction, not applied."] if row == 33 else []})

    pools = []
    for sheet in POOL_SHEETS:
        maps = []
        for row in range(2, 29):
            slot = v(sheet, f"B{row}")
            if not slot or not re.fullmatch(r"(?:NM|HD|HR|DT)\d+(?:\(EX\))?|TB", slot):
                continue
            title_col = "C" if sheet == "第一轮赛图" else "D"
            title_url = links[sheet].get(f"{title_col}{row}")
            link_id = re.search(r"(?:/b/|/beatmaps/|#osu/)(\d+)", title_url or "")
            bid_col = "H" if sheet == "第一轮赛图" else "J" if sheet != "二轮赛图数据" else None
            bid = v(sheet, f"{bid_col}{row}") if bid_col else None
            if bid and link_id and int(bid) != int(link_id[1]):
                raise ValueError(f"Contradicting authoritative pool IDs: {sheet}!{row}")
            selected_id = int(bid) if bid else int(link_id[1]) if link_id else None
            maps.append({"slot": slot, "title": v(sheet, f"{title_col}{row}"), "beatmapId": selected_id, "idSource": f"{sheet}!{bid_col}{row}" if bid else f"{sheet}!{title_col}{row} hyperlink", "titleUrl": title_url, "source": f"{sheet}!B{row}:P{row}", "auxiliaryC": v(sheet, f"C{row}") if title_col != "C" else None, "auxiliaryTmp": v(sheet, f"I{row}") if sheet in ["季后赛R1图池", "Final 图池"] else None, "metadata": {col: v(sheet, f"{col}{row}") for col in ("DEFGIJ" if sheet == "第一轮赛图" else "EFGHKL" if sheet != "二轮赛图数据" else "")}})
        pools.append({"sheet": sheet, "maps": maps, "note": "Unlabelled column C is not used as a beatmap ID. BID/title hyperlinks take precedence over copied auxiliary cells."})

    statistics = []
    for sheet in STATS_SHEETS:
        title_col, first = ("D", "M") if sheet in STATS_SHEETS[:2] else ("C", "L")
        for row in range(2, 29):
            slot = v(sheet, f"B{row}")
            if not slot or not re.fullmatch(r"(?:NM|HD|HR|DT)\d+(?:\(EX\))?|TB", slot):
                continue
            cols = [chr(ord(first)+i) for i in range(4)]
            statistics.append({"sheet": sheet, "slot": slot, "title": v(sheet, f"{title_col}{row}"), "times": v(sheet, f"{cols[0]}{row}"), "average": v(sheet, f"{cols[1]}{row}"), "topPlayer": v(sheet, f"{cols[2]}{row}"), "topScore": v(sheet, f"{cols[3]}{row}"), "source": f"{sheet}!{first}{row}:{cols[-1]}{row}", "status": "source_summary_not_recomputed_from_MP"})

    qualifiers = []
    for row in range(3, 24):
        name = v("教练赛积分", f"D{row}")
        scores = [{"map": v("教练赛积分", f"{col}1"), "score": int(v("教练赛积分", f"{col}{row}")) if v("教练赛积分", f"{col}{row}") is not None else None, "source": f"教练赛积分!{col}{row}"} for col in "FHJLNPR"]
        qualifiers.append({"name": name, "scores": scores, "cachedRank": sheets["教练赛积分"].get(f"E{row}"), "cachedRankSum": sheets["教练赛积分"].get(f"T{row}"), "source": f"教练赛积分!D{row}:T{row}"})
    for q in qualifiers:
        ranks = [1 + sum(other["scores"][i]["score"] > s["score"] for other in qualifiers if other["scores"][i]["score"] is not None) if s["score"] is not None else None for i, s in enumerate(q["scores"])]
        q["recomputedMapRanks"] = ranks
        q["recomputedRankSum"] = sum(ranks) if all(r is not None for r in ranks) else None
    for q in qualifiers:
        total = q["recomputedRankSum"]
        q["recomputedRank"] = 1 + sum(other["recomputedRankSum"] < total for other in qualifiers if other["recomputedRankSum"] is not None) if total is not None else None

    staff = []
    for col, role, rows in [("G", "Host", range(7, 10)), ("G", "LOGO Inspired", [11]), ("H", "Mappool", range(7, 12)), ("I", "Refer", [7, 8, 10, 11]), ("J", "Streamer", range(7, 10))]:
        for row in rows:
            name = v("Cover", f"{col}{row}")
            if name:
                staff.append({"name": name, "role": role, "source": f"Cover!{col}{row}", "identity": identity(name)})

    manifest = json.loads((ROOT / "docs/imports/s5-match-links.json").read_text())
    supplied_ids = {int(e["url"].rsplit("/", 1)[1]) for e in manifest["entries"]}
    sheet_ids = {m["mpId"] for m in matches}
    for e in manifest["entries"]:
        mid = int(e["url"].rsplit("/", 1)[1])
        e["classification"] = "matches_workbook" if mid in sheet_ids else "showcase" if "showcase" in e["label"].lower() else "coach_qualification_or_exhibition" if any(x in e["label"].lower() for x in ["coach", "教练"]) else "simulation" if "模拟赛" in e["label"] else "needs_review_not_added_to_results"

    standing = {t["letter"]: {"team": t["letter"], "wins": 0, "losses": 0, "mapsWon": 0, "mapsLost": 0} for t in teams}
    for m in matches[:24]:
        for i, key in enumerate(["teamA", "teamB"]):
            r = standing[m[key]]; own, opp = m["score"][i], m["score"][1-i]
            r["wins"] += own > opp; r["losses"] += own < opp; r["mapsWon"] += own; r["mapsLost"] += opp
    return {"kind": "historical-source-dossier-not-importable", "rosterAuthority": {"source": "MainSheet", "confirmedBy": "organizer", "confirmedOn": "2026-10-25", "note": "Roster selection does not establish alias or transfer history"}, "edition": "OCLR β（S5）", "source": {"fileName": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "issue": "https://github.com/OCLR-dev/OCLR-website/issues/288", "spreadsheet": "https://docs.google.com/spreadsheets/d/100CrQhmcX3lQ_7yn4xcP3cC316A7t35wK6kGfSW2tyM/edit", "readOn": "2026-10-25"}, "inventory": inventory, "teams": teams, "draftScreenshot": draft, "rosterDifferences": differences, "matches": matches, "pools": pools, "mapStatistics": statistics, "coachQualifier": qualifiers, "staffCredits": staff, "rulesLink": links["Cover"].get("I21"), "rulesStatus": "link_only_not_transcribed", "first24MatchTotals": {"status": "derived_totals_not_official_ranking_or_seeding", "rows": sorted(standing.values(), key=lambda x: (-x["wins"], x["team"]))}, "matchLinkReconciliation": {"entries": manifest["entries"], "workbookOnly": sorted(sheet_ids-supplied_ids), "issueOnly": sorted(supplied_ids-sheet_ids)}, "omissions": ["Personal application fields, comments and discarded lists excluded.", "Cover!I9 numeric-only referee label excluded pending identification; not assumed to be osu! UID.", "No draft chronological pick order supplied.", "Dates are stored without a confirmed timezone; F33 retains its anomalous original year.", "No official final ranking or bracket edges generated.", "No production import, publication, accounts or role grants performed."]}


def report(data):
    def table(headers, rows):
        def escape(value):
            return str(value if value is not None else "—").replace("|", "\\|").replace("\n", " ")
        return "\n".join(["| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"] + ["| " + " | ".join(escape(v) for v in row) + " |" for row in rows])

    text = ["""# OCLR β（S5）來源整理（#288）

本次依主辦者提供的 MainSheet 與選秀截圖整理，β 對應 S5。這是來源彙總，
尚未匯入、核准或公開正式站資料。表格中的操作提示不作為本次工作指令。

## 來源與範圍

- 主辦者附件：`OCLR β MainSheet.xlsx`，2026-10-25 收到；原檔保留不改寫。
- [原表連結](https://docs.google.com/spreadsheets/d/100CrQhmcX3lQ_7yn4xcP3cC316A7t35wK6kGfSW2tyM/edit)：由 [#288](https://github.com/OCLR-dev/OCLR-website/issues/288) 留言提供。本次分析以附件快照為準，未宣稱與線上最新內容完全相同。
- [選秀截圖](verification/issue-288/s5-draft-source.png)及[逐列轉錄](imports/s5-draft-screenshot.json)。Group1–12 是截圖隊伍標籤，不代表比賽分組或全局選秀先後順序。
- [結構化來源彙總](imports/s5-source-records.json)及[原始 MP 清單](imports/s5-match-links.json)。JSON 是分析資料，不是可直接上傳的歷史歸檔包。
- [重建腳本](../scripts/prepare-s5-source.py)只讀白名單競賽欄位，保留儲存格出處；不執行 Excel 公式，不保存申請自介、聯絡資料、討論、評語或廢棄名單。

## 整體盤點

| 項目 | 整理結果 |
| --- | --- |
| MainSheet | 20 個分頁；部分 declared dimension 小於實際資料範圍，按實際 cell 讀取 |
| 隊伍 | 12 隊，A–L；原表全形 `Ｋ` 正規化為 K，原字保留 |
| 選秀截圖 | 73 位：12 Captain、12 VICE、各12位 Tier 1–4、1位 Tier 5 |
| 隊伍表 | 85 個位置：73 位選手＋12 位教練；名單與截圖有差異，依主辦者指定採MainSheet，截圖另存 |
| UID | 截圖73位皆有表內直接姓名／UID對照；隊伍表70個位置可直接對照，3個隊長名稱及12位教練仍缺直接對照 |
| 對局 | 34 場皆有雙方、比分、原定日期時間、MP ID；29筆可辨識影片連結 |
| 前24場 | 每隊4場；僅彙總勝敗與局數，不以未知同分規則補出正式種子 |
| 後10場 | 表內含 WF、LF、GF；保留原標籤與比分，未生成晉級連線或最終名次 |
| 圖池 | 4組、70個slot、67張不同譜面；含EX標記 |
| 教練資格賽 | 21位、7張圖、147筆分數；逐圖名次總和與總排名重算均吻合 |
| Staff credits | Cover內16個署名／職務項，11個不同文字身分；不自動建立帳號或授權 |

對局日期主要涵蓋 2020-11-21 至 2021-01-17。`对阵表!F33` 原值為
2020-01-01，與本季及 issue 的 2021年1月 MP 標籤不一致。2021-01-01
僅列為候選更正；原日期及 Excel serial 43831 保留。時區未在附件確認，
不沿用其他 Season 的 UTC+8 確認、不產生虛構 UTC 時間。

## 隊伍與名單

以下是 MainSheet `队伍表` 的保存名單。截圖只列選手、不列教練；截圖的
Captain／VICE／Tier／Elo另存於來源 JSON，沒有把 Tier 當作全局選秀順位。
"""]
    rows = []
    for t in data["teams"]:
        by_role = {m["role"]: m["name"] for m in t["members"]}
        rows.append([t["letter"], t["name"]] + [by_role.get(role) for role in ["Captain", "VICE", "Coach", "Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5"]])
    text.append(table(["隊", "隊名", "Captain", "VICE", "教練", "T1", "T2", "T3", "T4", "T5"], rows))
    text.append("\n### 截圖與隊伍表差異\n")
    text.append(table(["隊", "位置", "截圖", "MainSheet", "儲存格"], [[d["team"], d["role"], d["screenshotName"], d["workbookName"], d["source"]] for d in data["rosterDifferences"]]))
    text.append("""
**主辦者已於2026-10-25指定以MainSheet為準。** B隊T1採Muziyami、C隊T1採
TaneshimaPopura，C隊Captain採Azureus；J／K隊長也保留表內拼寫。截圖作歷史快照
另存，不覆蓋表內名單。這項選擇不等於確認交換發生時間或改名關係。
Crystal 1 與 Azureus 的改名關係，以及 My Suck Aim／My_Suck_Aim、
moe nyannyan／moe_nyannyan 的空格／底線別名關係都先保留待確認。
姓名大小寫與兩端空格可作直接比對；不依相似拼字、自介或其他季資料合併 UID。

`[1552828]` 是原始名稱，`测试表!C41:D41` 的 UID 為 **8208288**。
Crystal 1 的直接來源是 UID11237954；不可因教練名單有 Crystal 而合併身分。
12 位教練暫保留文字名，不藉個人介紹推測 UID。

### 截圖 Elo

平均值是依截圖個人 Elo 重算的檢查值，原顯示值另行保存；不以當前 Elo 覆寫歷史資料。
""")
    text.append(table(["截圖隊伍", "顯示 AvgElo", "重算平均", "人數"], [[g["group"], g["avgElo"], g["computedMeanElo"], len(g["members"])] for g in data["draftScreenshot"]["groups"]]))
    text.append("\n## 對局總表\n\n以下均為表內比分轉錄，未讀取逐局 MP 來裁定重打、娛樂盤或技術判分。0比分不自動解釋為棄權。時間為原表牆上時間，時區待確認。\n")
    text.append(table(["場次", "對局", "比分", "原表日期", "時間", "MP", "來源列"], [[m["id"], m["teamA"]+"–"+m["teamB"], ":".join(map(str,m["score"])), m["dateAsStored"]+("（年份異常）" if m["notes"] else ""), m["timeAsStored"], f"[{m['mpId']}]({m['mpUrl']})", m["source"]] for m in data["matches"]]))
    text.append("\n### 前24場統計\n\n按勝場降序、同勝場按隊字母列示；**不是正式排名或種子順序**。來源为 `对阵表!A2:L25`。\n")
    text.append(table(["隊", "勝", "敗", "得局", "失局", "淨局"], [[r["team"],r["wins"],r["losses"],r["mapsWon"],r["mapsLost"],r["mapsWon"]-r["mapsLost"]] for r in data["first24MatchTotals"]["rows"]]))
    text.append("""
### MP 清單對照

Issue 提供47個不同MP，32個與表格匹配。附件另外補足：

- F–I，0:5，2020-11-28：[70607908](https://osu.ppy.sh/community/matches/70607908)，`对阵表!A8:L8`。
- B–E，6:0，2020-12-20：[71900819](https://osu.ppy.sh/community/matches/71900819)，`对阵表!A26:L26`。

Issue另有4場Showcase、4場教練資格／展示性房間、1場明確標示模擬賽，均不併入正式賽果。
其餘6場保留待查，包括額外B–E的70393378、3場Explosive相關房間及2場Team A–Team B。
只按房名作初步分類，不宣稱已查閱或排除各MP的實際逐局內容。來源聯集共49個MP。

`GF` 記載 G 7:4 I；沒有另外的最終名次表或已核對的完整規則，不直接生成正式冠軍／名次。

## 圖池與統計

保留完整slot／曲名／難度／可用metadata／EX標記／來源出處。第二輪圖池可由
`二轮赛图数据` 曲名超連結恢復16張譜面，不因缺少專用圖池分頁而丟棄。
""")
    text.append(table(["來源分頁", "slot數", "ID來源"], [[p["sheet"],len(p["maps"]),"H欄BID＋曲名連結" if i==0 else "D欄曲名超連結" if i==1 else "J欄BID＋D欄曲名連結"] for i,p in enumerate(data["pools"])]))
    text.append("""
- 多張表的無標題C欄沿用相同16個數字，與對應曲名不一致，**不採作BID**。
- `季后赛R1图池!J16` BID為2744118，D16曲名連結亦指向2744118；I16的tmp連結卻是2428725。採前兩者為本次整理值，仍保留tmp差異。
- Final的NM6／HD4／HR4與季後賽R1相同（2240700／2278245／556151）。保留為來源中的重複slot，不擅自認定是模板殘留或刪除。
- 四份圖池統計共70行，保存Times／Avg／Top Player／Top Score。它們是來源彙總，未用MP逐局重算，不與官方全季選手Rating混為一談。

## 教練資格賽

`教练赛积分!D3:T23` 共21位、7張圖。按各圖分數降序競賽排名（同分同名次），
再將7圖名次相加、以總和升序排名，與表內21組快取總和／總名次完全一致。
這是獨立重算，沒有將其他分頁的快取0視為有效身份或資料。
""")
    text.append(table(["名次", "教練", "名次總和"], [[q["recomputedRank"],q["name"],q["recomputedRankSum"]] for q in sorted(data["coachQualifier"],key=lambda x:x["recomputedRank"])]))
    text.append("\n## 工作人員與規則\n")
    text.append(table(["原始職務", "署名", "出處"], [[r["role"],r["name"],r["source"]] for r in data["staffCredits"]]))
    text.append("""
對陣表的裁判／直播／解說原文另外逐場保存，`none`、`无人直播`、`没录`等
保持原始含義；多人解說的空格／頓號不強行拆成未核對的身分。
Cover!I9是純數字項，不能確認是公開名稱還是聯絡方式，暫不輸出其值或當成UID。

[S5規則連結](https://docs.qq.com/doc/DRU92Zm1JbGFFSEdq)來自Cover!I21。
本次嘗試讀取未成功，故只保存連結，尚無規則原文轉錄；不套用S6規則。
原檔中的廢棄表、申請私人欄位、遊戲頁及模擬賽排程不進入賽事資料彙總。

## 待確認與後續

1. 名單已按主辦者指示採MainSheet；選秀後交換的歷史與Crystal 1／Azureus同人關係仍未確認，但不阻擋名單轉錄。
2. J／K隊長空格與底線名稱的別名關係；12位教練及Staff UID可靠來源。
3. 本季時區；F33是否應改為2021-01-01。
4. S5完整規則原文、晉級／同分／總決賽規則，及是否有另存正式排名。
5. 未匹配MP的用途與逐局核對，以及三張跨池重複圖是否為實際保留。

本次整理不生成雙敗bracket連線。跨Season繪線問題另由#324跟蹤。
需要正式導入時，再按已確認來源產生相容匯入包，經管理介面覆核與授權發布。

## 重現與核對

```sh
python3 scripts/prepare-s5-source.py '/path/to/OCLR β MainSheet.xlsx'
```

本次已核對隊伍／人數／角色、唯一MP、每隊前段4場、所有70個slot的BID來源、
圖池統計行數與21組資格賽重算；不聲稱已取得MP逐局、正式導入或完成線上驗收。
腳本不讀取本機環境憑據、不連網、不寫資料庫。原表SHA256記錄在來源JSON。
""")
    return "\n".join(text).strip() + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "docs/imports/s5-source-records.json")
    parser.add_argument("--report", type=Path, default=ROOT / "docs/s5-archive.md")
    args = parser.parse_args()
    result = prepare(args.workbook)
    assert len(result["teams"]) == 12
    assert sum(len(t["members"]) for t in result["teams"]) == 85
    assert sum(len(g["members"]) for g in result["draftScreenshot"]["groups"]) == 73
    assert len(result["matches"]) == len({m["mpId"] for m in result["matches"]}) == 34
    assert [len(p["maps"]) for p in result["pools"]] == [16, 16, 19, 19]
    assert all(m["beatmapId"] for p in result["pools"] for m in p["maps"])
    assert all(r["wins"] + r["losses"] == 4 for r in result["first24MatchTotals"]["rows"])
    assert len(result["coachQualifier"]) == 21
    assert all(q["recomputedRank"] == int(q["cachedRank"]["value"]) and q["recomputedRankSum"] == int(q["cachedRankSum"]["value"]) for q in result["coachQualifier"])
    assert len(result["mapStatistics"]) == 70
    assert len(result["matchLinkReconciliation"]["entries"]) == 47
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    args.report.write_text(report(result))
    print(json.dumps({"teams": 12, "members": 85, "draftMembers": 73, "matches": 34, "pools": 4, "mapSlots": 70, "rosterDifferences": result["rosterDifferences"], "workbookOnlyMPs": result["matchLinkReconciliation"]["workbookOnly"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
