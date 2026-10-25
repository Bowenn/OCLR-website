"""Reconstruct S6 source tables without approving or publishing any result.

python3 scripts/reconstruct-s6-matches.py snapshot.json roster.json pools.json rules.json output.json
Complete pooled games are summed by provider red/blue sides. A separate,
explicit hypothesis uses the last completed attempt for a repeated beatmap.
"""

import argparse
from collections import Counter
import datetime as dt
import hashlib
import json
from pathlib import Path
import re


def game_result(game):
    totals = {color: sum(s["score"] for s in game["scores"] if s["team"] == color) for color in ["red", "blue"]}
    failed = {}
    for color in totals:
        scores = [s for s in game["scores"] if s["team"] == color]
        if not scores or any(type(s.get("passed")) is not bool for s in scores):
            raise ValueError("Missing source pass flags; Team Fail cannot be verified")
        failed[color] = not any(s["passed"] for s in scores)
    if all(failed.values()):
        raise ValueError("Both teams failed; adjudication required")
    if any(failed.values()):
        winner = next(color for color in failed if not failed[color])
    elif totals["red"] == totals["blue"]:
        raise ValueError("Completed game has tied totals; review required")
    else:
        winner = max(totals, key=totals.get)
    return {"totals": totals, "teamFail": failed, "winningColor": winner}


def score_games(games):
    wins = {"red": 0, "blue": 0}
    for game in games:
        wins[game_result(game)["winningColor"]] += 1
    return wins


def source_labels(name):
    labels = re.findall(r"\(([^()]*)\)", name)
    if len(labels) != 2:
        raise ValueError("Unrecognized match title")
    return [label.strip() for label in labels]


def apply_provisional_interpretations(matches, snapshot):
    """Organizer-requested working hypotheses; never historical acceptance."""
    lookup = {m["id"]: m for m in matches}
    sources = {m["id"]: m for m in snapshot["matches"]}
    di = lookup[84398168]
    selected = [g for g in di["gameReview"] if g["disposition"] == "selected-under-last-completed-attempt-hypothesis"]
    tb = selected[-1]
    before = {color: sum(g["winningColor"] == color for g in selected[:-1]) for color in ["red", "blue"]}
    if di["reconstructedScore"] != [3, 6] or before != {"red": 3, "blue": 5} or any(g["positivePlayers"] != {"red": 3, "blue": 3} for g in selected[:-1]) or tb["gameId"] != 432260817 or tb["beatmapId"] != 2968871 or tb["positivePlayers"] != {"red": 5, "blue": 5}:
        raise ValueError("Changed D-I evidence requires provisional-treatment review")
    tb["disposition"] = "post-match-entertainment-pending-confirmation"
    tb["interpretationStatus"] = "pending-confirmation"
    di["reconstructedScore"] = [3, 5]
    di["scoreNotes"] = ["Working hypothesis requested by organizer, pending confirmation: D-I ended 3:5 at BO9; the later five-versus-five TB is post-match entertainment. Raw room totals remain 3:6; use of the ES pool remains unexplained."]
    di["provisionalInterpretation"] = {
        "status": "pending-confirmation",
        "recordedOn": "2026-10-25",
        "authority": "Organizer requested provisional documentation, not historical result acceptance",
        "workingScore": [3, 5],
        "rawRoomScore": [3, 6],
        "swissRoundCandidate": 4,
        "seriesEndCandidate": selected[-2]["endTime"],
        "postMatchGameId": tb["gameId"],
        "postMatchGameStartedAt": tb["startTime"],
        "postMatchGameEndedAt": tb["endTime"],
        "postMatchTreatment": "entertainment-excluded-from-working-series-and-standings",
        "evidence": ["Eight preceding completed pool games give D 3:5 I, reaching BO9", "The later TB has five nonzero scorers per side, rather than three on each preceding pool game", "The pairing fills the fourth chronological Swiss batch"],
        "unresolved": ["No contemporary referee or organizer ruling supplied", "Why this Swiss candidate used ES instead of GS is unknown"]
    }
    cf = lookup[85503945]
    source = sources[85503945]
    hd2 = next(g for g in source["games"] if g["id"] == 437459269)
    following = next(g for g in source["games"] if g["id"] == 437462597)
    if cf["reconstructedScore"] != [2, 5] or hd2["endTime"] is not None or hd2["scores"]:
        raise ValueError("Changed C-F evidence requires provisional-treatment review")
    cf["scoreNotes"] = ["Completed in-pool games remain C 2:5 F. No sixth F point is evidenced. Working hypothesis, pending confirmation: HD2 may have an unrecorded F win from lost settlement or adjudication, making the actual match 2:6. No extra played game, player score, forfeit or penalty is invented."]
    last = next(g for g in reversed(source["games"]) if g["endTime"] is not None)
    cf["provisionalInterpretation"] = {
        "status": "pending-confirmation",
        "recordedOn": "2026-10-25",
        "authority": "Organizer requested provisional documentation, not historical result acceptance",
        "recordedPlayedScore": [2, 5],
        "possibleOfficialScore": [2, 6],
        "possibleUnrecordedWinFor": "team-f",
        "unsettledGameId": hd2["id"],
        "unsettledBeatmapId": hd2["beatmapId"],
        "unsettledPoolSlot": "HD2",
        "unsettledGameStartedAt": hd2["startTime"],
        "unsettledGameEndTime": None,
        "unsettledGameScoreCount": 0,
        "nextGameStartedAt": following["startTime"],
        "roomClosedSecondsAfterLastCompletedGame": int((dt.datetime.fromisoformat(source["endTime"])-dt.datetime.fromisoformat(last["endTime"])).total_seconds()),
        "basis": "One unrecorded HD2 point for F would reconcile BO11 with the room ending and F's later B-F appearance",
        "unresolved": ["No evidence proves an HD2 win or referee award", "Lost settlement, adjudication, a local BO9 change or an early ending cannot be distinguished from the MP alone"]
    }


