#!/usr/bin/env python3
"""Apply the organizer's 2026-10-25 confirmations to the reviewed S6 package.

Source snapshots and missing player scores/timestamps are deliberately unchanged.
No network or database access. Publication still requires the administrator UI.
"""
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build():
    a = json.loads((ROOT / "docs/imports/s6-archive.json").read_text())
    a = copy.deepcopy(a)
    a["notes"][0] = "S6 歷史歸檔：D–I／C–F 按主辦者本次確認整理，其餘覆核事項與正式排名仍未定稿。"
    a["notes"][1] = "主辦者於 2026-10-25 確認：D–I 最後一盤 TB 是娛樂賽，不計對局，比分 3:5；原始整房合計 3:6 保留。"
    a["notes"][2] = "主辦者於 2026-10-25 確認：C–F 的 HD2 為 F 隊獲勝，採 2:6；MP 可見已結算局仍是 2:5，不補造 HD2 個人分數或結束時間。"
    a["notes"][4] = "資格賽只保存原始單圖分數；空白不是零，快取 RANK/SUM 不是正式排名。原表隱藏資格賽按主辦者本次公開 S6 的指示納入，未包含私人申請欄位。"
    for q in a["qualifiers"]:
        q["source"] = q["name"] + "（原工作簿隱藏表；原始分數，未確認排名）"
    for m in a["matches"]:
        if m["id"] == "mp-84398168":
            m["review"]["note"] = a["notes"][1] + "\n最後 TB 遊戲 432260817 排除於賽事比分及積分。ES 圖池使用原因仍未知。逐局資料保留先前 MP 審查快照，本次主辦者確認是現行處理依據；整體歸檔仍有其他待覆核事項。"
        if m["id"] == "mp-85503945":
            m["review"]["workingScore"] = [2, 6]
            m["review"]["possibleScore"] = None
            m["review"]["note"] = a["notes"][2] + "\nHD2 遊戲 437459269／BID 2844989 的勝點依主辦者確認計給 F。原始 MP 無結束時間與分數的紀錄原樣保留，不新增遊戲、個人分數或時間。逐局資料保留先前 MP 審查快照，本次主辦者確認是現行處理依據；整體歸檔仍有其他待覆核事項。"
    for table in a["reviewTables"]:
        table["name"] = table["name"].replace("D–I 暫按 3:5", "D–I 3:5，娛樂 TB 不計")
        table["note"] = "主辦者已確認 D–I 最後 TB 為娛樂賽、不計比分；其餘重打裁定與精確種子仍待覆核，這是候選統計，沒有正式排名。"
    for f in a["sourceFacts"]:
        if f["label"] == "條件式名次（未批准）":
            f["text"] = "主辦者已確認 C–F HD2 為 F 勝、採 2:6。候選仍為 B/G/J/F 前四、C/E 5–6、A/H 7–8，但四場重打判定、G–J 缺失來源及總決賽終局性仍待覆核，正式名次保持空白。"
        if f["label"] == "來源完整性":
            f["text"] = "33 場 MP、348 局；原始審查快照保留 65 局圖池外開場、20 局無結算與4局較早完整重打候選。主辦者確認 D–I 末 TB 是娛樂、不計比分；確認 C–F HD2 為 F 勝。258 局保存結算紀錄與 C–F 缺失結算勝點分開記錄，不補造 HD2 個人分數。逐局快照中的舊候選標籤不是本次確認後的判定。"
    a["sourceFacts"].insert(0, {
        "category": "review", "label": "主辦者已確認：D–I 娛樂賽與 C–F HD2",
        "text": a["notes"][1] + "\n" + a["notes"][2] + "\n這兩項已確認，取代先前推理；其他未覆核事項仍保留。原始 MP／先前逐局審查快照不改寫。整體覆核標記不表示這兩項確認仍有疑義。",
        "source": "主辦者 2026-10-25 本 chat 明確確認／#289",
    })
    return a


if __name__ == "__main__":
    target = ROOT / "docs/imports/s6-confirmed-archive.json"
    target.write_text(json.dumps(build(), ensure_ascii=False, indent=2) + "\n")
    print(target)
