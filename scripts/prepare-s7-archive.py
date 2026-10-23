"""Extract only S7 competition data; never import application/contact columns.

python3 scripts/prepare-s7-archive.py source.xlsx output.json \
  --captured-on YYYY-MM-DD --january-year corrected-2022 --a8 forfeit
Source formulas are inspected as text and never executed. No network/DB writes.
"""
import argparse
import datetime as dt
import json
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source")
parser.add_argument("output")
parser.add_argument("--captured-on", required=True, type=dt.date.fromisoformat)
parser.add_argument("--january-year", required=True, choices=["corrected-2022", "source", "unknown"])
parser.add_argument("--a8", required=True, choices=["forfeit", "omit"])
args = parser.parse_args()
ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
rid = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def allowed(name, address):
    col, row = re.fullmatch(r"([A-Z]+)(\d+)", address).groups()
    row = int(row)
    if name == "Team List":
        return 3 <= row <= 10 and col in ["A", "B", "E", "G", "H", "I", "K", "M", "O", "Q", "S", "U"]
    if name == "测试表":
        return row <= 57 and col in ["C", "D"]
    if name == "Staff":
        return row <= 9 and col in ["A", "C"]
    if name == "对阵表":
        return row in [*range(2, 14), *range(997, 1007)] and col in list("ABCDEFGHIJKL")
    if name == "Mappools":
        return row in [*range(41, 58), *range(77, 92), *range(257, 276)] and col in list("BDEFGIJKL")
    return False