def apply_rule_structure(data, rules):
    """Keep rule-grounded bracket deductions separate from recorded matches."""
    lookup = {m["id"]: m for m in data["matches"]}
    upper = {s["teamId"] for s in data["standingsStrictGsPool"] if s["wins"] >= 3}
    playoff = {team for mid in data["knockoutRecordedMatchIds"] for team in [lookup[mid]["teamA"], lookup[mid]["teamB"]]}
    lower = playoff - upper
    if len(upper) != 4 or len(lower) != 4:
        raise ValueError("Standings do not establish four upper and four lower entrants")
    expected = {84896923: ({"team-a", "team-f"}, "team-f"), 84972689: ({"team-b", "team-g"}, "team-g"), 85044339: ({"team-e", "team-h"}, "team-e"), 85172398: ({"team-j", "team-c"}, "team-j"), 85439390: ({"team-b", "team-e"}, "team-b"), 85503945: ({"team-c", "team-f"}, "team-f"), 85546490: ({"team-b", "team-f"}, "team-b"), 86302764: ({"team-j", "team-b"}, "team-b"), 86362224: ({"team-g", "team-b"}, "team-b")}
    for mid, (pair, winner) in expected.items():
        if {lookup[mid]["teamA"], lookup[mid]["teamB"]} != pair or lookup[mid]["winner"] != winner:
            raise ValueError("Changed playoff evidence requires a new bracket review")
    later_roles = {85439390: "lower-round-2", 85503945: "lower-round-2", 85546490: "lower-round-3", 86302764: "lower-final", 86362224: "grand-final"}
    for match in data["matches"]:
        if match["id"] == 84398168:
            role, best_of = "swiss-provisional", rules["preliminary"]["bestOf"]
        elif match["pool"] == "S6GS":
            role, best_of = "swiss", rules["preliminary"]["bestOf"]
        elif match["id"] in later_roles:
            role = later_roles[match["id"]]
            best_of = rules["knockout"]["lowerFinalAndGrandFinalBestOf"] if role in ["lower-final", "grand-final"] else rules["knockout"]["bestOf"]
        elif {match["teamA"], match["teamB"]} <= upper:
            role, best_of = "upper-semifinal", rules["knockout"]["bestOf"]
        elif {match["teamA"], match["teamB"]} <= lower:
            role, best_of = "lower-round-1", rules["knockout"]["bestOf"]
        else:
            raise ValueError("Unresolved knockout opening role")
        match["stageClassification"] = {"role": role, "bestOf": best_of, "status": "rules-and-records-reconstruction-not-official-acceptance"}
        if match["id"] == 84398168:
            match["stageClassification"]["status"] = "pending-confirmation"
        if best_of and max(match["reconstructedScore"]) != (best_of+1)//2:
            match["scoreNotes"].append(f"Recorded completed wins do not reach the rulebook BO{best_of} target; official match score remains unknown.")
    for i, batch in enumerate(data["preliminaryBatches"], 1):
        batch["status"] = "rule-confirmed-swiss-format-reconstructed-round-batch" if i < 4 else "provisional-swiss-round-4-DI-post-match-TB-excluded-pending-confirmation"
    data["ruleSource"] = {"sourceUrl": rules["sourceUrl"], "title": rules["title"], "capturedOn": rules["capturedOn"]}
    data["bracketDeductions"] = {
        "status": "rules-grounded-reconstruction-awaiting-review",
        "upperEntrants": sorted(upper),
        "lowerEntrants": sorted(lower),
        "firstSeedSelectionRights": {"upper": True, "lower": True},
        "exactSeeds": None,
        "missingUpperFinal": {"teamA": "team-g", "teamB": "team-j", "winner": "team-g", "score": None, "mpUrls": [], "playedAt": None, "status": "structurally-inferred-source-not-found", "basis": "G and J win the two upper semifinals; J later meets B in the lower final, G meets its winner in the grand final. One missing upper-final record connects these paths."},
        "conditionalPlacements": [{"rank": 1, "teams": ["team-b"]}, {"rank": 2, "teams": ["team-g"]}, {"rank": 3, "teams": ["team-j"]}, {"rank": 4, "teams": ["team-f"]}, {"rankRange": [5, 6], "teams": ["team-c", "team-e"]}, {"rankRange": [7, 8], "teams": ["team-a", "team-h"]}],
        "placementConditions": ["Organizer accepts the four completed-replay rulings", "Grand final is the actual tournament endpoint with no unprovided reset or later adjudication", "C-F played 2:5 versus possible official 2:6 is resolved; no missing sixth point is invented"],
        "nonAdvancingCandidates": ["team-d", "team-i", "team-k", "team-l"]
    }
    data["notes"] = [
        "The supplied rulebook confirms four Swiss rounds, 12 into 8, BO9, four entrants starting upper and four starting lower; the struck-through two-group proposal is obsolete.",
        "Raw Score v1 plus Team Fail loss is applied. Extra changes permitted lineups, not the score multiplier.",
        "One Team Fail is evidenced (D-I game 432255879, blue side); applying it does not change the raw-score winner of that game or any reconstructed match score.",
        "All scores remain reconstructions, not approved historical results. Four completed replays require actual referee rulings.",
        "The third standings criterion is preserved as the source term 净胜场. No exact tied seed order is fabricated.",
        "D-I provisionally uses a 3:5 Swiss score with the final five-versus-five TB excluded as post-match entertainment. This remains pending confirmation; raw room totals stay 3:6 and the ES pool exception is unexplained.",
        "C-F preserves played 2:5. A missing HD2 F point and possible actual 2:6 are a pending-confirmation hypothesis only, not an invented played result or accepted official score.",
        "The only structural missing playoff fixture is G-J upper final. Its winner G is inferred from later branch appearances; date, source MP and score remain unknown.",
        "The rulebook gives planned dates; actual MP dates include postponements. Planned dates do not overwrite source lobby timestamps.",
        "No final reset or upper-side advantage clause is stated; official final placements remain empty pending acceptance.",
        "Cross-team roster appearances and missing adjudications do not authorize editing the original roster or manufacturing violations."
    ]
    return data


