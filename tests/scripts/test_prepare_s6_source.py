"""DB-free privacy and formula-cache checks for the source-only extractor."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("s6", ROOT / "scripts/prepare-s6-source.py")
s6 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s6)


class S6SourceSafety(unittest.TestCase):
    def test_conflicting_gs_source_fails_instead_of_overwriting(self):
        data = json.loads((ROOT / "docs/imports/s6-source-records.json").read_text())
        snapshot = json.loads((ROOT / "docs/imports/s6-pool-source-snapshot.json").read_text())
        snapshot["sheets"][0]["maps"][0]["beatmapId"] = 999999
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.json"
            path.write_text(json.dumps(snapshot))
            with self.assertRaisesRegex(ValueError, "GS sources disagree"):
                s6.merge_pool_snapshot(data, path)

    def test_allowlist_excludes_personal_and_unrelated_cells(self):
        for sheet, address in [("选手名单", "D4"), ("教练名单", "H4"), ("废弃表", "C3"), ("测试表", "A1"), ("测试表", "I1"), ("队伍表", "K3"), ("队伍表", "AB3"), ("教练资格赛", "P2"), ("小组赛图池", "K2"), ("小组赛图池", "M2")]:
            with self.subTest(sheet=sheet, address=address):
                self.assertFalse(s6.allowed(sheet, address))
        self.assertTrue(s6.allowed("测试表", "D74"))
        self.assertFalse(s6.allowed("测试表", "D75"))

    def test_ignores_cached_formulas_and_private_values(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "synthetic.xlsx"
            with zipfile.ZipFile(path, "w") as z:
                z.writestr("xl/sharedStrings.xml", '<sst><si><t>public name</t></si><si><t>PRIVATE_SENTINEL</t></si></sst>')
                z.writestr("xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="测试表" r:id="rId1"/></sheets></workbook>')
                z.writestr("xl/_rels/workbook.xml.rels", '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
                z.writestr("xl/worksheets/sheet1.xml", '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="C1" t="s"><v>0</v></c><c r="D1"><v>123</v></c><c r="I1" t="s"><v>1</v></c></row><row r="2"><c r="C2" t="s"><f>UNTRUSTED()</f><v>1</v></c></row></sheetData></worksheet>')
            self.assertEqual(s6.read_cells(path), {"测试表": {"C1": "public name", "D1": "123"}})


if __name__ == "__main__":
    unittest.main()
