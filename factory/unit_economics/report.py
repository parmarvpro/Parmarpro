"""Render results as a Markdown report (for people) or JSON (for automation)."""

from __future__ import annotations

import json
from collections import Counter
from functools import partial

from .fmt import money, number, pct
from .model import Results, SensitivityResult, metrics

SEVERITY_LABEL = {"error": "ERROR", "warning": "WARNING", "info": "INFO"}


def _row(cells: list[str]) -> str:
    return "| " + " | ".join(c.replace("|", "\\|") for c in cells) + " |"


def _table(header: list[str], rows: list[list[str]], align: str | None = None) -> list[str]:
    align = align or "l" + "r" * (len(header) - 1)
    rule = ["---:" if a == "r" else "---" for a in align]
    return [_row(header), "| " + " | ".join(rule) + " |", *(_row(r) for r in rows), ""]


def render_markdown(results: Results, sensitivities: tuple[SensitivityResult, ...] = ()) -> str:
    cfg = results.config
    sym = cfg.meta.currency_symbol
    cur = partial(money, symbol=sym)
    unit = cfg.meta.unit
    out: list[str] = [f"# {cfg.meta.name} — unit economics", ""]
    if cfg.meta.confidential:
        out += ["> **CONFIDENTIAL** — internal planning model with cost and margin data. Do not share outside the company.", ""]
    if cfg.meta.notes:
        out += [cfg.meta.notes.strip(), ""]
    out += [
        f"Amounts are in {sym} per {unit} unless stated. Prices are tax-inclusive; output GST on the product: "
        f"{pct(cfg.product.gst_rate.value)}. MRP: {cur(cfg.product.mrp.value)}.",
        "",
    ]

    out += ["## Findings", ""]
    if results.findings:
        out += _table(
            ["Severity", "Where", "Finding"],
            [[SEVERITY_LABEL[f.severity], f.subject, f.message] for f in results.findings],
            "lll",
        )
    else:
        out += ["No issues found by the configured checks.", ""]

    out += _cost_section(results, cur, unit)
    if results.routes:
        out += _offline_section(results, cur, unit)
    for channel in cfg.online:
        out += _online_section(results, channel, cur, unit)
    if results.scenarios:
        out += _scenario_section(results, cur, unit)
    if sensitivities:
        out += _sensitivity_section(results, sensitivities, cur)
    out += _register_section(results)
    return "\n".join(out).rstrip() + "\n"


def _cost_section(results: Results, cur, unit: str) -> list[str]:
    c = results.cost
    rows = [["Landed product cost", cur(c.landed), "all"]]
    rows += [[r.name, cur(r.amount), ", ".join(r.channels)] for r in c.components]
    rows += [
        ["**All-in planning cost**", f"**{cur(c.all_in)}**", ""],
        ["Loaded cost used for offline routes", cur(c.loaded["offline"]), "offline"],
        ["Loaded cost available to online channels", cur(c.loaded["online"]), "online"],
    ]
    out = ["## 1. Cost build-up", ""]
    out += _table(["Component", f"per {unit}", "Applies to"], rows, "lrl")
    if c.planning_min is not None:
        status = "within" if c.within_planning_range else "OUTSIDE"
        out += [f"Stated planning range {cur(c.planning_min)}–{cur(c.planning_max)}: the build-up is **{status}** it.", ""]
    return out


def _offline_section(results: Results, cur, unit: str) -> list[str]:
    rows = []
    for r in results.routes:
        dist = (
            f"{cur(r.distributor_margin)} ({pct(r.distributor_margin_pct)} of its selling price)"
            if r.distributor_margin is not None
            else "–"
        )
        rows.append(
            [
                r.name,
                r.scheme or "–",
                cur(r.realization),
                cur(r.retailer_cost),
                f"{cur(r.retailer_margin)} ({pct(r.retailer_margin_pct)} of MRP)",
                dist,
                f"{cur(r.gross_contribution)} ({pct(r.gross_margin_pct)})",
                f"{cur(r.contribution)} ({pct(r.contribution_pct)})",
            ]
        )
    out = ["## 2. Offline routes", ""]
    out += [
        f"Brand realization is per {unit} shipped, after any free-goods scheme. Gross contribution uses the landed cost; "
        f"the last column subtracts the loaded offline cost ({cur(results.cost.loaded['offline'])}).",
        "",
    ]
    out += _table(
        [
            "Route",
            "Scheme",
            "Brand realization",
            "Retailer pays",
            "Retailer margin",
            "Distributor margin",
            "Gross contribution",
            "Contribution after loaded cost",
        ],
        rows,
        "llrrrrrr",
    )
    return out