def reconstruct(snapshot, roster, pools, rules):
    if rules.get("artifactKind") != "oclr-s6-rule-facts" or rules["preliminary"]["format"] != "swiss" or rules["knockout"]["upperEntrants"] != 4 or rules["knockout"]["lowerEntrants"] != 4:
        raise ValueError("Unexpected rule facts require review")
    known = {}
    for team in roster["teams"]:
        for member in team["members"]:
            for person in [member, *member.get("replacementHistory", [])]:
                if person["osuId"] is not None:
                    if person["osuId"] in known and known[person["osuId"]] != team["id"]:
                        raise ValueError("Conflicting roster UID")
                    known[person["osuId"]] = team["id"]
    pool_lookup = {}
    for sheet in pools["sheets"]:
        for entry in sheet["maps"]:
            if entry["beatmapId"] in pool_lookup:
                raise ValueError("Cross-pool beatmap requires explicit review")
            pool_lookup[entry["beatmapId"]] = (sheet["name"], entry["sourceSlot"])
    aliases = {t["name"]: t["id"] for t in roster["teams"] if t["name"]}
    alias_evidence = {t["name"]: [t["source"]] for t in roster["teams"] if t["name"]}
    matches = []
    excluded_matches = []
    for match in sorted(snapshot["matches"], key=lambda m: (m["startTime"], m["id"])):
        if re.search(r"showcase|mappool|mapool|qualifi|captain|coach|测试|资格|教练|队长赛", match["name"], re.I):
            excluded_matches.append({"id": match["id"], "name": match["name"], "reason": "qualifier-test-or-showcase"})
            continue
        if not match["complete"] or not match["endTime"]:
            raise ValueError("Incomplete match source")
        if not match["startTime"].startswith("2021-"):
            raise ValueError("Wrong-year source must not enter S6")
        games = match["games"]
        if len({g["id"] for g in games}) != len(games):
            raise ValueError("Duplicate game ID")
        pooled = [g for g in games if g["beatmapId"] in pool_lookup]
        if len({pool_lookup[g["beatmapId"]][0] for g in pooled}) != 1:
            raise ValueError("Mixed or missing stage-pool evidence")
        pool = pool_lookup[pooled[0]["beatmapId"]][0]
        complete = [g for g in pooled if g["endTime"] is not None]
        if any(g["mode"] != "osu" or g["teamType"] != "team-vs" or g["scoringType"] != "score" for g in complete):
            raise ValueError("Unsupported scoring or team mode")
        for g in pooled:
            if g["endTime"] is None and any(s["score"] for s in g["scores"]):
                raise ValueError("Unfinished game has scores; review required")
        last = {g["beatmapId"]: g["id"] for g in complete}
        selected = [g for g in complete if g["id"] == last[g["beatmapId"]]]
        votes = {color: Counter(known[s["osuId"]] for g in selected for s in g["scores"] if s["team"] == color and s["osuId"] in known and s["score"] > 0) for color in ["red", "blue"]}
        side_teams = {}
        side_evidence = {}
        for color, counts in votes.items():
            ordered = counts.most_common()
            if not ordered or ordered[0][1] < 2 or (len(ordered) > 1 and ordered[0][1] <= 2*ordered[1][1]):
                raise ValueError("No unambiguous roster majority for source side")
            side_teams[color] = ordered[0][0]
            side_evidence[color] = {"positiveScoreOccurrences": dict(counts), "supportingUids": sorted({s["osuId"] for g in selected for s in g["scores"] if s["team"] == color and s["score"] > 0 and known.get(s["osuId"]) == ordered[0][0]})}
        if side_teams["red"] == side_teams["blue"]:
            raise ValueError("Both source sides resolve to the same team")
        labels = source_labels(match["name"])
        for label in labels:
            literal = re.fullmatch(r"([A-L])(?:\s+(.+))?", label)
            if literal:
                team = "team-" + literal[1].lower()
                aliases[label] = team
                if literal[2]:
                    if literal[2] in aliases and aliases[literal[2]] != team:
                        raise ValueError("Conflicting explicit team name")
                    aliases[literal[2]] = team
                    alias_evidence.setdefault(literal[2], []).append(match["url"])
        matches.append({"id": match["id"], "url": match["url"], "name": match["name"], "labels": labels, "startedAt": match["startTime"], "startedAtUtc8": dt.datetime.fromisoformat(match["startTime"].replace("Z", "+00:00")).astimezone(dt.timezone(dt.timedelta(hours=8))).isoformat(), "pool": pool, "sideTeams": side_teams, "sideEvidence": side_evidence, "rawCompletedWins": score_games(complete), "lastCompletedAttemptWins": score_games(selected), "officialScore": None, "approval": "unreviewed", "gameReview": [{"gameId": g["id"], "beatmapId": g["beatmapId"], "poolSlot": pool_lookup.get(g["beatmapId"], (None, None))[1], "startTime": g["startTime"], "endTime": g["endTime"], "disposition": "outside-stage-pools" if g["beatmapId"] not in pool_lookup else "aborted-no-result" if g["endTime"] is None else "earlier-completed-replay-candidate" if g["id"] != last[g["beatmapId"]] else "selected-under-last-completed-attempt-hypothesis", "totals": {c: sum(s["score"] for s in g["scores"] if s["team"] == c) for c in ["red", "blue"]}, "positivePlayers": {c: sum(s["score"] > 0 for s in g["scores"] if s["team"] == c) for c in ["red", "blue"]}} for g in games], "crossRosterEvidence": [{"gameId": g["id"], "osuId": s["osuId"], "sourceRosterTeam": known[s["osuId"]], "observedSideTeam": side_teams[s["team"]]} for g in selected for s in g["scores"] if s["score"] > 0 and s["osuId"] in known and known[s["osuId"]] != side_teams[s["team"]]]})
        for review in matches[-1]["gameReview"]:
            if review["endTime"] and review["poolSlot"]:
                original = next(g for g in games if g["id"] == review["gameId"])
                review.update(game_result(original))
    # Propagate a name only when the other title side is already evidenced and
    # the two UID-majority sides establish its unique remaining team.
    for _ in range(len(matches)):
        changed = False
        for match in matches:
            labels = match["labels"]
            teams = set(match["sideTeams"].values())
            for i, label in enumerate(labels):
                other = aliases.get(labels[1-i])
                if label not in aliases and other in teams:
                    remaining = teams - {other}
                    if len(remaining) == 1:
                        aliases[label] = remaining.pop()
                        alias_evidence.setdefault(label, []).append(match["url"])
                        changed = True
        if not changed:
            break
    for match in matches:
        teams = [aliases.get(label) for label in match["labels"]]
        if None in teams or set(teams) != set(match["sideTeams"].values()):
            raise ValueError("Title aliases disagree with scoreboard identities")
        match["teamA"], match["teamB"] = teams
        colors = [next(c for c, t in match["sideTeams"].items() if t == team) for team in teams]
        match["rawCompletedScore"] = [match["rawCompletedWins"][c] for c in colors]
        match["reconstructedScore"] = [match["lastCompletedAttemptWins"][c] for c in colors]
        match["winner"] = teams[0 if match["reconstructedScore"][0] > match["reconstructedScore"][1] else 1]
        match["requiresReplayConfirmation"] = match["rawCompletedScore"] != match["reconstructedScore"]
        match["scoreNotes"] = []
        if match["requiresReplayConfirmation"]:
            match["scoreNotes"].append("Same beatmap has multiple completed attempts. Both raw and last-attempt totals are preserved; replay ruling is unconfirmed.")
    apply_provisional_interpretations(matches, snapshot)
    teams = [{"id": team["id"], "workbookName": team["name"], "evidencedNames": [{"name": name, "sources": sorted(set(alias_evidence.get(name, [])))} for name, target in aliases.items() if target == team["id"] and not re.fullmatch(r"[A-L](?:\s+.+)?", name)]} for team in roster["teams"]]
    batches = []
    for i, (first, last) in enumerate([("2021-05-08", "2021-05-09"), ("2021-05-14", "2021-05-16"), ("2021-05-22", "2021-05-24"), ("2021-05-28", "2021-06-01")], 1):
        records = [m for m in matches if first <= m["startedAtUtc8"][:10] <= last]
        occurrences = Counter(t for m in records for t in [m["teamA"], m["teamB"]])
        if occurrences != Counter({team["id"]: 1 for team in teams}):
            raise ValueError("Preliminary date batch does not contain all twelve teams once")
        batches.append({"label": f"Preliminary batch {i}", "status": "chronological-reconstruction-not-official-round-name", "matchIds": [m["id"] for m in records]})
    def standings(records):
        rows = []
        for team in teams:
            played = [m for m in records if team["id"] in [m["teamA"], m["teamB"]]]
            won = sum(m["winner"] == team["id"] for m in played)
            maps_for = sum(m["reconstructedScore"][0 if m["teamA"] == team["id"] else 1] for m in played)
            maps_against = sum(m["reconstructedScore"][1 if m["teamA"] == team["id"] else 0] for m in played)
            rows.append({"teamId": team["id"], "played": len(played), "wins": won, "losses": len(played)-won, "mapsWon": maps_for, "mapsLost": maps_against, "rank": None})
        return rows
    data = {"artifactKind": "oclr-s6-match-reconstruction", "importReady": False, "officialPlacements": [], "teams": teams, "matches": matches, "excludedMatches": excluded_matches, "preliminaryBatches": batches, "standingsStrictGsPool": standings([m for m in matches if m["pool"] == "S6GS"]), "standingsFourBatchHypothesis": standings([m for m in matches if any(m["id"] in b["matchIds"] for b in batches)]), "knockoutRecordedMatchIds": [m["id"] for m in matches if m["startedAtUtc8"][:10] >= "2021-06-04"], "notes": []}

    return apply_rule_structure(data, rules)


