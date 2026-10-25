"""Offline S6 history checks, including ambiguous replay and bracket evidence."""

import contextlib
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


s6 = module("s6_matches", "reconstruct-s6-matches.py")
fetcher = module("s6_fetch", "fetch-s6-match-sources.py")


class S6MatchReconstruction(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = json.loads((ROOT / "docs/imports/s6-match-source-snapshot.json").read_text())
        cls.roster = json.loads((ROOT / "docs/imports/s6-source-records.json").read_text())
        cls.pools = json.loads((ROOT / "docs/imports/s6-pool-source-snapshot.json").read_text())
        cls.rules = json.loads((ROOT / "docs/imports/s6-rules-facts.json").read_text())
        with patch("urllib.request.urlopen", side_effect=AssertionError("Offline check attempted network")):
            cls.result = s6.reconstruct(cls.snapshot, cls.roster, cls.pools, cls.rules)
        cls.matches = {m["id"]: m for m in cls.result["matches"]}

    def test_all_corrected_sources_are_complete_and_no_withdrawn_year_is_used(self):
        manifest = json.loads((ROOT / "docs/imports/s6-match-manifest.json").read_text())
        self.assertEqual({m["id"] for m in manifest["matches"]}, set(self.matches))
        self.assertEqual(len(self.matches), 33)
        self.assertEqual(sum(len(m["games"]) for m in self.snapshot["matches"]), 348)
        for match in self.snapshot["matches"]:
            self.assertTrue(match["complete"])
            self.assertTrue(match["startTime"].startswith("2021-"))
            self.assertEqual(match["pages"][0]["firstEventId"], match["firstEventId"])
            self.assertEqual(match["pages"][-1]["lastEventId"], match["latestEventId"])
            self.assertEqual(match["eventCount"], sum(p["count"] for p in match["pages"]))
            for a, b in zip(match["pages"], match["pages"][1:]):
                self.assertEqual(b["after"], a["lastEventId"])
        games = [g["id"] for m in self.snapshot["matches"] for g in m["games"]]
        self.assertEqual(len(games), len(set(games)))

    def test_exclusions_and_replay_alternatives_are_explicit(self):
        dispositions = [g["disposition"] for m in self.result["matches"] for g in m["gameReview"]]
        self.assertEqual(dispositions.count("outside-stage-pools"), 65)
        self.assertEqual(dispositions.count("aborted-no-result"), 20)
        self.assertEqual(dispositions.count("earlier-completed-replay-candidate"), 4)
        self.assertEqual(dispositions.count("selected-under-last-completed-attempt-hypothesis"), 259)
        for mid, raw, candidate in [(82845405, [5, 5], [4, 5]), (82930484, [1, 6], [1, 5]), (83393789, [5, 4], [5, 3]), (86362224, [6, 7], [5, 7])]:
            self.assertEqual(self.matches[mid]["rawCompletedScore"], raw)
            self.assertEqual(self.matches[mid]["reconstructedScore"], candidate)
            self.assertTrue(self.matches[mid]["requiresReplayConfirmation"])

    def test_replay_evidence_has_two_then_three_nonzero_players(self):
        for match in self.result["matches"]:
            for earlier in match["gameReview"]:
                if earlier["disposition"] != "earlier-completed-replay-candidate":
                    continue
                later = next(g for g in match["gameReview"] if g["beatmapId"] == earlier["beatmapId"] and g["disposition"] == "selected-under-last-completed-attempt-hypothesis")
                self.assertIn(2, earlier["positivePlayers"].values())
                self.assertEqual(later["positivePlayers"], {"red": 3, "blue": 3})

    def test_sides_are_matched_to_roster_not_title_order(self):
        for mid, red, blue, score in [(83398400, "team-k", "team-h", [5, 4]), (84482290, "team-k", "team-a", [5, 0]), (85044339, "team-h", "team-e", [6, 4])]:
            self.assertEqual(self.matches[mid]["sideTeams"], {"red": red, "blue": blue})
            self.assertEqual(self.matches[mid]["reconstructedScore"], score)
        self.assertTrue(any(m["crossRosterEvidence"] for m in self.result["matches"]))

    def test_aliases_are_evidenced_without_invented_i_j_names(self):
        names = {t["id"]: [n["name"] for n in t["evidencedNames"]] for t in self.result["teams"]}
        self.assertEqual(names["team-f"], ["aoi被圣遗物气晕"])
        self.assertEqual(names["team-g"], ["超级敏感"])
        self.assertEqual(names["team-l"], ["不练傻逼图"])
        self.assertEqual(names["team-i"], [])
        self.assertEqual(names["team-j"], [])

    def test_four_batches_are_not_asserted_as_official_groups(self):
        for batch in self.result["preliminaryBatches"]:
            self.assertEqual(len(batch["matchIds"]), 6)
            teams = [t for mid in batch["matchIds"] for t in [self.matches[mid]["teamA"], self.matches[mid]["teamB"]]]
            self.assertEqual(len(set(teams)), 12)
            if batch != self.result["preliminaryBatches"][3]:
                self.assertIn("reconstructed", batch["status"])
            else:
                self.assertIn("unresolved-DI", batch["status"])
        self.assertEqual(self.matches[84398168]["pool"], "S6ES")
        self.assertIn(84398168, self.result["preliminaryBatches"][3]["matchIds"])
        self.assertNotIn(84398168, self.result["knockoutRecordedMatchIds"])
        strict = {s["teamId"]: s for s in self.result["standingsStrictGsPool"]}
        candidate = {s["teamId"]: s for s in self.result["standingsFourBatchHypothesis"]}
        self.assertEqual([strict["team-i"]["played"], strict["team-i"]["wins"]], [3, 0])
        self.assertEqual([candidate["team-i"]["played"], candidate["team-i"]["wins"]], [4, 1])
        self.assertEqual(sum(s["wins"] for s in candidate.values()), 24)
        self.assertEqual(sum(s["mapsWon"] for s in candidate.values()), sum(s["mapsLost"] for s in candidate.values()))

    def test_incomplete_official_score_and_final_placements_are_not_fabricated(self):
        self.assertEqual(self.matches[85503945]["reconstructedScore"], [2, 5])
        self.assertIn("No sixth F point", self.matches[85503945]["scoreNotes"][0])
        self.assertEqual(self.matches[86302764]["reconstructedScore"], [3, 7])
        self.assertEqual(self.matches[86362224]["reconstructedScore"], [5, 7])
        self.assertEqual(len(self.result["knockoutRecordedMatchIds"]), 9)
        self.assertEqual(self.result["officialPlacements"], [])
        self.assertFalse(self.result["importReady"])
        self.assertTrue(all(m["officialScore"] is None and m["approval"] == "unreviewed" for m in self.result["matches"]))

    def test_saved_reconstruction_and_report_match_offline_regeneration(self):
        saved = json.loads((ROOT / "docs/imports/s6-match-reconstruction.json").read_text())
        for source in saved.pop("sources"):
            self.assertEqual(source["sha256"], hashlib.sha256((ROOT / "docs/imports" / source["file"]).read_bytes()).hexdigest())
        self.assertEqual(self.snapshot["manifestSha256"], hashlib.sha256((ROOT / "docs/imports/s6-match-manifest.json").read_bytes()).hexdigest())
        self.assertEqual(saved, self.result)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "report.md"
            s6.write_report(self.result, path)
            def semantic_text(text):
                text = re.sub(r"(?m)^\|[\s:|\-]+\|$", "", text)
                return re.sub(r"\s+", "", text)
            self.assertEqual(semantic_text(path.read_text()), semantic_text((ROOT / "docs/s6-match-reconstruction.md").read_text()))

    def test_wrong_year_incomplete_sources_and_tied_games_fail_closed(self):
        for key, value in [("startTime", "2020-07-19T12:54:51Z"), ("complete", False)]:
            data = copy.deepcopy(self.snapshot)
            data["matches"][0][key] = value
            with self.assertRaises(ValueError):
                s6.reconstruct(data, self.roster, self.pools, self.rules)
        with self.assertRaisesRegex(ValueError, "tied"):
            s6.score_games([{"scores": [{"team": "red", "score": 1, "passed": True}, {"team": "blue", "score": 1, "passed": True}]}])

    def test_qualifiers_tests_and_showcases_are_excluded(self):
        data = copy.deepcopy(self.snapshot)
        for i, name in enumerate(["OCLR:(Coach)vs(Coach)", "OCLR:(Captain)vs(Captain)", "OCLR:(Mappool)vs(Showcase)", "OCLR:(测试)vs()", "OCLR:(教练)vs(资格赛)"]):
            data["matches"].append({"id": 100+i, "name": name, "startTime": "2021-05-01T00:00:00Z"})
        result = s6.reconstruct(data, self.roster, self.pools, self.rules)
        self.assertEqual(len(result["matches"]), 33)
        self.assertEqual(len(result["excludedMatches"]), 5)

    def test_rule_structure_starts_four_teams_upper_and_four_lower(self):
        bracket = self.result["bracketDeductions"]
        self.assertEqual(bracket["upperEntrants"], ["team-b", "team-c", "team-g", "team-j"])
        self.assertEqual(bracket["lowerEntrants"], ["team-a", "team-e", "team-f", "team-h"])
        self.assertEqual(self.matches[84972689]["stageClassification"]["role"], "upper-semifinal")
        self.assertEqual(self.matches[84896923]["stageClassification"]["role"], "lower-round-1")
        self.assertEqual(self.matches[86362224]["stageClassification"]["bestOf"], 13)
        self.assertEqual(bracket["missingUpperFinal"]["winner"], "team-g")
        self.assertIsNone(bracket["missingUpperFinal"]["score"])
        self.assertEqual(bracket["missingUpperFinal"]["mpUrls"], [])
        self.assertIsNone(bracket["exactSeeds"])
        self.assertFalse(self.rules["knockout"]["grandFinalResetSpecified"])
        self.assertIn("struck", self.rules["preliminary"]["obsoleteStruckThroughProposal"])

    def test_team_fail_loses_but_individual_fail_score_still_counts(self):
        game = {"scores": [{"team": "red", "score": 500, "passed": False}, {"team": "red", "score": 5, "passed": True}, {"team": "blue", "score": 100, "passed": True}]}
        self.assertEqual(s6.game_result(game)["winningColor"], "red")
        game["scores"][1]["passed"] = False
        self.assertEqual(s6.game_result(game)["winningColor"], "blue")
        failures = [(m["id"], g["gameId"]) for m in self.result["matches"] for g in m["gameReview"] if any(g.get("teamFail", {}).values())]
        self.assertEqual(failures, [(84398168, 432255879)])


class PublicPagination(unittest.TestCase):
    def test_pagination_reaches_latest_without_authentication(self):
        match = {"id": 123, "name": "OCLR:(A)vs(B)", "start_time": "2021-05-01T00:00:00Z", "end_time": "2021-05-01T01:00:00Z"}
        def page(events):
            return io.BytesIO(json.dumps({"match": match, "first_event_id": 11, "latest_event_id": 22, "current_game_id": None, "users": [], "events": [{"id": i} for i in events]}).encode())
        with patch("urllib.request.urlopen", side_effect=[page([11]), page([22])]) as request, contextlib.redirect_stdout(io.StringIO()):
            result = fetcher.fetch_match({"id": 123, "url": "https://osu.ppy.sh/community/matches/123", "submittedTitle": match["name"]})
        self.assertTrue(result["complete"])
        self.assertEqual(result["eventCount"], 2)
        self.assertIn("after=11", request.call_args_list[1].args[0].full_url)
        self.assertNotIn("Authorization", dict(request.call_args_list[0].args[0].header_items()))

    def test_unapproved_hosts_and_truncated_pages_fail(self):
        with self.assertRaises(ValueError):
            fetcher.fetch_match({"id": 123, "url": "https://example.com/123", "submittedTitle": "test"})
        page = {"match": {"id": 123, "end_time": "2021-05-01T00:00:00Z"}, "first_event_id": 11, "latest_event_id": 22, "current_game_id": None, "users": [], "events": []}
        with patch("urllib.request.urlopen", return_value=io.BytesIO(json.dumps(page).encode())):
            with self.assertRaisesRegex(ValueError, "Incomplete"):
                fetcher.fetch_match({"id": 123, "url": "https://osu.ppy.sh/community/matches/123", "submittedTitle": "test"})


if __name__ == "__main__":
    unittest.main()