def _online_section(results: Results, channel, cur, unit: str) -> list[str]:
    offers = [o for o in results.offers if o.channel_id == channel.id]
    basis = "loaded" if channel.unit_cost_basis == "loaded" else "landed"
    out = [f"## 3. Online — {channel.name}", ""]
    fee = channel.customer_shipping_fee.value
    fee_text = (
        f"customers pay {cur(fee)} shipping on orders below {cur(channel.free_shipping_threshold.value)}"
        if fee > 0
        else "no shipping fee charged to customers"
    )
    out += [
        f"Product cost uses the **{basis}** cost ({cur(offers[0].unit_cost)} per {unit}); irrecoverable input GST on "
        f"flagged lines: {pct(channel.irrecoverable_input_gst.value)}; {fee_text}.",
        "",
    ]
    line_rows = []
    for line in channel.costs:
        amount = pct(line.amount.value, 2) if line.basis == "pct_of_order_value" else cur(line.amount.value)
        line_rows.append([line.name, line.kind, line.basis.replace("_", " "), amount, "yes" if line.input_gst else "no"])
    out += _table(["Per-order cost line", "Kind", "Basis", "Amount", "Input GST applies"], line_rows, "lllrl")

    header = ["Per order"] + [o.name for o in offers]
    rows = [
        ["Units"] + [str(o.units) for o in offers],
        ["Price"] + [cur(o.price) for o in offers],
        ["MRP value"] + [cur(o.mrp_value) for o in offers],
        ["Discount vs MRP"] + [pct(o.discount_vs_mrp) for o in offers],
        [f"Price per {unit}"] + [cur(o.price_per_unit) for o in offers],
    ]
    if any(o.shipping_fee_income for o in offers):
        rows.append(["Shipping fee paid by customer"] + [cur(o.shipping_fee_income) for o in offers])
    rows.append(["Product cost"] + [cur(o.product_cost) for o in offers])
    for i, line in enumerate(channel.costs):
        rows.append([line.name] + [cur(o.lines[i].amount) for o in offers])
    rows += [
        ["Total variable cost"] + [cur(o.total_cost) for o in offers],
        ["**Contribution per order**"] + [f"**{cur(o.contribution)}**" for o in offers],
        [f"Contribution per {unit}"] + [cur(o.contribution_per_unit) for o in offers],
        ["Contribution margin"] + [pct(o.contribution_margin) for o in offers],
        ["Break-even acquisition cost"] + [cur(o.contribution_before_marketing) for o in offers],
        ["Orders to recover acquisition cost"]
        + [number(o.cac_payback_orders) if o.cac_payback_orders is not None else "never" for o in offers],
        ["Break-even shipping cost"] + [cur(o.break_even_shipping) for o in offers],
    ]
    out += _table(header, rows)

    for card in channel.price_cards:
        card_rows = [r for r in results.ladders if r.channel_id == channel.id and r.card_id == card.id]
        out += [f"### Price ladder — {card.name}", ""]
        rows = []
        for r in card_rows:
            if r.alt_best is None:
                status, alt, alt_cost, saves = "smallest offer", "–", "–", "–"
            else:
                status = "**DOMINATED**" if r.dominated else "ok"
                alt, alt_cost, saves = r.alt_best_combo, cur(r.alt_total), cur(r.saving)
            rows.append([r.offer_name, cur(r.customer_total), cur(r.price_per_unit), alt, alt_cost, saves, status])
        out += _table(
            ["Offer", "Customer pays", f"Per {unit}", "Cheapest mix of smaller offers", "That mix costs", "Pack saves the customer", "Status"],
            rows,
            "lrrlrrl",
        )
    return out