def write_report(data, path):
    """Generate review tables from rule facts and the same match records."""
    lookup = {m["id"]: m for m in data["matches"]}
    letter = lambda team: team.removeprefix("team-").upper()
    roles = {"swiss": "瑞士輪", "swiss-provisional": "瑞士輪（待確認）", "upper-semifinal": "勝者組準決賽", "lower-round-1": "敗者組第 1 輪", "lower-round-2": "敗者組第 2 輪", "lower-round-3": "敗者組第 3 輪", "lower-final": "敗者組決賽", "grand-final": "總決賽"}
    lines = [
        "# S6 小組賽、淘汰對陣與結果重建（待覆核）", "",
        "使用主辦者更正後提供的 33 個 2021 年 MP，以及後補的 [S6 規則](https://docs.qq.com/doc/DUHFuRFBER1NKS3Bw)。先前撤回的 2020 年對局完全排除；規則連結不保存 QQ 追蹤參數。", "",
        "已核對 33 場完整分頁、共 348 局遊戲。按譜面 ID 可確認 GS 圖池 23 場、ES 圖池 8 場、FS 圖池 2 場；本批沒有資格賽、測試賽或 Showcase 房間。65 局圖池外的開場遊戲及 20 局無結束時間、全員零分的中止遊戲不計勝圖。另有四次完整重打暫採最後一次；D–I 最後一局 TB 暫列賽後娛樂，候選賽事合計 258 局，原始紀錄均保留。", "",
        "**所有比分、分支與名次仍是重建資料，沒有寫入正式站或批准為官方賽果。** 依主辦者最新指示，D–I 暫按 3:5、最後 TB 為賽後娛樂；C–F 保留實打 2:5，另註 HD2 可能有未記錄勝點而實際為 2:6。兩項均標示待確認，不代表主辦者已確認歷史賽果。G–J 勝者組決賽仍未取得 MP。", "",
        "來源：[MP 清單](imports/s6-match-manifest.json)、[分頁核對後的競賽快照](imports/s6-match-source-snapshot.json)、[規則事實摘要](imports/s6-rules-facts.json)、[機器可讀重建](imports/s6-match-reconstruction.json)。原工作簿名單、現行角色及正式資料未更動。", "",
        "## 規則確認後的結構", "",
        "- 採 Score v1；個人 Fail 分數保留，整隊 Team Fail 判負，No Fail 可自行開啟。逐局核對到一個 Team Fail：D–I 的遊戲 432255879 藍方；它與原始總分勝負相同，因此沒有改變任何重建比分。",
        "- 小組階段是四輪瑞士輪、12 進 8、BO9。文件中兩組循環的舊提案已劃除，不採用。",
        "- 瑞士輪前四隊直接進勝者組，後四隊直接進敗者組；兩組第一名均可挑選其淘汰賽對手。不是八隊全部從勝者組起跑。",
        "- 淘汰階段 BO11；敗者組決賽及總決賽 BO13。規則沒有寫出總決賽重置或勝者方讓分，不能自行添加。",
        "- Extra 用於 NM1／HD1／HR1／DT1，限制 Captain／VICE／Tier 1 同時上場的人數；它沒有額外計分倍率。規則亦允許 NM 單開 HR／HD／EZ，不額外調整原始分數。不能單憑加了 Mod 就剔除某局。",
        "- 重賽有每隊一次及掉線、SS 分差門檻、裁判判定等條件；開場 30 秒內中止及指定裁判例外不消耗次數。這些條文不等於證明每一場實際獲准重打。", "",
        "規則的原定日期是瑞士輪 5 月 8–30 日、淘汰 6 月 5–13 日、決賽 6 月 19–20 日；MP 有延後紀錄，保留實際日期。下述輪次由規則與對手／路徑共同重建，並非另有完整原始對陣表。", "",
        "## 隊伍名稱對照", "",
        "原表及帶字母的房名建立名稱對照；已知一側名稱及雙方 UID 時，才推定唯一另一側。紅藍隊依名單 UID 的多數證據確認，房名順序不能代替紅藍順序。I、J 仍無可靠隊名。", "",
        "| 代號 | 來源隊名 |", "| --- | --- |"
    ]
    for team in data["teams"]:
        names = [n["name"] for n in team["evidencedNames"]]
        lines.append(f"| {letter(team['id'])} | {'／'.join(names) if names else '未記錄'} |")

    def table(records):
        rows = ["| 日期（UTC+8） | 重建輪次 | 對局 | 比分 | 勝方 | 圖池 | MP／備註 |", "| --- | --- | --- | --- | --- | --- | --- |"]
        for match in records:
            mark = "†" if match["requiresReplayConfirmation"] else ""
            note = "；暫按 3:5，末局 TB 賽後娛樂；整房 3:6（待確認）" if match["id"] == 84398168 else "；實打 2:5，HD2 可能缺一分而為 2:6（待確認）" if match["id"] == 85503945 else ""
            score = match["reconstructedScore"]
            rows.append(f"| {match['startedAtUtc8'][:10]} | {roles[match['stageClassification']['role']]} | {letter(match['teamA'])}–{letter(match['teamB'])} | {score[0]}:{score[1]}{mark} | {letter(match['winner'])} | {match['pool']} | [{match['id']}]({match['url']}){note} |")
        return rows

    lines += ["", "## 瑞士輪對陣", "", "按時間可排出四批、每批十二隊各出現一次。前三批與規則及 GS 圖池一致；第四批 D–I 雖使用 ES，現暫按瑞士輪 3:5 處理，最後五對五 TB 作賽後娛樂，不計入候選小組戰績。該處理及使用 ES 的原因均待確認。日期是實際房間建立日（UTC+8），不覆蓋原表預定時間。† 表示完整重打仍待裁判結論。", ""]
    for index, batch in enumerate(data["preliminaryBatches"], 1):
        lines += [f"### 第 {index} 輪{'候選批次' if index == 4 else '重建'}", "", *table([lookup[mid] for mid in batch["matchIds"]]), ""]
    lines += ["### 小組戰績與兩套口徑", "", "左側只計 23 場 GS 圖池；右側暫將 D–I 以 3:5 列入第四輪，不計最後的娛樂 TB。故候選得失圖更新為 D 12–15、I 15–18，兩隊勝負仍各為 1–3。兩表都沿用重打假設，且 D–I 處理仍待確認；右側不是正式積分。原文排序依序為勝場、直接勝負及「净胜场」；第三項沒有進一步定義，不擅自把得失圖排序當成已接受的完整種子。", "", "| 隊伍 | GS 場數 | GS 勝–負 | GS 得–失圖 | 四批候選勝–負 | 四批候選得–失圖 |", "| --- | --- | --- | --- | --- | --- |"]
    for a, b in zip(data["standingsStrictGsPool"], data["standingsFourBatchHypothesis"]):
        lines.append(f"| {letter(a['teamId'])} | {a['played']} | {a['wins']}–{a['losses']} | {a['mapsWon']}–{a['mapsLost']} | {b['wins']}–{b['losses']} | {b['mapsWon']}–{b['mapsLost']} |")
    lines += ["", "按目前重建，J 四勝，B／C／G 各三勝，對應勝者組四隊；A／E／F／H 對應敗者組四隊。這兩組與六月實際對陣相符。第一名可選對手，所以不能只按固定 1–4、2–3 配對反推精確種子。D／I／K／L 尚不能分配官方 9–12 名順序。", "",
        "## 淘汰賽對陣與結果", "", *table([lookup[mid] for mid in data["knockoutRecordedMatchIds"]]), "",
        "規則確認前四隊從勝者組、後四隊從敗者組起跑後，所需的主要結構缺口縮小為一場：**G–J 勝者組決賽**。G 和 J 分別贏下兩場勝者組準決賽，後續 J 出現在敗者組決賽、G 出現在總決賽，因此能推導 G 贏該勝者決賽；但沒有 MP、日期及比分，以下只畫為缺失來源節點，未建立正式賽果。", "",
        "```mermaid", "flowchart LR", '  U1["勝者準決賽 J 6:0 C"] -->|J| UF["缺失來源：勝者決賽 G–J\n路徑推導 G 勝；比分未知"]', '  U2["勝者準決賽 G 6:2 B"] -->|G| UF', '  L1["敗者一輪 F 6:5 A"] -->|F| L22["敗者二輪 F 5:2 C\nBO11 尚缺第六個勝圖"]', '  U1 -->|C| L22', '  L2["敗者一輪 E 6:4 H"] -->|E| L21["敗者二輪 B 6:4 E"]', '  U2 -->|B| L21', '  L21 -->|B| L3["敗者三輪 B 6:2 F"]', '  L22 -->|F| L3', '  L3 -->|B| LF["敗者決賽 B 7:3 J"]', '  UF -.->|J，分支推導| LF', '  UF -.->|G，分支推導| GF["總決賽 B 7:5 G †"]', '  LF -->|B| GF', '  style UF stroke-dasharray: 5 5', "```", "",
        "B 的已知出場路徑為：勝者組 2:6 負 G → 敗者組 6:4 勝 E → 6:2 勝 F → 敗者決賽 7:3 勝 J → 總決賽候選 7:5 勝 G。所有實線比賽都有 MP；虛線所連的 G–J 只由結構推導。", "",
        "### 條件式名次整理", "", "若主辦者接受四場重打判定、確認最後一場確為賽事終局且沒有未提供的重置／後續裁定，則可按這條路徑整理如下。C–F 的正式比分仍需補正或接受其來源缺漏。這是待覆核的名次整理，JSON 的正式排名仍保持空白。", "",
        "| 候選名次 | 隊伍 |", "| --- | --- |", "| 1 | B 队长是隐形播放器 |", "| 2 | G 超级敏感 |", "| 3 | J（隊名未知） |", "| 4 | F aoi被圣遗物气晕 |", "| 5–6 | C 猫娘别演了／E 爆炸奶油面包V2 |", "| 7–8 | A 饮茶先啦／H 你寄吧谁 |", "| 未晉級候選；順序未知 | D／I／K／L |", "",
        "## 四場完整重打覆核", "", "重賽規則支持檢查重複譜面的必要性，但不能代替該場裁判判決。同一譜面兩次已完成紀錄，分別保留全部加總及採最後一次的候選值。", "",
        "| MP | 對局 | 全部已完成加總 | 最後一次候選比分 | 先前遊戲 → 後次遊戲（BID） |", "| --- | --- | --- | --- | --- |"
    ]
    for match in data["matches"]:
        earlier = [g for g in match["gameReview"] if g["disposition"] == "earlier-completed-replay-candidate"]
        if not earlier:
            continue
        refs = []
        for game in earlier:
            later = next(g for g in match["gameReview"] if g["beatmapId"] == game["beatmapId"] and g["disposition"] == "selected-under-last-completed-attempt-hypothesis")
            refs.append(f"{game['gameId']} → {later['gameId']}（{game['beatmapId']}）")
        raw, selected = match["rawCompletedScore"], match["reconstructedScore"]
        lines.append(f"| [{match['id']}]({match['url']}) | {letter(match['teamA'])}–{letter(match['teamB'])} | {raw[0]}:{raw[1]} | {selected[0]}:{selected[1]} | {'；'.join(refs)} |")
    lines += ["", "H–C 直接累加會變成 5:5，只有最後一次重打假設得到 H 4:5 C，因此該場勝方及小組戰績也依賴重打覆核。其他三場的兩種加總方式不改變勝方。四次較早紀錄的一方均只有兩位非零分選手，重打後回到三位；這支持斷線重打的推測，並不證明已獲裁判批准。", "",
        "## D–I／C–F 暫定推理（均待確認）", "",
        "### D–I：暫按 3:5，末局 TB 作賽後娛樂", "",
        "[D–I（84398168）](https://osu.ppy.sh/community/matches/84398168) 在 2021-05-28 21:20:51（UTC+8）完成第八張圖池圖 NM2，比分已到 D 3:5 I，符合 BO9 終點。21:29:30 才再開 TB，21:34:17 結束；前八圖每方各三名非零分選手，這張卻各有五名。TB 開打前不是平分，且 D–I 恰好補齊第四輪兩隊的出場，因此暫採『正式候選 3:5，末局為娛樂』解讀。", "",
        "原始整房加總 3:6、最後 TB 的遊戲 432260817／BID 2968871、分數與時間全部保留；只從暫定賽事比分及候選積分中排除該局。使用 ES 圖池的原因、現場是否確實如此處理，仍未取得當時佐證。主辦者目前只要求暫按此推理整理，並非確認歷史結果。", "",
        "### C–F：實打維持 2:5，可能缺 HD2 的一個 F 勝點", "",
        "[C–F（85503945）](https://osu.ppy.sh/community/matches/85503945) 在 2021-06-13 21:29:06 開 HD2（遊戲 437459269／BID 2844989），MP 沒有結束時間及任何分數，直到 21:43:54 才開始下一張。最後一張在 22:21:44 結束，已完成遊戲合計 C 2:5 F，49 秒後房間解散；翌日 F 已進入 B–F 的下一輪。", "",
        "若 HD2 有未保存的結算或現場判給 F 的一點，最終便可能是符合 BO11 的 C 2:6 F。此解讀比整輪改為 BO9 更符合相鄰 B–E、B–F 均打到六勝的紀錄，但目前沒有 HD2 勝負或裁判判分的直接證據；臨場改 BO9 或提前結束也無法排除。『無結算』不能直接證明主動 Abort、F 勝、棄權或罰分。", "",
        "因此表格與實打統計仍為 2:5，2:6 僅放在待確認的可能正式比分欄，不新增遊戲、選手分數或裁定。", "",
        "## 仍需共同推理／補充的項目", "",
        "1. D–I 的暫定 3:5／末局娛樂處理及使用 ES 的原因仍待當時紀錄或裁判佐證；原始整房 3:6 保留。",
        "2. C–F 實打 2:5 不變；HD2 是否存在未記錄的 F 勝點、實際是否 2:6，仍待確認。",
        "3. G–J 勝者組決賽的 MP、比分及日期尚缺。僅把 G 勝當成後續分支所需的結構推導。",
        "4. 確認四場完整重打的實際裁判處理；開場中止不等於已完成重打，兩類分開核對。",
        "5. 部分 A/B 原表 UID 跨隊出場（15174317、13679569 等）。實際分數保留，不自行重寫 roster 或判定違規。Extra 的上場宣告／選圖方亦不能從比分單獨還原。",
        "6. I/J 隊名、精確小組種子、總決賽終局性與最終排名仍待主辦者接受；規則沒有重置條文，不等於證明沒有遺漏後續賽事。", "",
        "## 來源與重現", "",
        "公開 MP 以未登入 JSON、after 遞增分頁讀取，核對首尾事件及穩定結束狀態；不讀本機秘密。只保留競賽事實及公開 UID／名稱，不保存聊天與無關個人欄位。QQ 規則是人工閱讀其唯讀畫面、包含劃除格式與文末後整理的事實摘要，不是全文重刊。", "",
        "```sh", "python3 scripts/fetch-s6-match-sources.py docs/imports/s6-match-manifest.json /tmp/s6-match-source-snapshot.json", "python3 scripts/reconstruct-s6-matches.py docs/imports/s6-match-source-snapshot.json docs/imports/s6-source-records.json docs/imports/s6-pool-source-snapshot.json docs/imports/s6-rules-facts.json docs/imports/s6-match-reconstruction.json --report docs/s6-match-reconstruction.md", "PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/scripts -p 'test_s6_match_reconstruction.py'", "```", "",
        "快照重取後先比較，不直接覆蓋已審查證據。本階段不部署、不匯入、不發布正式資料。", ""
    ]
    path.write_text("\n".join(lines))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ["snapshot", "roster", "pools", "rules", "output"]:
        parser.add_argument(name, type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    data = reconstruct(*(json.loads(p.read_text()) for p in [args.snapshot, args.roster, args.pools, args.rules]))
    data["sources"] = [{"file": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in [args.snapshot, args.roster, args.pools, args.rules]]
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n")
    if args.report:
        write_report(data, args.report)
    print(json.dumps({"matches": len(data["matches"]), "excludedMatches": len(data["excludedMatches"]), "poolCounts": dict(Counter(m["pool"] for m in data["matches"])), "gameDispositions": dict(Counter(g["disposition"] for m in data["matches"] for g in m["gameReview"])), "replayReviews": [m["id"] for m in data["matches"] if m["requiresReplayConfirmation"]]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
