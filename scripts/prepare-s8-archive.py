"""Read-only extraction of public S8 competition columns from the supplied XLSX.

Usage: python3 scripts/prepare-s8-archive.py source.xlsx output.json \
    --captured-on YYYY-MM-DD --draft-results final-roster --pool-conflicts stages
No network/DB writes. Coach applications, Reg List and social worksheets are excluded.
"""
import argparse
import datetime as dt
import json
import math
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source")
parser.add_argument("output")
parser.add_argument("--captured-on", required=True, type=dt.date.fromisoformat)
parser.add_argument("--draft-results", choices=["final-roster"], required=True,
                    help="Organizer-approved final roster plus recorded captain order")
parser.add_argument("--pool-conflicts", choices=["stages"], required=True)
args = parser.parse_args()
ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
rid = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
roster_columns = ["K", "P", "U", "Z", "AE", "AJ", "AO", "AT"]


def allowed_cell(sheet, cell):
    match = re.fullmatch(r"([A-Z]+)([1-9]\d*)", cell)
    if not match:
        return False
    col, row = match[1], int(match[2])
    if sheet == "Team":
        return row in range(8, 39, 2) and col in ["G", *roster_columns]
    if sheet == "Pick Turn":
        return row in range(2, 18) and col in list("CDEFGH")
    if sheet == "Schedule":
        return row in range(5, 43) and col in list("DEFGHIJKLMNOPQ")
    if sheet == "GroupScore":
        return row in [3, 6, 7, 8, 9, 12, 13, 14, 15, 18, 19, 20, 21, 24, 25, 26] and col in list("CDEFH")
    if sheet == "Landing":
        return cell in ["N10", "N12"]
    if sheet == "Stat List":
        return col == "C" and row in [3, 5, 7, 9]
    if sheet == "Current Mappool":
        return row in [4, *range(9, 28)] and col in ["E", "I", "J", "L", "M", "N", "O", "Q", "R", "S"]
    if sheet == "All Mappools":
        return row in [4, 31, 58, *range(9, 28), *range(36, 55), *range(63, 82), *range(92, 111)] and col in ["E", "I", "J", "L", "M", "N", "O", "Q", "R", "S"]
    return False


