"""Read only the organizer-allowlisted public osu! match pages, without credentials.

Use application/json on public match URLs, with complete ascending pagination.
Keep only competition facts; never load local environment files or API tokens.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import hashlib
import json
from pathlib import Path
import urllib.request


def fetch_match(entry):
    match_id = entry["id"]
    if type(match_id) is not int or match_id < 1 or entry["url"] != f"https://osu.ppy.sh/community/matches/{match_id}":
        raise ValueError("Invalid allowlisted match")
    events, users, pages = {}, {}, []
    cursor, total_bytes, bounds, match = 0, 0, None, None
    for _ in range(100):
        url = entry["url"] + f"?after={cursor}&limit=100"
        request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "OCLR-history-review/1.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read(8*1024*1024+1)
        total_bytes += len(raw)
        if total_bytes > 8*1024*1024:
            raise ValueError("Match exceeds source size budget")
        page = json.loads(raw)
        if page["match"]["id"] != match_id or page.get("current_game_id") is not None:
            raise ValueError("Mismatched or active source")
        current_bounds = (page["first_event_id"], page["latest_event_id"])
        if bounds is None:
            bounds, match = current_bounds, page["match"]
        elif bounds != current_bounds or match != page["match"]:
            raise ValueError("Source changed during capture")
        if not bounds[0] or bounds[0] > bounds[1] or len(page["events"]) > 100:
            raise ValueError("Invalid public history boundaries")
        ids = [e["id"] for e in page["events"]]
        pages.append({"after": cursor, "count": len(ids), "firstEventId": min(ids) if ids else None, "lastEventId": max(ids) if ids else None, "responseSha256": hashlib.sha256(raw).hexdigest()})
        for user in page.get("users", []):
            users[user["id"]] = user["username"]
        for event in page["events"]:
            if not bounds[0] <= event["id"] <= bounds[1] or event["id"] <= cursor:
                raise ValueError("Non-ascending public history")
            if event["id"] in events and events[event["id"]] != event:
                raise ValueError("Conflicting public event")
            events[event["id"]] = event
        if ids and max(ids) >= bounds[1]:
            break
        if not ids or max(ids) <= cursor:
            raise ValueError("Incomplete public history")
        cursor = max(ids)
    else:
        raise ValueError("Public history page budget exhausted")
    if min(events) != bounds[0] or max(events) != bounds[1] or not match["end_time"]:
        raise ValueError("Source history is not complete and ended")
    games = {}
    for event in events.values():
        g = event.get("game")
        if not g:
            continue
        scores = []
        for s in g["scores"]:
            value = s.get("legacy_total_score", s.get("score", s.get("total_score")))
            if type(value) is not int or value < 0:
                raise ValueError("Unsupported score value")
            scores.append({"osuId": s["user_id"], "team": s["match"]["team"], "score": value, "passed": s.get("passed"), "mods": s.get("mods", [])})
        game = {"id": g["id"], "eventId": event["id"], "beatmapId": g["beatmap_id"], "startTime": g["start_time"], "endTime": g["end_time"], "mode": g["mode"], "teamType": g["team_type"], "scoringType": g["scoring_type"], "mods": g["mods"], "scores": scores}
        if g["id"] in games and {k:v for k,v in games[g["id"]].items() if k != "eventId"} != {k:v for k,v in game.items() if k != "eventId"}:
            raise ValueError("Conflicting duplicate game")
        games[g["id"]] = game
    playing_ids = {s["osuId"] for g in games.values() for s in g["scores"]}
    result = {"id": match_id, "url": entry["url"], "submittedTitle": entry["submittedTitle"], "name": match["name"], "startTime": match["start_time"], "endTime": match["end_time"], "complete": True, "firstEventId": bounds[0], "latestEventId": bounds[1], "eventCount": len(events), "pages": pages, "games": sorted(games.values(), key=lambda g: (g["startTime"], g["id"])), "observedPlayers": [{"osuId": uid, "observedUsername": users.get(uid)} for uid in sorted(playing_ids)]}
    print(json.dumps({"match": match_id, "name": match["name"], "pages": len(pages), "games": len(games), "complete": True}, ensure_ascii=False), flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    if len({m["id"] for m in manifest["matches"]}) != len(manifest["matches"]):
        raise ValueError("Duplicate input match")
    with ThreadPoolExecutor(max_workers=3) as pool:
        matches = list(pool.map(fetch_match, manifest["matches"]))
    result = {"artifactKind": "oclr-s6-public-match-source-snapshot", "capturedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "manifestSha256": hashlib.sha256(args.manifest.read_bytes()).hexdigest(), "transport": "Public website JSON without authentication; after pagination; complete event bounds checked", "notes": ["Current observed usernames are identity labels, not claims about their spelling in 2021.", "Only scored-game facts and public player IDs/names are retained. Unrelated provider profile attributes, chat, credentials and join/leave identities are excluded.", "No game has yet been approved as a tournament result; warmups, retries and side assignment require analysis."], "matches": matches}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n")


if __name__ == "__main__":
    main()
