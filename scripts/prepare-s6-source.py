"""Prepare the surviving S6 evidence, NOT an uploadable historical archive.

Only allowlisted competition cells and C:D identity pairs are read. Formulas,
cached formula results, personal application fields, comments and links are not
evaluated or exported. No network requests or database writes are performed.
"""

import argparse
import datetime as dt
import hashlib
import json
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
RID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
TEAM_ROWS = range(3, 48, 4)


def allowed(sheet, address):
    col, row = re.fullmatch(r"([A-Z]+)(\d+)", address).groups()
    row = int(row)
    if sheet == "队伍表":
        return row in TEAM_ROWS and col in list("ABDEFGHIJ")
    if sheet == "测试表":
        return 1 <= row <= 74 and col in ["C", "D"]
    if sheet == "Cover":
        return (6 <= row <= 11 and col in list("GHIJK")) or (row in [21, 22] and col in list("BCDE"))
    if sheet == "对阵表":
        return 2 <= row <= 35 and col in list("ABCDEFGHIJKL")
    if sheet in ["小组赛图池", "队长资格赛赛图"]:
        return 2 <= row <= (24 if sheet == "小组赛图池" else 34) and col in list("BDFGHJL")
    if sheet == "教练赛赛图":
        return 2 <= row <= 8 and col in list("ABCDEG")
    if sheet in ["教练资格赛", "队长资格赛"]:
        # Never trust the zero-valued cached RANK/SUM columns.
        return 2 <= row <= (16 if sheet == "教练资格赛" else 6) and col in list("ABDFHJLN")
    return False


