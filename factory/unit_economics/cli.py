"""Command line: python -m unit_economics {report,check,workbook,verify} CONFIG."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .config import ConfigError, load_config
from .model import evaluate, run_sensitivities
from .report import SEVERITY_LABEL, render_markdown, to_json


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m unit_economics", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("report", help="write the Markdown report (and optionally JSON)")
    p.add_argument("config")
    p.add_argument("--out", help="Markdown file to write (default: stdout)")
    p.add_argument("--json", help="also write all metrics and findings as JSON")

    p = sub.add_parser("check", help="list findings; exit 1 if any error (or warning with --strict)")
    p.add_argument("config")
    p.add_argument("--strict", action="store_true", help="treat warnings as failures too")

    p = sub.add_parser("workbook", help="write an .xlsx model with live formulas (needs openpyxl)")
    p.add_argument("config")
    p.add_argument("--out", required=True, help=".xlsx file to write")
    p.add_argument(
        "--formulas-only",
        action="store_true",
        help="skip the LibreOffice recalculation (the file then shows values only in apps that calculate on open)",
    )

    p = sub.add_parser(
        "verify",
        help="build the workbook, recalculate it in LibreOffice and compare every result with this engine",
    )
    p.add_argument("config")
    p.add_argument("--keep", help="directory to keep the recalculated workbook in")

    args = parser.parse_args(argv)
    try:
        config = load_config(args.config)
    except (ConfigError, OSError) as exc:
        print(f"config error: {exc}", file=sys.stderr)
        return 2
    results = evaluate(config)

    if args.command == "report":
        sens = run_sensitivities(config)
        text = render_markdown(results, sens)
        if args.out:
            Path(args.out).write_text(text, encoding="utf-8")
            print(f"wrote {args.out}")
        else:
            sys.stdout.write(text)
        if args.json:
            Path(args.json).write_text(to_json(results, sens), encoding="utf-8")
            print(f"wrote {args.json}")
        return 0

    if args.command == "check":
        for f in results.findings:
            print(f"{SEVERITY_LABEL[f.severity]:8} {f.code}: {f.subject} — {f.message}")
        errors = sum(f.severity == "error" for f in results.findings)
        warnings = sum(f.severity == "warning" for f in results.findings)
        print(f"{errors} error(s), {warnings} warning(s), {len(results.findings) - errors - warnings} info")
        return 1 if errors or (args.strict and warnings) else 0

    if args.command == "workbook":
        from .verify import LibreOfficeMissing, write_recalculated
        from .workbook import save_workbook

        if not args.formulas_only:
            try:
                report = write_recalculated(config, args.out)
            except LibreOfficeMissing:
                print("LibreOffice not found: writing formulas without stored results.", file=sys.stderr)
            else:
                print(report.summary())
                if not report.ok:
                    print("not written: the workbook disagrees with the engine", file=sys.stderr)
                    return 1
                print(f"wrote {args.out} (verified, with calculated values)")
                return 0
        save_workbook(config, args.out)
        print(f"wrote {args.out} (formulas only; Excel, LibreOffice and Google Sheets calculate them on open)")
        return 0

    from .verify import verify_workbook

    report = verify_workbook(config, keep_dir=args.keep)
    print(report.summary())
    return 0 if report.ok else 1
