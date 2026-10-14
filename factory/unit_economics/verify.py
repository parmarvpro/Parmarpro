"""Recalculate a generated workbook in LibreOffice and compare it with the engine.

This is the proof that the spreadsheet a founder uses computes exactly what
the tested engine computes, for every tracked result cell and check count.
"""

from __future__ import annotations

import math
import shutil
import subprocess
import tempfile
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from openpyxl import load_workbook

from .config import Config
from .model import Results, evaluate, metrics
from .workbook import build_workbook

ERROR_VALUES = ("#VALUE!", "#NAME?", "#DIV/0!", "#REF!", "#N/A", "#NUM!", "#NULL!")
REL_TOLERANCE = 1e-9
ABS_TOLERANCE = 1e-6


class LibreOfficeMissing(RuntimeError):
    """LibreOffice is needed to recalculate formulas but is not installed."""


def soffice_path() -> str | None:
    return shutil.which("soffice") or shutil.which("libreoffice")


def recalculate(src: Path, outdir: Path, timeout: int = 300) -> Path:
    """Open ``src`` in headless LibreOffice, recalculate, and save a copy into ``outdir``."""
    exe = soffice_path()
    if not exe:
        raise LibreOfficeMissing("LibreOffice (soffice) is not installed, so formulas cannot be recalculated")
    outdir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="lo-profile-") as profile:
        cmd = [
            exe,
            f"-env:UserInstallation={Path(profile).as_uri()}",
            "--headless",
            "--calc",
            "--convert-to",
            "xlsx",
            "--outdir",
            str(outdir),
            str(src),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    out = outdir / src.name
    if proc.returncode != 0 or not out.exists():
        raise RuntimeError(f"LibreOffice could not recalculate {src}: {proc.stderr.strip() or proc.stdout.strip()}")
    return out


@dataclass
class VerifyReport:
    compared: int = 0
    checks_compared: int = 0
    mismatches: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    kept: str = ""

    @property
    def ok(self) -> bool:
        return self.compared > 0 and not self.mismatches and not self.errors

    def summary(self) -> str:
        lines = [
            f"Compared {self.compared} result cells and {self.checks_compared} check counts with the engine: "
            f"{len(self.mismatches)} mismatch(es), {len(self.errors)} formula error(s).",
        ]
        lines += [f"  MISMATCH {m}" for m in self.mismatches[:30]]
        lines += [f"  ERROR    {e}" for e in self.errors[:30]]
        if self.kept:
            lines.append(f"Recalculated workbook kept at {self.kept}")
        lines.append("OK" if self.ok else "FAILED")
        return "\n".join(lines)


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _close(a: float, b: float) -> bool:
    return abs(a - b) <= max(ABS_TOLERANCE, REL_TOLERANCE * max(abs(a), abs(b)))


def expected_check_counts(results: Results) -> dict[str, int]:
    """What each row of the workbook's Checks sheet should count, from the engine's findings."""
    found = Counter()
    for f in results.findings:
        if f.code in ("ONLINE_LOSS_BEFORE_MARKETING", "ONLINE_BELOW_TARGET", "LADDER_DOMINATED"):
            found[f"{f.code}:{f.ref.split('.')[0]}"] += 1
        else:
            found[f.code] += 1
    counts = {}
    codes = [
        "PLANNING_COST_OUT_OF_RANGE",
        "NEGATIVE_DISTRIBUTOR_MARGIN",
        "OFFLINE_BELOW_TARGET",
        "GROSS_MARGIN_BELOW_TARGET",
        "RETAILER_MARGIN_OUTSIDE_BAND",
        "SCENARIO_OPERATING_LOSS",
        "SCENARIO_COST_ABOVE_PLANNING",
    ]
    for code in codes:
        counts[code] = found.get(code, 0)
    for channel in results.config.online:
        counts[f"ONLINE_LOSS_BEFORE_MARKETING:{channel.id}"] = found.get(f"ONLINE_LOSS_BEFORE_MARKETING:{channel.id}", 0)
        counts[f"ONLINE_BELOW_TARGET:{channel.id}"] = found.get(f"ONLINE_BELOW_TARGET:{channel.id}", 0)
        rows = [r for r in results.ladders if r.channel_id == channel.id]
        same = all(
            (r.alt_pure is None and r.alt_best is None)
            or (r.alt_pure is not None and r.alt_best is not None and _close(r.alt_pure, r.alt_best))
            for r in rows
        )
        if same:  # the workbook tests same-size multiples only; compare where that is equivalent
            counts[f"LADDER_DOMINATED:{channel.id}"] = found.get(f"LADDER_DOMINATED:{channel.id}", 0)
    return counts


def compare(config: Config, recalculated: Path, cells, check_cells) -> VerifyReport:
    results = evaluate(config)
    expected = metrics(results, include_none=True)
    ladder = {f"ladder.{r.channel_id}.{r.card_id}.{r.offer_id}": r for r in results.ladders}
    report = VerifyReport()
    wb = load_workbook(recalculated, data_only=True)
    for ws in wb.worksheets:
        for row in ws.iter_rows():
            for cell in row:
                v = cell.value
                if isinstance(v, str) and (v in ERROR_VALUES or v.startswith("Err:")):
                    report.errors.append(f"{ws.title}!{cell.coordinate} = {v}")

    for key, (sheet, coord) in cells.items():
        actual = wb[sheet][coord].value
        where = f"{key} at {sheet}!{coord}"
        if key.endswith(".dominated"):
            row = ladder[key.rsplit(".", 1)[0]]
            if (row.alt_pure is None) != (row.alt_best is None) or (
                row.alt_pure is not None and not _close(row.alt_pure, row.alt_best)
            ):
                continue  # mixed combinations differ from same-size multiples; engine is authoritative
            want = "DOMINATED" if row.dominated else ("smallest" if row.alt_best is None else "OK")
            report.compared += 1
            if actual != want:
                report.mismatches.append(f"{where}: workbook {actual!r}, engine {want!r}")
            continue
        if key not in expected:
            report.mismatches.append(f"{where}: no engine value with this key")
            continue
        want = expected[key]
        report.compared += 1
        if want is None:
            if _is_number(actual):
                report.mismatches.append(f"{where}: workbook {actual!r}, engine has no value")
        elif not _is_number(actual) or not _close(float(actual), want):
            report.mismatches.append(f"{where}: workbook {actual!r}, engine {want!r}")

    for code, want in expected_check_counts(results).items():
        if code not in check_cells:
            continue
        sheet, coord = check_cells[code]
        actual = wb[sheet][coord].value
        report.checks_compared += 1
        if not _is_number(actual) or int(actual) != want:
            report.mismatches.append(f"check {code} at {sheet}!{coord}: workbook {actual!r}, engine {want}")
    return report


def verify_workbook(config: Config, keep_dir: str | Path | None = None) -> VerifyReport:
    """Build the workbook for ``config``, recalculate it and compare it with the engine."""
    wb, cells, check_cells, _ = build_workbook(config)
    with tempfile.TemporaryDirectory(prefix="ue-verify-") as tmp:
        src = Path(tmp) / "model.xlsx"
        wb.save(src)
        out = recalculate(src, Path(tmp) / "recalculated")
        report = compare(config, out, cells, check_cells)
        if keep_dir:
            dest = Path(keep_dir)
            dest.mkdir(parents=True, exist_ok=True)
            report.kept = str(shutil.copy(out, dest / "model.recalculated.xlsx"))
    return report


def write_recalculated(config: Config, path: str | Path) -> VerifyReport:
    """Write the workbook to ``path`` with values calculated by LibreOffice, after verifying it.

    Files saved straight from openpyxl hold formulas without results, so viewers
    that do not calculate (phone previews, some web viewers) show blanks. This
    writes the LibreOffice-recalculated copy instead, so values show everywhere.
    """
    wb, cells, check_cells, _ = build_workbook(config)
    path = Path(path)
    with tempfile.TemporaryDirectory(prefix="ue-write-") as tmp:
        src = Path(tmp) / path.name
        wb.save(src)
        out = recalculate(src, Path(tmp) / "recalculated")
        report = compare(config, out, cells, check_cells)
        if report.ok:
            path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(out, path)
            report.kept = str(path)
    return report