sheets = {}
with zipfile.ZipFile(args.source) as z:
    strings = ["".join(x.itertext()) for x in ET.fromstring(z.read("xl/sharedStrings.xml"))]
    rels = {x.get("Id"): x.get("Target") for x in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    for sh in ET.fromstring(z.read("xl/workbook.xml")).find("s:sheets", ns):
        name = sh.get("name")
        if name not in ["Team List", "测试表", "Staff", "对阵表", "Mappools"]:
            continue
        root = ET.fromstring(z.read(posixpath.normpath("xl/" + rels[sh.get(rid)])))
        cells = {}
        for c in root.findall(".//s:sheetData/s:row/s:c", ns):
            if not allowed(name, c.get("r")):
                continue
            raw, formula = c.find("s:v", ns), c.find("s:f", ns)
            val = strings[int(raw.text)] if raw is not None and c.get("t") == "s" else raw.text if raw is not None else None
            cells[c.get("r")] = {"v": val, "f": formula.text if formula is not None else None}
        sheets[name] = cells


def value(sheet, cell):
    v = sheets[sheet].get(cell, {}).get("v")
    return v.strip() if v and v.strip() and v.strip() != "/" else None


def number(sheet, cell):
    v = value(sheet, cell)
    return float(v) if v is not None else None


lookup = {}
for row in range(1, 58):
    name, uid = value("测试表", f"C{row}"), number("测试表", f"D{row}")
    if name and uid:
        assert name.casefold() not in lookup
        lookup[name.casefold()] = int(uid)
teams, players, matches, standings, pools, staff = [], [], [], [], [], []
for row, letter in zip(range(3, 11), "ABCDEFGH"):
    team_id = f"team-{letter.lower()}"
    teams.append({"id": team_id, "name": value("Team List", f"E{row}"), "source": f"Team List!E{row}:U{row}"})
    for index, col in enumerate(["G", "I", "K", "M", "O", "Q", "S", "U"]):
        name = value("Team List", f"{col}{row}")
        if index == 1:
            formula = sheets["Team List"][f"H{row}"]["f"]
            match = re.fullmatch(r'Image\("https://a\.ppy\.sh/([1-9]\d*)"\)', formula, re.I)
            assert match, (row, "Coach avatar UID missing")
            uid = int(match[1])
        else:
            uid = lookup[name.casefold()]
        role = "captain" if index == 0 else "coach" if index == 1 else "player"
        players.append({"osuId": uid, "username": name, "teamId": team_id, "role": role, "tier": None if index == 1 else 0 if index == 0 else index-1, "source": f"Team List!{col}{row}; " + (f"Team List!H{row}" if index == 1 else "测试表!C1:D57")})
identity_ids = {p["username"].casefold(): p["osuId"] for p in players}
for column, position in [("A", "Referee"), ("C", "Streamer")]:
    for row in range(1, 10):
        name = value("Staff", f"{column}{row}")
        if name == "110.0":
            name = "110"
        staff.append({"osuId": identity_ids.get(name.casefold()), "username": name, "position": position, "source": f"Staff!{column}{row}; 对阵表!H2:I1006"})

for row in [*range(2, 14), *range(997, 1007)]:
    label = value("对阵表", f"A{row}")
    a, b = value("对阵表", f"B{row}"), value("对阵表", f"E{row}")
    stage = ("Group A" if a in "ACEG" else "Group B") if row < 997 else "淘汰赛" if row <= 1004 else "LF" if row == 1005 else "GF"
    scores = [int(number("对阵表", f"{col}{row}")) for col in ["C", "D"]]
    forfeit = label == "A8"
    if forfeit:
        assert scores == [0, -1] and value("对阵表", f"K{row}") is None
        if args.a8 == "omit":
            continue
    serial = number("对阵表", f"F{row}") + number("对阵表", f"G{row}")
    timestamp = dt.datetime(1899, 12, 30, tzinfo=dt.timezone(dt.timedelta(hours=8))) + dt.timedelta(seconds=round(serial*86400))
    if label in ["A7", "A8", "A9", "A10"]:
        assert timestamp.year == 2021 and timestamp.month == 1
        if args.january_year == "corrected-2022":
            timestamp = timestamp.replace(year=2022)
        elif args.january_year == "unknown":
            timestamp = None
    mp = number("对阵表", f"K{row}") if not forfeit else None
    vod = value("对阵表", f"L{row}")
    assert vod is None or re.fullmatch(r"BV[0-9A-Za-z]+", vod)
    match = {"id": f"match-{label.lower()}", "label": label, "stage": stage, "teamA": f"team-{a.lower()}", "teamB": f"team-{b.lower()}", "scheduledAt": timestamp.isoformat() if timestamp else None, "score": None if forfeit else scores, "mpUrls": [f"https://osu.ppy.sh/community/matches/{int(mp)}"] if mp else [], "vodUrl": f"https://www.bilibili.com/video/{vod}/" if vod else None, "referee": value("对阵表", f"H{row}"), "streamer": value("对阵表", f"I{row}"), "commentators": value("对阵表", f"J{row}"), "bansA": None, "bansB": None, "source": f"对阵表!A{row}:L{row}"}
    if match["referee"] == "110.0":
        match["referee"] = "110"
    if forfeit:
        match["forfeitWinner"] = 0
    matches.append(match)

for row, letter in zip(range(3, 11), "ABCDEFGH"):
    team_id = f"team-{letter.lower()}"
    group = "A" if letter in "ACEG" else "B"
    played = [m for m in matches if m["stage"] == f"Group {group}" and team_id in [m["teamA"], m["teamB"]]]
    won, lost, maps_won, maps_lost = 0, 0, 0, 0
    for m in played:
        index = 0 if m["teamA"] == team_id else 1
        if m["score"] is not None:
            scores = m["score"]
            winner = 0 if scores[0] > scores[1] else 1
            maps_won += scores[index]
            maps_lost += scores[1-index]
        else:
            winner = m["forfeitWinner"]
        won += winner == index
        lost += winner != index
    expected = [int(number("Team List", f"{col}{row}")) for col in ["A", "B"]]
    assert args.a8 == "omit" or [won, lost] == expected, (letter, won, lost, expected)
    # Maps count only actually played maps, never an invented forfeit score.
    standings.append({"group": group, "teamId": team_id, "rank": None, "wins": won, "losses": lost, "mapsWon": maps_won, "mapsLost": maps_lost, "source": f"Team List!A{row}:B{row}; 对阵表!A2:E13"})

for pool_id, name, first, last in [("gs", "小组赛", 257, 275), ("sf", "淘汰赛", 77, 91), ("f", "决赛", 41, 57)]:
    maps = []
    for row in range(first, last+1):
        title = value("Mappools", f"D{row}")
        if not title:
            continue
        # The final parenthesized suffix is the source mapper, not live metadata.
        parsed = re.fullmatch(r"(.+) \(([^()]*)\)", title)
        assert parsed, (row, "Missing literal mapper suffix")
        entry = {"slot": value("Mappools", f"B{row}"), "title": parsed[1], "mapper": parsed[2], "source": f"Mappools!B{row}:L{row}"}
        for key, col in [("beatmapId", "L"), ("stars", "E"), ("bpm", "F"), ("drainSeconds", "G"), ("cs", "I"), ("ar", "J"), ("od", "K")]:
            val = number("Mappools", f"{col}{row}")
            assert val is not None, (row, key)
            entry[key] = int(val) if key == "beatmapId" else round(val*86400, 6) if key == "drainSeconds" else val
        maps.append(entry)
    pools.append({"id": pool_id, "name": name, "source": f"Mappools!B{first}:L{last}", "maps": maps})

data = {"formatVersion": 1, "editionSlug": "s7", "sourceUrl": "https://docs.google.com/spreadsheets/d/1vZ7JN6ePxDqjdVZ1527fvyeoV1m5rbHzSvXObDUuf7I/edit", "capturedOn": args.captured_on.isoformat(), "draftMode": "final-tiers", "notes": [
    "S7 共 8 隊，56 名隊員（含 8 名 Captain）及 8 名教練。隊員 UID 取自 Team List 頭像公式引用的原始測試表；教練 UID 取自原始頭像公式。保留原表姓名，僅移除尾端空白。",
    "原表只有最終 Tier 1–6 名單，沒有逐手選人或隊長選人順序；不製造選秀 pick，按最終 Tier 呈現。Captain 為 Tier 0；教練無 Tier。",
    "小組由原表 A/C/E/G 與 B/D/F/H 的各六場對局分組，對照 Team List A–H 隊伍順序及勝負欄核對。名次未記錄，保留為空。",
    f"A7/A8/A9/A10 原始年份為 2021 年 1 月；匯入日期處理：{args.january_year}。其餘保留來源時間，按 UTC+8 呈現。",
    f"A8 原值為 C 對 G 0:-1、無 MP；處理：{args.a8}。棄權不換算為一般得圖數。所有其他 21 場均保留原比分及 MP。",
    "淘汰賽在第 997–1006 列，不因中間空白列遺漏；有 2 個重播連結。僅有標籤而沒有對手或結果的模板行不匯入。",
    "三個有實際譜面的圖池共 47 張，保留 ACE1 原始槽位與歷史屬性；GS 空白 NM6/HD4/HR4/DT4 不視為已選譜面。Grand Finals 及其餘空白模板不建立虛構圖池。",
    "Staff 的裁判／直播名單與逐場欄核對。可在本表隊員／教練資料對應的 UID 才建立頭像和個人檔案連結；其餘保留原始署名、不猜 UID。這些署名不授予現行職權。",
    "Cover 為空，未提供 S7 規則書或縮略圖，不挪用其他賽季內容。選手／教練申請表、聯絡方式、評語、Damage 評分及 Chess 均不匯入。",
], "links": [], "teams": teams, "players": players, "picks": [], "staff": staff, "standings": standings, "matches": matches, "pools": pools}
assert len(teams) == 8 and len(players) == 64 and len({p["osuId"] for p in players}) == 64
assert [len(p["maps"]) for p in pools] == [15, 15, 17]
Path(args.output).parent.mkdir(parents=True, exist_ok=True)
Path(args.output).write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n")
print(json.dumps({"teams": len(teams), "identities": len(players), "scored": sum(m["score"] is not None for m in matches), "forfeits": sum("forfeitWinner" in m for m in matches), "staff": len(staff), "unresolvedStaff": sum(s["osuId"] is None for s in staff), "poolSlots": sum(len(p["maps"]) for p in pools)}, ensure_ascii=False))
