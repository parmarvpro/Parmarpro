"""Business-rule checks that turn computed results into findings.

Severity:
  error   - the price structure is broken (a bigger pack is no cheaper, an
            offer loses money before any marketing, a partner margin is negative)
  warning - below a configured target; a decision is needed
  info    - worth knowing; no change required by itself
"""

from __future__ import annotations

from functools import partial

from .fmt import money, pct
from .model import Finding, Results

SEVERITY_ORDER = {"error": 0, "warning": 1, "info": 2}


def find_issues(results: Results) -> tuple[Finding, ...]:
    cfg = results.config
    cur = partial(money, symbol=cfg.meta.currency_symbol)
    unit = cfg.meta.unit
    targets = cfg.targets
    out: list[Finding] = []

    cost = results.cost
    if cost.within_planning_range is False:
        out.append(
            Finding(
                "warning",
                "PLANNING_COST_OUT_OF_RANGE",
                "Cost build-up",
                f"Landed cost plus allocations is {cur(cost.all_in)} per {unit}, outside the stated "
                f"planning range {cur(cost.planning_min)}–{cur(cost.planning_max)}.",
            )
        )

    channel_names = {ch.id: ch.name for ch in cfg.online}
    for row in results.ladders:
        subject = f"{channel_names[row.channel_id]} · {row.card_name} · {row.offer_name}"
        if row.dominated:
            relation = "is no cheaper" if abs(row.saving) <= 1e-9 else f"is {cur(-row.saving)} dearer"
            out.append(
                Finding(
                    "error",
                    "LADDER_DOMINATED",
                    subject,
                    f"{row.offer_name} costs the customer {cur(row.customer_total)}, but buying "
                    f"{row.alt_best_combo} costs {cur(row.alt_total)}: the larger pack {relation}, "
                    f"so it gives no reason to trade up.",
                    f"{row.channel_id}.{row.card_id}.{row.offer_id}",
                )
            )
        elif row.per_unit_not_decreasing:
            out.append(
                Finding(
                    "warning",
                    "LADDER_PER_UNIT",
                    subject,
                    f"Price per {unit} ({cur(row.price_per_unit)}) does not fall versus the next smaller offer.",
                    f"{row.channel_id}.{row.card_id}.{row.offer_id}",
                )
            )

    min_online = targets.min_online_contribution.value if targets.min_online_contribution else None
    for o in results.offers:
        subject = f"{channel_names[o.channel_id]} · {o.name}"
        if o.contribution_before_marketing <= 0:
            out.append(
                Finding(
                    "error",
                    "ONLINE_LOSS_BEFORE_MARKETING",
                    subject,
                    f"At {cur(o.price)}, loses {cur(-o.contribution_before_marketing)} per order before any marketing spend; "
                    f"no acquisition cost can be recovered.",
                    f"{o.channel_id}.{o.id}",
                )
            )
        elif min_online is not None and o.contribution < min_online - 1e-9:
            payback = (
                f" Recovering the {cur(o.marketing)} acquisition cost takes {o.cac_payback_orders:.2f} orders."
                if o.cac_payback_orders
                else ""
            )
            out.append(
                Finding(
                    "warning",
                    "ONLINE_BELOW_TARGET",
                    subject,
                    f"At {cur(o.price)}, contribution after marketing is {cur(o.contribution)} per order (target {cur(min_online)}). "
                    f"Break-even acquisition cost is {cur(o.contribution_before_marketing)} versus "
                    f"{cur(o.marketing)} assumed.{payback}",
                    f"{o.channel_id}.{o.id}",
                )
            )

    min_offline = targets.min_offline_contribution.value if targets.min_offline_contribution else None
    min_gross = targets.min_gross_margin.value if targets.min_gross_margin else None
    band = (
        (targets.retailer_margin_min.value, targets.retailer_margin_max.value)
        if targets.retailer_margin_min and targets.retailer_margin_max
        else None
    )
    for r in results.routes:
        if r.distributor_margin is not None and r.distributor_margin < 0:
            out.append(
                Finding(
                    "error",
                    "NEGATIVE_DISTRIBUTOR_MARGIN",
                    r.name,
                    f"The distributor buys at {cur(r.distributor_cost)} and sells at {cur(r.retailer_cost)}: "
                    f"a margin of {cur(r.distributor_margin)}.",
                    r.id,
                )
            )
        if min_offline is not None and r.contribution < min_offline - 1e-9:
            out.append(
                Finding(
                    "warning",
                    "OFFLINE_BELOW_TARGET",
                    r.name,
                    f"Contribution after the {cur(r.loaded_cost)} loaded cost is {cur(r.contribution)} per {unit} "
                    f"(target {cur(min_offline)}).",
                    r.id,
                )
            )
        if min_gross is not None and r.gross_margin_pct < min_gross - 1e-9:
            out.append(
                Finding(
                    "warning",
                    "GROSS_MARGIN_BELOW_TARGET",
                    r.name,
                    f"Gross margin on landed cost is {pct(r.gross_margin_pct)} (target {pct(min_gross)}).",
                    r.id,
                )
            )
        if band and not (band[0] - 1e-9 <= r.retailer_margin_pct <= band[1] + 1e-9):
            out.append(
                Finding(
                    "info",
                    "RETAILER_MARGIN_OUTSIDE_BAND",
                    r.name,
                    f"Retailer margin is {pct(r.retailer_margin_pct)} of MRP ({cur(r.retailer_margin)} per {unit}), "
                    f"outside the {pct(band[0])}–{pct(band[1])} band.",
                    r.id,
                )
            )

    for s in results.scenarios:
        if s.operating_contribution < 0:
            out.append(
                Finding(
                    "error",
                    "SCENARIO_OPERATING_LOSS",
                    s.name,
                    f"Operating contribution is {cur(s.operating_contribution, decimals=0)} for the period.",
                    s.id,
                )
            )
        if cost.planning_max is not None and s.implied_cost_per_unit > cost.planning_max + 1e-9:
            note = (
                " The planning range appears to exclude marketing."
                if s.implied_cost_excl_marketing <= cost.planning_max + 1e-9
                else ""
            )
            out.append(
                Finding(
                    "info",
                    "SCENARIO_COST_ABOVE_PLANNING",
                    s.name,
                    f"Implies {cur(s.implied_cost_per_unit)} per {unit} all-in "
                    f"({cur(s.implied_cost_excl_marketing)} excluding marketing), above the "
                    f"{cur(cost.planning_max)} top of the planning range.{note}",
                    s.id,
                )
            )

    return tuple(sorted(out, key=lambda f: SEVERITY_ORDER[f.severity]))
