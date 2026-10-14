import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from helpers import EXAMPLE, evaluate_with
from unit_economics import evaluate, load_config, run_sensitivities
from unit_economics.cli import main
from unit_economics.fmt import indian_group, money, pct
from unit_economics.report import render_markdown, to_json


class FormatTest(unittest.TestCase):
    def test_indian_grouping(self):
        self.assertEqual(indian_group("999"), "999")
        self.assertEqual(indian_group("1000"), "1,000")
        self.assertEqual(indian_group("1000000"), "10,00,000")
        self.assertEqual(indian_group("12345678"), "1,23,45,678")

    def test_money(self):
        self.assertEqual(money(1000000, decimals=0), "₹10,00,000")
        self.assertEqual(money(-9.58), "-₹9.58")
        self.assertEqual(money(-0.004), "₹0.00")
        self.assertEqual(money(None), "–")
        self.assertEqual(money(5, symbol="$"), "$5.00")
        self.assertEqual(pct(0.3047), "30.5%")
        self.assertEqual(pct(-0.0004), "0.0%")

    def test_rounding_matches_spreadsheets(self):
        # 100 - 98.995 is 1.0049999999999955 in floating point: round() gives 1.0, spreadsheets display 1.01
        self.assertEqual(money(100 - 98.995), "₹1.01")
        self.assertEqual(money(98.995 - 100), "-₹1.01")
        self.assertEqual(money(2.675), "₹2.68")  # round() would give 2.67


class ReportTest(unittest.TestCase):
    def test_markdown(self):
        cfg = load_config(EXAMPLE)
        text = render_markdown(evaluate(cfg), run_sensitivities(cfg))
        for fragment in (
            "# Example Co. sample pack (FICTIONAL) — unit economics",
            "**DOMINATED**",
            "## 5. Sensitivities",
            "## Assumption register",
            "₹75,000",
        ):
            self.assertIn(fragment, text)
        self.assertNotIn("CONFIDENTIAL", text)

    def test_confidential_banner(self):
        text = render_markdown(evaluate_with({"meta.confidential": True}))
        self.assertIn("**CONFIDENTIAL**", text)

    def test_json(self):
        cfg = load_config(EXAMPLE)
        data = json.loads(to_json(evaluate(cfg), run_sensitivities(cfg)))
        self.assertAlmostEqual(data["metrics"]["online.web.trio.contribution"], 46.6)
        self.assertEqual(len(data["sensitivities"]), 3)
        self.assertEqual(data["findings"][0]["code"], "LADDER_DOMINATED")


class CliTest(unittest.TestCase):
    def run_cli(self, *args):
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            code = main(list(args))
        return code, out.getvalue()

    def test_check_fails_on_errors(self):
        code, out = self.run_cli("check", str(EXAMPLE))
        self.assertEqual(code, 1)
        self.assertIn("LADDER_DOMINATED", out)

    def test_report_writes_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            md, js = Path(tmp) / "r.md", Path(tmp) / "r.json"
            code, _ = self.run_cli("report", str(EXAMPLE), "--out", str(md), "--json", str(js))
            self.assertEqual(code, 0)
            self.assertTrue(md.read_text(encoding="utf-8").startswith("# Example Co."))
            self.assertIn("metrics", json.loads(js.read_text(encoding="utf-8")))

    def test_bad_config_exits_2(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = Path(tmp) / "bad.toml"
            bad.write_text('[meta]\nname = "x"\n', encoding="utf-8")
            code, _ = self.run_cli("check", str(bad))
            self.assertEqual(code, 2)


if __name__ == "__main__":
    unittest.main()