def read_cells(path):
    sheets = {}
    with zipfile.ZipFile(path) as z:
        strings = ["".join(x.itertext()) for x in ET.fromstring(z.read("xl/sharedStrings.xml"))]
        rels = {x.get("Id"): x.get("Target") for x in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
        for sh in ET.fromstring(z.read("xl/workbook.xml")).find("s:sheets", NS):
            name = sh.get("name")
            if name not in ["队伍表", "测试表", "Cover", "对阵表", "小组赛图池", "队长资格赛赛图", "教练赛赛图", "教练资格赛", "队长资格赛"]:
                continue
            root = ET.fromstring(z.read(posixpath.normpath("xl/" + rels[sh.get(RID)])))
            cells = {}
            for c in root.findall(".//s:sheetData/s:row/s:c", NS):
                if not allowed(name, c.get("r")) or c.find("s:f", NS) is not None:
                    continue
                raw = c.find("s:v", NS)
                if raw is None:
                    continue
                val = strings[int(raw.text)] if c.get("t") == "s" else raw.text
                if val and val.strip() and val.strip() not in ["#N/A", "#REF!", "/"]:
                    cells[c.get("r")] = val.strip()
            sheets[name] = cells
    return sheets


def prepare(path, captured_on):
    sheets = read_cells(path)

    def value(sheet, address):
        return sheets[sheet].get(address)

    def numeric(sheet, address):
        val = value(sheet, address)
        return float(val) if val is not None else None

    lookup = {}
    for row in range(1, 75):
        name, uid = value("测试表", f"C{row}"), numeric("测试表", f"D{row}")
        if name and uid is not None:
            if not uid.is_integer() or uid <= 0 or name.casefold() in lookup:
                raise ValueError("Invalid or duplicate source identity")
            lookup[name.casefold()] = (int(uid), f"测试表!C{row}:D{row}")
    teams = []
    for row, letter in zip(TEAM_ROWS, "ABCDEFGHIJKL"):
        source_letter = value("队伍表", f"A{row}")
        if source_letter not in [letter, "Ｋ" if letter == "K" else letter]:
            raise ValueError("Unexpected team order")
        members = []
        for index, col in enumerate("DEFGHIJ"):
            name = value("队伍表", f"{col}{row}")
            if not name:
                raise ValueError("Missing roster slot")
            # A numeric username is a name, never a UID.
            if col == "F" and name == "970.0":
                name = "970"
            # Organizer confirmed these exact aliases and the replacement pair
            # in the #289 source-preparation chat on 2026-10-25.
            alias = {"Inverse Lu Yang": "lnverse Lu Yang", "Re_CYCLE": "re_cyclc"}.get(name, name)
            identity = lookup.get(alias.casefold())
            expected_uid = {"Inverse Lu Yang": 3753204, "Re_CYCLE": 9043058}.get(name)
            if expected_uid and (not identity or identity[0] != expected_uid):
                raise ValueError("Changed confirmed alias requires organizer review")
            replacement = row == 43 and col == "J"
            if replacement:
                if name != "Name-Less-\nPhantoMPainN":
                    raise ValueError("Changed replacement cell requires organizer review")
                identity = None
            member = {"name": name, "role": ["captain", "vice", "coach", "player", "player", "player", "player"][index], "tier": 0 if index == 0 else index-2 if index >= 3 else None, "osuId": identity[0] if identity else None, "identitySource": identity[1] if identity else None, "source": f"队伍表!{col}{row}"}
            if alias != name:
                member["identityConfirmation"] = "Organizer confirmed alias, 2026-10-25"
            if replacement:
                if lookup["name-less-"][0] != 8425774 or lookup["phantompain"][0] != 14947596:
                    raise ValueError("Changed replacement identity requires organizer review")
                member["replacementHistory"] = [{"name": literal, "osuId": lookup[key.casefold()][0], "identitySource": lookup[key.casefold()][1]} for literal, key in [("Name-Less-", "Name-Less-"), ("PhantoMPainN", "PhantoMPaiN")]]
                member["replacementConfirmation"] = "Organizer confirmed replacement history, 2026-10-25; no dates supplied, not simultaneous roster members"
            members.append(member)
        teams.append({"id": f"team-{letter.lower()}", "sourceLabel": source_letter, "name": value("队伍表", f"B{row}"), "source": f"队伍表!A{row}:J{row}", "members": members})

    schedule, placeholders = [], []
    for row in range(2, 36):
        label = value("对阵表", f"A{row}")
        a, b = value("对阵表", f"B{row}"), value("对阵表", f"E{row}")
        if not a and not b:
            if label:
                placeholders.append({"label": label, "source": f"对阵表!A{row}"})
            continue
        if a not in "ABCDEFGHIJKL" or b not in "ABCDEFGHIJKL":
            raise ValueError("Unknown schedule team")
        serial, time = numeric("对阵表", f"F{row}"), numeric("对阵表", f"G{row}")
        local = dt.datetime(1899, 12, 30) + dt.timedelta(seconds=round((serial + time)*86400))
        # UTC+8 was explicitly confirmed by the organizer on 2026-10-25.
        scheduled = local.replace(tzinfo=dt.timezone(dt.timedelta(hours=8)))
        schedule.append({"label": label, "stage": "第一轮小组赛", "teamA": f"team-{a.lower()}", "teamB": f"team-{b.lower()}", "sourceLocalTime": local.isoformat(), "timezone": "Etc/GMT-8", "scheduledAt": scheduled.isoformat(), "dateSerial": serial, "timeFraction": time, "score": None, "mpUrls": [], "source": f"对阵表!A{row}:L{row}"})
        if any(value("对阵表", f"{col}{row}") for col in "CDHIJKL"):
            raise ValueError("New result/staff evidence requires review")

    pools = []
    for sheet, pool_id in [("小组赛图池", "gs"), ("队长资格赛赛图", "captain-qualifier"), ("教练赛赛图", "coach-qualifier")]:
        maps = []
        for row in range(2, 35 if sheet == "队长资格赛赛图" else 25 if sheet == "小组赛图池" else 9):
            coach = sheet == "教练赛赛图"
            slot = value(sheet, f"{'A' if coach else 'B'}{row}")
            if not re.fullmatch(r"(?:NM|HD|HR|DT|FM|TB)(?:[1-9]\d?)?", slot or ""):
                continue
            title = value(sheet, f"{'B' if coach else 'D'}{row}")
            uid = numeric(sheet, f"{'G' if coach else 'J'}{row}")
            if not title or uid is None:
                continue
            if not uid.is_integer() or uid <= 0:
                raise ValueError("Invalid beatmap ID")
            duration = value(sheet, f"F{row}") if not coach else None
            drain = re.fullmatch(r"\d+:\d{2} \((\d+):(\d{2}) drain\)", duration or "")
            if not coach and not drain:
                raise ValueError("Unknown source duration format")
            maps.append({"sourceSlot": slot, "slot": slot + "1" if slot in ["TB", "HD", "HR"] else slot, "beatmapId": int(uid), "title": title, "mapper": value(sheet, f"{'C' if coach else 'L'}{row}"), "stars": numeric(sheet, f"{'D' if coach else 'G'}{row}"), "bpm": numeric(sheet, f"{'E' if coach else 'H'}{row}"), "sourceLength": duration, "drainSeconds": int(drain[1])*60+int(drain[2]) if drain else None, "cs": None, "ar": None, "od": None, "source": f"{sheet}!A{row}:{'G' if coach else 'L'}{row}"})
        pools.append({"id": pool_id, "name": sheet, "maps": maps})

    qualifiers = []
    for sheet, last in [("教练资格赛", 16), ("队长资格赛", 6)]:
        records = []
        for row in range(2, last+1):
            scores = {slot: int(numeric(sheet, f"{col}{row}")) for slot, col in zip(["NM1", "NM2", "NM3", "HD1", "HR1", "DT1", "DT2"], "BDFHJLN") if value(sheet, f"{col}{row}") is not None}
            name = value(sheet, f"A{row}")
            if name == "970.0":
                name = "970"
            records.append({"name": name, "scores": scores, "rank": None, "source": f"{sheet}!A{row}:N{row}"})
        qualifiers.append({"name": sheet, "records": records})

    staff = []
    for address, position in [("G7", "Host"), ("G8", "Host"), ("I7", "Referee"), ("J7", "Streamer"), ("G11", "LOGO Inspired")]:
        name = value("Cover", address)
        identity = lookup.get(name.casefold())
        staff.append({"name": name, "position": position, "osuId": identity[0] if identity else None, "identitySource": identity[1] if identity else None, "source": f"Cover!{address}"})
    milestones = []
    for col in "BCDE":
        serial = numeric("Cover", f"{col}22")
        milestones.append({"label": value("Cover", f"{col}21"), "date": (dt.date(1899, 12, 30)+dt.timedelta(days=serial)).isoformat(), "source": f"Cover!{col}21:{col}22"})
    return {"artifactKind": "oclr-s6-source-review", "reviewVersion": 1, "importReady": False, "editionSlug": "s6", "sourceUrl": "https://github.com/OCLR-dev/OCLR-website/issues/289", "sourceFile": Path(path).name, "sourceSha256": hashlib.sha256(Path(path).read_bytes()).hexdigest(), "capturedOn": captured_on.isoformat(), "organizerConfirmations": {"date": "2026-10-25", "source": "Organizer reply in #289 source-preparation chat", "timezone": "UTC+8", "aliases": [{"sourceName": "Inverse Lu Yang", "lookupName": "lnverse Lu Yang", "osuId": 3753204}, {"sourceName": "Re_CYCLE", "lookupName": "re_cyclc", "osuId": 9043058}], "replacementCell": "队伍表!J43", "replacementNames": ["Name-Less-", "PhantoMPainN"]}, "keyVisual": {"src": "/archive/s6/key-visual.jpg", "width": 1920, "height": 1080}, "teams": teams, "milestones": milestones, "schedule": schedule, "templateLabels": placeholders, "pools": pools, "qualifiers": qualifiers, "staff": staff, "picks": [], "standings": [], "results": [], "notes": ["Source review only; do not upload this file to the archive importer.", "Knockout records and final placements are missing. All six surviving fixtures have no score or MP evidence.", "Blank team names remain null. Team letters identify source rows, not invented team names.", "VICE is preserved literally, with no inferred Tier. Final Tier columns do not establish pick chronology.", "Unmatched names keep null UIDs. Only organizer-confirmed aliases and replacement identities are resolved; numeric usernames are never treated as UIDs.", "Organizer confirmed UTC+8, two identity aliases and K Tier 4 replacement history on 2026-10-25. Replacement dates and current membership are not inferred.", "Qualifier raw scores are retained separately. Cached RANK/SUM zeros are not official standings or final placements.", "Hidden qualifier pool cells are review evidence, not approval to publish them. Coach DT values remain source values, without mod recalculation.", "Application/contact fields, biographies, discussions, comments, obsolete rosters and unrelated lookup identities are excluded."]}


def merge_pool_snapshot(data, path):
    """Merge only organizer-selected S6 tabs; never evaluate remote formulas."""
    snapshot = json.loads(path.read_text())
    expected = {"S6GS": 405667568, "S6ES": 1310799675, "S6FS": 1503362078}
    if snapshot.get("artifactKind") != "oclr-s6-pool-source-snapshot" or snapshot.get("spreadsheetId") != "14o3t0nEwp5YnRZHbjgX8OBr9tj7yeajzV5FlVIZM0Vg":
        raise ValueError("Unexpected supplementary source")
    if [s["name"] for s in snapshot["sheets"]] != list(expected):
        raise ValueError("Unexpected supplementary tabs")
    expected_slots = [*[f"NM{i}" for i in range(1, 7)], *[f"{mod}{i}" for mod in ["HD", "HR", "DT"] for i in range(1, 5)], "TB"]
    for sheet in snapshot["sheets"]:
        if sheet["sheetId"] != expected[sheet["name"]] or [m["sourceSlot"] for m in sheet["maps"]] != expected_slots:
            raise ValueError("Changed supplementary pool requires review")
        if any(type(m["beatmapId"]) is not int or m["beatmapId"] <= 0 for m in sheet["maps"]):
            raise ValueError("Invalid supplementary beatmap ID")
        if sheet["name"] == "S6GS":
            local = data["pools"][0]["maps"]
            if [(m["sourceSlot"], m["beatmapId"]) for m in local] != [(m["sourceSlot"], m["beatmapId"]) for m in sheet["maps"]]:
                raise ValueError("GS sources disagree; do not silently overwrite")
            for original, corroborating in zip(local, sheet["maps"]):
                original["corroboratingSource"] = corroborating["source"]
        else:
            maps = []
            for m in sheet["maps"]:
                maps.append({"sourceSlot": m["sourceSlot"], "slot": "TB1" if m["sourceSlot"] == "TB" else m["sourceSlot"], "beatmapId": m["beatmapId"], "title": None, "mapper": None, "stars": None, "bpm": None, "sourceLength": None, "drainSeconds": None, "cs": None, "ar": None, "od": None, "source": m["source"]})
            data["pools"].append({"id": "es" if sheet["name"] == "S6ES" else "fs", "name": sheet["name"], "sourceUrl": snapshot["sourceUrl"] + "?gid=" + str(sheet["sheetId"]), "maps": maps})
    data["supplementalPoolSource"] = {"sourceUrl": snapshot["sourceUrl"], "capturedOn": snapshot["capturedOn"], "snapshotSha256": hashlib.sha256(path.read_bytes()).hexdigest(), "sheets": [{"name": s["name"], "sheetId": s["sheetId"], "range": s["range"], "emptyTailRange": s["emptyTailRange"]} for s in snapshot["sheets"]]}
    data["notes"].append("Organizer supplied S6GS/S6ES/S6FS on 2026-10-25. GS corroborates the original 19 maps; ES and FS add 19 maps each. Formula-derived titles/statistics are loading or unavailable and remain unknown; transient observed metadata is isolated in the source snapshot, not historical statistics. Match results remain lost.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--captured-on", required=True, type=dt.date.fromisoformat)
    parser.add_argument("--pool-snapshot", type=Path)
    args = parser.parse_args()
    data = prepare(args.source, args.captured_on)
    if args.pool_snapshot:
        merge_pool_snapshot(data, args.pool_snapshot)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n")
    members = [m for t in data["teams"] for m in t["members"]]
    print(json.dumps({"teams": len(data["teams"]), "rosterSlots": len(members), "resolvedSlots": sum(m["osuId"] is not None for m in members), "unresolvedSlots": sum(m["osuId"] is None for m in members), "scheduled": len(data["schedule"]), "results": 0, "poolMaps": [len(p["maps"]) for p in data["pools"]], "importReady": False}))


if __name__ == "__main__":
    main()