def _scenario_section(results: Results, cur, unit: str) -> list[str]:
    big = partial(cur, decimals=0)
    out = ["## 4. Period scenarios", ""]
    for s in results.scenarios:
        source = "from channel mix" if s.realization_source == "mix" else "input"
        rows = [
            ["Units", number(s.units, 0)],
            [f"Realization per {unit}", f"{cur(s.realization)} ({source})"],
            ["Revenue (net of GST)", big(s.revenue)],
            ["Landed product cost", big(s.landed_total)],
            ["Gross contribution", f"{big(s.gross_contribution)} ({pct(s.gross_margin_pct)})"],
        ]
        rows += [[o.name, big(o.amount)] for o in s.opex]
        rows += [
            ["Total operating costs", big(s.opex_total)],
            ["**Operating contribution**", f"**{big(s.operating_contribution)}** ({pct(s.operating_margin_pct)})"],
            [f"Implied all-in cost per {unit}", cur(s.implied_cost_per_unit)],
            [f"Implied cost per {unit} excluding marketing", cur(s.implied_cost_excl_marketing)],
        ]
        out += [f"### {s.name}", ""]
        out += _table(["Metric", "Amount"], rows, "lr")
    return out


def _sensitivity_section(results: Results, sensitivities: tuple[SensitivityResult, ...], cur) -> list[str]:
    out = ["## 5. Sensitivities", ""]
    for s in sensitivities:
        changes = [f"`{k}` = {v}" for k, v in s.set.items()] + [f"`{k}` × {v}" for k, v in s.scale.items()]
        out.append(f"- **{s.name}**: " + "; ".join(changes))
    out.append("")
    header = ["Result", "Base"] + [s.name for s in sensitivities]
    rows = []
    channel_names = {ch.id: ch.name for ch in results.config.online}
    for i, o in enumerate(results.offers):
        rows.append(
            [f"{channel_names[o.channel_id]} · {o.name} — contribution per order", cur(o.contribution)]
            + [cur(s.results.offers[i].contribution) for s in sensitivities]
        )
    for i, r in enumerate(results.routes):
        rows.append(
            [f"{r.name} — contribution after loaded cost", cur(r.contribution)]
            + [cur(s.results.routes[i].contribution) for s in sensitivities]
        )
    for i, sc in enumerate(results.scenarios):
        rows.append(
            [f"{sc.name} — operating contribution", cur(sc.operating_contribution, decimals=0)]
            + [cur(s.results.scenarios[i].operating_contribution, decimals=0) for s in sensitivities]
        )
    rows.append(["Errors / warnings raised"] + [_counts(results)] + [_counts(s.results) for s in sensitivities])
    out += _table(header, rows)
    return out


def _counts(results: Results) -> str:
    c = Counter(f.severity for f in results.findings)
    return f"{c.get('error', 0)} / {c.get('warning', 0)}"


def _register_section(results: Results) -> list[str]:
    register = results.config.register
    counts = Counter(p.status for p in register)
    summary = ", ".join(f"{n} {status}" for status, n in sorted(counts.items(), key=lambda kv: -kv[1]))
    out = ["## Assumption register", ""]
    out += [
        f"{len(register)} inputs: {summary}. Replace `report`, `assumption` and `unspecified` values with quotes "
        "or actuals as they arrive, and update `status` and `source` when you do.",
        "",
    ]
    rows = [[f"`{p.path}`", _plain(p.value), p.status, p.source or "–"] for p in register]
    out += _table(["Input", "Value", "Status", "Source"], rows, "lrll")
    return out


def _plain(value: float) -> str:
    return f"{value:,.4f}".rstrip("0").rstrip(".") if value != int(value) else f"{int(value):,}"


def to_json(results: Results, sensitivities: tuple[SensitivityResult, ...] = ()) -> str:
    cfg = results.config
    payload = {
        "meta": {
            "name": cfg.meta.name,
            "unit": cfg.meta.unit,
            "currency_symbol": cfg.meta.currency_symbol,
            "confidential": cfg.meta.confidential,
        },
        "findings": [f.__dict__ for f in results.findings],
        "metrics": metrics(results),
        "sensitivities": [
            {
                "id": s.id,
                "name": s.name,
                "set": s.set,
                "scale": s.scale,
                "metrics": metrics(s.results),
                "findings": [f.__dict__ for f in s.results.findings],
            }
            for s in sensitivities
        ],
        "register": [p.__dict__ for p in cfg.register],
    }
    return json.dumps(payload, indent=2, ensure_ascii=False)