allowed_sheets = {"Team", "Pick Turn", "Schedule", "GroupScore", "Landing", "Stat List", "Current Mappool", "All Mappools"}
sheets = {}
with zipfile.ZipFile(args.source) as z:
    strings = ["".join(x.itertext()) for x in ET.fromstring(z.read("xl/sharedStrings.xml"))]
    rels = {x.get("Id"): x.get("Target") for x in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    for sheet in ET.fromstring(z.read("xl/workbook.xml")).find("s:sheets", ns):
        name = sheet.get("name")
        if name not in allowed_sheets:
            continue
        path = posixpath.normpath("xl/" + rels[sheet.get(rid)])
        root = ET.fromstring(z.read(path))
        cells = {}
        for c in root.findall(".//s:sheetData/s:row/s:c", ns):
            if not allowed_cell(name, c.get("r")):
                continue
            raw = c.find("s:v", ns)
            if raw is None:
                continue
            val = strings[int(raw.text)] if c.get("t") == "s" else raw.text
            cells[c.get("r")] = {"v": val}
        rp = posixpath.dirname(path) + "/_rels/" + posixpath.basename(path) + ".rels"
        links = {x.get("Id"): x.get("Target") for x in ET.fromstring(z.read(rp))} if rp in z.namelist() else {}
        for h in root.findall(".//s:hyperlink", ns):
            if allowed_cell(name, h.get("ref")):
                cells.setdefault(h.get("ref"), {})["link"] = links.get(h.get(rid), h.get("location"))
        sheets[name] = cells


def value(sheet, cell):
    v = sheets[sheet].get(cell, {}).get("v")
    assert not (v and v.startswith("#")), (sheet, cell, "Source error")
    return v if v and v.strip() and v.strip() != "\\" else None


def link(sheet, cell):
    return sheets[sheet].get(cell, {}).get("link")


def number(sheet, cell):
    v = value(sheet, cell)
    return float(v) if v is not None else None


def identity(sheet, cell):
    match = re.fullmatch(r"https://osu\.ppy\.sh/users/([1-9]\d*)(?:/osu)?", link(sheet, cell) or "")
    assert match and value(sheet, cell), (sheet, cell, "Missing identity")
    return {"osuId": int(match[1]), "username": value(sheet, cell)}


teams, players, picks, standings, matches, pools = [], [], [], [], [], []
for row in range(8, 39, 2):
    captain = identity("Team", f"K{row}")
    team_id = f"team-{captain['osuId']}"
    teams.append({"id": team_id, "name": value("Team", f"G{row}"), "source": f"Team!G{row}:AT{row}"})
    for index, col in enumerate(roster_columns):
        role = "captain" if index == 0 else "coach" if index == 1 else "player"
        tier = None if role == "coach" else 0 if role == "captain" else index-1
        players.append({**identity("Team", f"{col}{row}"), "teamId": team_id, "role": role, "tier": tier, "source": f"Team!{col}{row}"})
captains = {p["username"]: p for p in players if p["role"] == "captain"}
for round_, col in enumerate("CDEFGH", 1):
    order = [value("Pick Turn", f"{col}{row}") for row in range(2, 18)]
    assert len(set(order)) == 16 and set(order) == set(captains)
    for row, captain_name in zip(range(2, 18), order):
        team_id = captains[captain_name]["teamId"]
        player = next(p for p in players if p["teamId"] == team_id and p["role"] == "player" and p["tier"] == round_)
        # Final allocation, explicitly approved by organizer; not a pre-trade pick log.
        picks.append({"round": round_, "pick": row-1, "teamId": team_id, "osuId": player["osuId"], "source": f"Pick Turn!{col}{row}; {player['source']}"})
team_ids = {t["name"]: t["id"] for t in teams}
stage = None
invalid_vods = []
for row in range(5, 43):
    stage = value("Schedule", f"D{row}") or stage
    label = value("Schedule", f"E{row}")
    a, b = number("Schedule", f"L{row}"), number("Schedule", f"M{row}")
    assert a is not None and b is not None
    serial = number("Schedule", f"F{row}") + number("Schedule", f"G{row}")
    timestamp = dt.datetime(1899, 12, 30, tzinfo=dt.timezone(dt.timedelta(hours=8))) + dt.timedelta(seconds=round(serial*86400))
    mp = value("Schedule", f"N{row}")
    assert re.fullmatch(r"[1-9]\d*", mp or ""), (row, "Missing numeric MP ID")
    vod = value("Schedule", f"O{row}")
    if vod and not re.fullmatch(r"BV[0-9A-Za-z]+", vod):
        invalid_vods.append(f"Schedule!O{row}")
        vod = None
    bans = value("Schedule", f"P{row}")
    assert bans is None or len(bans.split("丨")) == 2, (row, "Ambiguous bans")
    red_bans, blue_bans = [part.strip() for part in bans.split("丨")] if bans else [None, None]
    matches.append({"id": f"match-{label}", "label": label, "stage": stage, "teamA": team_ids[value("Schedule", f"J{row}")], "teamB": team_ids[value("Schedule", f"K{row}")], "scheduledAt": timestamp.isoformat(), "score": [int(a), int(b)], "mpUrls": [f"https://osu.ppy.sh/community/matches/{mp}"], "vodUrl": f"https://www.bilibili.com/video/{vod}/" if vod else None, "referee": value("Schedule", f"H{row}"), "streamer": value("Schedule", f"I{row}"), "commentators": value("Schedule", f"Q{row}"), "bansA": red_bans, "bansB": blue_bans, "source": f"Schedule!D{row}:Q{row}"})
for group, rows in [("A", [3, 6, 7, 8]), ("B", [9, 12, 13, 14]), ("C", [15, 18, 19, 20]), ("D", [21, 24, 25, 26])]:
    for row in rows:
        team_id = team_ids[value("GroupScore", f"D{row}")]
        played = [m for m in matches if m["stage"] == f"Group {group}" and team_id in [m["teamA"], m["teamB"]]]
        assert len(played) == 3
        scores = [m["score"] if m["teamA"] == team_id else list(reversed(m["score"])) for m in played]
        actual = [sum(a>b for a,b in scores), sum(a<b for a,b in scores), sum(a for a,b in scores)]
        assert actual == [int(number("GroupScore", f"{col}{row}")) for col in ["E", "F", "H"]], (group, row, "Standings mismatch")
        # No numeric rank is recorded. Keep original row order; do not invent tie-breaks.
        standings.append({"group": group, "teamId": team_id, "rank": None, "wins": actual[0], "losses": actual[1], "mapsWon": actual[2], "mapsLost": sum(b for a,b in scores), "source": f"GroupScore!D{row}:H{row}; Schedule!D5:M28"})
conflicts = []
for pool_id, sheet, heading, first, last in [("gs", "All Mappools", 4, 9, 27), ("sf", "All Mappools", 31, 36, 54), ("f", "All Mappools", 58, 63, 81), ("gf", "Current Mappool", 4, 9, 27)]:
    maps = []
    for row in range(first, last+1):
        m = {"slot": value(sheet, f"E{row}"), "source": f"{sheet}!E{row}:S{row}"}
        for key, col in [("beatmapId", "L"), ("title", "I"), ("mapper", "J"), ("stars", "M"), ("bpm", "N"), ("drainSeconds", "O"), ("cs", "Q"), ("ar", "R"), ("od", "S")]:
            val = value(sheet, f"{col}{row}")
            assert val is not None, (sheet, row, key, "Missing map field")
            if pool_id == "gf":
                other = value("All Mappools", f"{col}{row+83}")
                numeric = key not in ["title", "mapper"]
                if val != other and not (numeric and other is not None and math.isclose(float(val), float(other), rel_tol=1e-8, abs_tol=1e-8)):
                    conflicts.append({"slot": m["slot"], "field": key, "stage": val, "combined": other})
            m[key] = int(float(val)) if key == "beatmapId" else val if key in ["title", "mapper"] else round(float(val)*86400, 6) if key == "drainSeconds" else float(val)
        maps.append(m)
    pools.append({"id": pool_id, "name": value(sheet, f"E{heading}").strip(), "source": f"{sheet}!E{heading}:S{last}", "maps": maps})
links = [{"label": value("Landing", f"N{row}"), "url": link("Landing", f"N{row}")} for row in [10, 12]]
links += [{"label": value("Stat List", f"C{row}"), "url": link("Stat List", f"C{row}")} for row in [3, 5, 7, 9]]
data = {"formatVersion": 1, "editionSlug": "s8", "sourceUrl": "https://docs.google.com/spreadsheets/d/16ASDCD95p3TgfjgSHCjXmRN3KJuuAD4KS0fImpcTiiM/edit", "capturedOn": args.captured_on.isoformat(), "notes": [
    "S8 歷史試算表含 16 隊、112 名隊員（含 16 名 Captain）、16 名教練；六輪選秀共 96 個最終名額。所有身分取自 Team 的原始 osu! 個人檔案連結。",
    "依主辦方選擇，以 Team 各 Tier 最終名單及 Pick Turn 隊長順序整理選秀結果；不是逐手選人時間紀錄，也不推定交換前名單。Captain 為內部 Tier 0，教練無 Tier。",
    "38 場對局均有比分與 MP ID，24 場小組賽的勝負及得圖數與 GroupScore 全部吻合。賽程為 2023-02-25 至 2023-04-09，原表時區為 UTC+8。",
    "GroupScore 未提供明確數字名次，保留來源排列並將名次設為未記錄；失圖數從同組已記錄比分加總，不推定額外排名規則。",
    "四組圖池各 19 個位置，合計 76。GF 依獨立 Current Mappool 優先，逐欄比對與 All Mappools 一致；原表摘要平均數不同，不作匯入屬性。各階段歷史屬性不以目前 API 覆寫。",
    "Schedule!O22 誤填同場 MP ID，無法作為影片 ID；此格與兩格缺少重播的紀錄均不建立重播連結。原始 MP 與比分保留。",
    "來源無獨立工作人員身分／職位表；保留逐場裁判、直播及解說署名，不從報名表、教練申請或名稱猜測工作人員 UID。",
    "Coach 申請表、Reg List、聯絡方式、自我介紹、評語、未選名單、聊天及表演賽均未匯入。不建立帳號、報名紀錄、現行職權或逐圖批准紀錄；不重算獎項。",
    "S8 原始規則書與四張圖片保留原文；沒有原始版本號，不補寫版本或當前賽事規則。",
], "links": links, "teams": teams, "players": players, "picks": picks, "staff": [], "standings": standings, "matches": matches, "pools": pools}
assert len(teams) == 16 and len(players) == 128 and len(picks) == 96 and len(matches) == 38
assert len({p['osuId'] for p in players}) == 128 and len(standings) == 16
assert sum(len(p['maps']) for p in pools) == 76
assert invalid_vods == ["Schedule!O22"]
Path(args.output).parent.mkdir(parents=True, exist_ok=True)
Path(args.output).write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n")
print(json.dumps({"teams": 16, "identities": 128, "picks": 96, "results": 38, "standings": 16, "poolSlots": 76, "staff": 0, "invalidVods": invalid_vods, "poolConflicts": conflicts}, ensure_ascii=False))
