"""Deterministic unit-economics calculations.

All prices are per unit and tax-inclusive (as on an Indian MRP); net figures
divide by ``1 + gst_rate``. Nothing here rounds: rounding happens only when
results are displayed.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .config import Config, OnlineChannel, Scenario, apply_overlay, parse_config


@dataclass(frozen=True)
class ComponentRow:
    id: str
    name: str
    amount: float
    channels: tuple[str, ...]


@dataclass(frozen=True)
class CostBuildup:
    landed: float
    components: tuple[ComponentRow, ...]
    components_total: float
    all_in: float
    loaded: dict[str, float]
    planning_min: float | None
    planning_max: float | None

    @property
    def within_planning_range(self) -> bool | None:
        if self.planning_min is None or self.planning_max is None:
            return None
        return self.planning_min <= self.all_in <= self.planning_max


@dataclass(frozen=True)
class RouteResult:
    id: str
    name: str
    via: str
    scheme: str
    list_price: float
    realization: float
    net_realization: float
    retailer_cost: float
    retailer_margin: float
    retailer_margin_pct: float
    distributor_cost: float | None
    distributor_margin: float | None
    distributor_margin_pct: float | None
    gross_contribution: float
    gross_margin_pct: float
    loaded_cost: float
    contribution: float
    contribution_pct: float


@dataclass(frozen=True)
class LineCost:
    id: str
    name: str
    kind: str
    amount: float


@dataclass(frozen=True)
class OfferResult:
    channel_id: str
    id: str
    name: str
    units: int
    price: float
    mrp_value: float
    discount_vs_mrp: float
    price_per_unit: float
    shipping_fee_income: float
    order_value: float
    net_revenue: float
    unit_cost: float
    product_cost: float
    lines: tuple[LineCost, ...]
    total_cost: float
    contribution: float
    contribution_per_unit: float
    contribution_margin: float
    marketing: float
    contribution_before_marketing: float
    cac_payback_orders: float | None
    shipping: float | None
    break_even_shipping: float | None


@dataclass(frozen=True)
class LadderRow:
    channel_id: str
    card_id: str
    card_name: str
    offer_id: str
    offer_name: str
    units: int
    price: float
    price_per_unit: float
    customer_total: float
    alt_pure: float | None
    alt_pure_combo: str
    alt_best: float | None
    alt_best_combo: str
    alt_total: float | None
    saving: float | None
    dominated: bool
    per_unit_not_decreasing: bool


@dataclass(frozen=True)
class ScenarioResult:
    id: str
    name: str
    units: float
    realization: float
    realization_source: str
    revenue: float
    landed_total: float
    gross_contribution: float
    gross_margin_pct: float
    opex: tuple[LineCost, ...]
    opex_total: float
    operating_contribution: float
    operating_margin_pct: float
    opex_per_unit: float
    implied_cost_per_unit: float
    implied_cost_excl_marketing: float


@dataclass(frozen=True)
class Finding:
    severity: str  # "error" | "warning" | "info"
    code: str
    subject: str
    message: str
    ref: str = ""  # machine-readable location, e.g. "d2c.full.pack12" or a route id


@dataclass(frozen=True)
class Results:
    config: Config
    cost: CostBuildup
    routes: tuple[RouteResult, ...]
    offers: tuple[OfferResult, ...]
    ladders: tuple[LadderRow, ...]
    scenarios: tuple[ScenarioResult, ...]
    findings: tuple[Finding, ...]


@dataclass(frozen=True)
class SensitivityResult:
    id: str
    name: str
    set: dict[str, Any]
    scale: dict[str, float]
    results: Results


# --------------------------------------------------------------------------- evaluation


def evaluate(config: Config) -> Results:
    """Compute every result for a config, including the consistency findings."""
    from .checks import find_issues

    cost = cost_buildup(config)
    routes = tuple(route_result(config, cost, r) for r in config.routes)
    offers = tuple(o for ch in config.online for o in channel_offers(config, cost, ch))
    ladders = tuple(row for ch in config.online for row in channel_ladder(ch))
    scenarios = tuple(scenario_result(config, s) for s in config.scenarios)
    partial = Results(config, cost, routes, offers, ladders, scenarios, ())
    return Results(config, cost, routes, offers, ladders, scenarios, find_issues(partial))


def run_sensitivities(config: Config) -> tuple[SensitivityResult, ...]:
    """Re-evaluate the config once per configured sensitivity overlay."""
    out = []
    for sens in config.sensitivities:
        raw = apply_overlay(config.raw, sens.set, sens.scale)
        out.append(SensitivityResult(sens.id, sens.name, sens.set, sens.scale, evaluate(parse_config(raw))))
    return tuple(out)


def cost_buildup(config: Config) -> CostBuildup:
    product = config.product
    rows = tuple(ComponentRow(c.id, c.name, c.amount.value, c.channels) for c in product.components)
    landed = product.landed_cost.value
    total = sum(r.amount for r in rows)
    loaded = {
        channel: landed + sum(r.amount for r in rows if channel in r.channels)
        for channel in ("offline", "online")
    }
    return CostBuildup(
        landed=landed,
        components=rows,
        components_total=total,
        all_in=landed + total,
        loaded=loaded,
        planning_min=product.planning_cost_min.value if product.planning_cost_min else None,
        planning_max=product.planning_cost_max.value if product.planning_cost_max else None,
    )


def route_result(config: Config, cost: CostBuildup, route) -> RouteResult:
    mrp = config.product.mrp.value
    gst = config.product.gst_rate.value
    factor = route.scheme_buy / (route.scheme_buy + route.scheme_free) if route.scheme_free else 1.0
    realization = route.price.value * factor
    net = realization / (1 + gst)
    if route.via == "direct":
        retailer_cost = realization
        distributor_cost = distributor_margin = distributor_margin_pct = None
    else:
        distributor_cost = realization
        retailer_cost = route.retailer_price.value
        distributor_margin = retailer_cost - distributor_cost
        distributor_margin_pct = distributor_margin / retailer_cost
    gross = net - cost.landed
    loaded = cost.loaded["offline"]
    contribution = net - loaded
    return RouteResult(
        id=route.id,
        name=route.name,
        via=route.via,
        scheme=route.scheme,
        list_price=route.price.value,
        realization=realization,
        net_realization=net,
        retailer_cost=retailer_cost,
        retailer_margin=mrp - retailer_cost,
        retailer_margin_pct=(mrp - retailer_cost) / mrp,
        distributor_cost=distributor_cost,
        distributor_margin=distributor_margin,
        distributor_margin_pct=distributor_margin_pct,
        gross_contribution=gross,
        gross_margin_pct=gross / net,
        loaded_cost=loaded,
        contribution=contribution,
        contribution_pct=contribution / net,
    )


def shipping_fee(channel: OnlineChannel, items_total: float) -> float:
    """Fee the customer pays on an order whose item total is ``items_total``."""
    fee = channel.customer_shipping_fee.value
    return fee if fee > 0 and items_total < channel.free_shipping_threshold.value else 0.0


def channel_offers(config: Config, cost: CostBuildup, channel: OnlineChannel) -> list[OfferResult]:
    mrp = config.product.mrp.value
    gst = config.product.gst_rate.value
    uplift = channel.irrecoverable_input_gst.value
    unit_cost = cost.loaded["online"] if channel.unit_cost_basis == "loaded" else cost.landed
    results = []
    for offer in channel.offers:
        price = offer.price.value
        fee = shipping_fee(channel, price)
        order_value = price + fee
        net_revenue = order_value / (1 + gst)
        product_cost = offer.units * unit_cost
        lines = []
        for line in channel.costs:
            if line.basis == "per_order":
                base = line.amount.value
            elif line.basis == "per_unit":
                base = line.amount.value * offer.units
            else:
                base = line.amount.value * order_value
            lines.append(LineCost(line.id, line.name, line.kind, base * (1 + uplift) if line.input_gst else base))
        total = product_cost + sum(l.amount for l in lines)
        contribution = net_revenue - total
        marketing = sum(l.amount for l in lines if l.kind == "marketing")
        before_marketing = contribution + marketing
        if marketing == 0:
            payback = 0.0
        elif before_marketing > 0:
            payback = marketing / before_marketing
        else:
            payback = None
        shipping_lines = [l.amount for l in lines if l.kind == "shipping"]
        shipping = sum(shipping_lines) if shipping_lines else None
        results.append(
            OfferResult(
                channel_id=channel.id,
                id=offer.id,
                name=offer.name,
                units=offer.units,
                price=price,
                mrp_value=offer.units * mrp,
                discount_vs_mrp=1 - price / (offer.units * mrp),
                price_per_unit=price / offer.units,
                shipping_fee_income=fee,
                order_value=order_value,
                net_revenue=net_revenue,
                unit_cost=unit_cost,
                product_cost=product_cost,
                lines=tuple(lines),
                total_cost=total,
                contribution=contribution,
                contribution_per_unit=contribution / offer.units,
                contribution_margin=contribution / net_revenue,
                marketing=marketing,
                contribution_before_marketing=before_marketing,
                cac_payback_orders=payback,
                shipping=shipping,
                break_even_shipping=shipping + contribution if shipping is not None else None,
            )
        )
    return results


def cheapest_combination(target: int, options: list[tuple[str, int, float]]) -> tuple[float | None, str]:
    """Cheapest way to buy exactly ``target`` units from (name, units, price) options.

    Each option may be used any number of times. Returns (cost, description),
    or (None, "") when no combination adds up to the target.
    """
    best: list[tuple[float, dict[str, int]] | None] = [None] * (target + 1)
    best[0] = (0.0, {})
    for n in range(1, target + 1):
        for name, units, price in options:
            if units <= n and best[n - units] is not None:
                cost = best[n - units][0] + price
                if best[n] is None or cost < best[n][0] - 1e-12:
                    counts = dict(best[n - units][1])
                    counts[name] = counts.get(name, 0) + 1
                    best[n] = (cost, counts)
    if best[target] is None:
        return None, ""
    cost, counts = best[target]
    order = {name: i for i, (name, _, _) in enumerate(options)}
    combo = " + ".join(f"{k} × {name}" for name, k in sorted(counts.items(), key=lambda kv: order[kv[0]]))
    return cost, combo


def cheapest_same_size_multiple(target: int, options: list[tuple[str, int, float]]) -> tuple[float | None, str]:
    """Cheapest alternative made of a single smaller offer bought k times (k × units == target)."""
    candidates = [(price * (target // units), f"{target // units} × {name}") for name, units, price in options if target % units == 0]
    if not candidates:
        return None, ""
    return min(candidates, key=lambda c: c[0])


def channel_ladder(channel: OnlineChannel) -> list[LadderRow]:
    by_id = {o.id: o for o in channel.offers}
    rows = []
    for card in channel.price_cards:
        offers = sorted((by_id[i] for i in card.offer_ids), key=lambda o: o.units)
        prev_per_unit = None
        for offer in offers:
            smaller = [(o.name, o.units, o.price.value) for o in offers if o.units < offer.units]
            alt_pure, pure_combo = cheapest_same_size_multiple(offer.units, smaller)
            alt_best, best_combo = cheapest_combination(offer.units, smaller)
            price = offer.price.value
            total = price + shipping_fee(channel, price)
            alt_total = alt_best + shipping_fee(channel, alt_best) if alt_best is not None else None
            saving = alt_total - total if alt_total is not None else None
            per_unit = price / offer.units
            rows.append(
                LadderRow(
                    channel_id=channel.id,
                    card_id=card.id,
                    card_name=card.name,
                    offer_id=offer.id,
                    offer_name=offer.name,
                    units=offer.units,
                    price=price,
                    price_per_unit=per_unit,
                    customer_total=total,
                    alt_pure=alt_pure,
                    alt_pure_combo=pure_combo,
                    alt_best=alt_best,
                    alt_best_combo=best_combo,
                    alt_total=alt_total,
                    saving=saving,
                    dominated=saving is not None and saving <= 1e-9,
                    per_unit_not_decreasing=prev_per_unit is not None and per_unit >= prev_per_unit - 1e-9,
                )
            )
            prev_per_unit = per_unit
    return rows


def scenario_result(config: Config, scenario: Scenario) -> ScenarioResult:
    gst = config.product.gst_rate.value
    landed = config.product.landed_cost.value
    units = scenario.units.value
    if scenario.mix:
        realization = sum(m.share.value * m.realization.value for m in scenario.mix)
        source = "mix"
    else:
        realization = scenario.blended_realization.value
        source = "input"
    revenue = units * realization / (1 + gst)
    landed_total = units * landed
    gross = revenue - landed_total
    opex = tuple(LineCost(o.id, o.name, o.kind, o.amount.value) for o in scenario.opex)
    opex_total = sum(o.amount for o in opex)
    marketing = sum(o.amount for o in opex if o.kind == "marketing")
    operating = gross - opex_total
    return ScenarioResult(
        id=scenario.id,
        name=scenario.name,
        units=units,
        realization=realization,
        realization_source=source,
        revenue=revenue,
        landed_total=landed_total,
        gross_contribution=gross,
        gross_margin_pct=gross / revenue if revenue else 0.0,
        opex=opex,
        opex_total=opex_total,
        operating_contribution=operating,
        operating_margin_pct=operating / revenue if revenue else 0.0,
        opex_per_unit=opex_total / units,
        implied_cost_per_unit=landed + opex_total / units,
        implied_cost_excl_marketing=landed + (opex_total - marketing) / units,
    )


# --------------------------------------------------------------------------- flat metrics


def metrics(results: Results, include_none: bool = False) -> dict[str, float | None]:
    """Flatten the numeric results into ``{dotted.key: value}`` for comparisons and JSON.

    Values that do not exist (e.g. a distributor margin on a direct route, or the
    payback of an offer that never recovers its acquisition cost) are left out,
    or kept as ``None`` with ``include_none=True``.
    """
    m: dict[str, float | None] = {}
    c = results.cost
    m["cost.landed"] = c.landed
    m["cost.components_total"] = c.components_total
    m["cost.all_in"] = c.all_in
    for channel, value in c.loaded.items():
        m[f"cost.loaded.{channel}"] = value
    for r in results.routes:
        p = f"routes.{r.id}"
        for key in (
            "realization",
            "net_realization",
            "retailer_cost",
            "retailer_margin",
            "retailer_margin_pct",
            "distributor_margin",
            "distributor_margin_pct",
            "gross_contribution",
            "gross_margin_pct",
            "loaded_cost",
            "contribution",
            "contribution_pct",
        ):
            value = getattr(r, key)
            if value is not None or include_none:
                m[f"{p}.{key}"] = value
    for o in results.offers:
        p = f"online.{o.channel_id}.{o.id}"
        for key in (
            "mrp_value",
            "discount_vs_mrp",
            "price_per_unit",
            "shipping_fee_income",
            "order_value",
            "net_revenue",
            "product_cost",
            "total_cost",
            "contribution",
            "contribution_per_unit",
            "contribution_margin",
            "marketing",
            "contribution_before_marketing",
            "cac_payback_orders",
            "break_even_shipping",
        ):
            value = getattr(o, key)
            if value is not None or include_none:
                m[f"{p}.{key}"] = value
        for line in o.lines:
            m[f"{p}.line.{line.id}"] = line.amount
    for row in results.ladders:
        p = f"ladder.{row.channel_id}.{row.card_id}.{row.offer_id}"
        m[f"{p}.customer_total"] = row.customer_total
        if row.alt_pure is not None or include_none:
            m[f"{p}.alt_pure"] = row.alt_pure
        if row.alt_best is not None or include_none:
            m[f"{p}.alt_best"] = row.alt_best
        m[f"{p}.dominated"] = 1.0 if row.dominated else 0.0
    for s in results.scenarios:
        p = f"scenarios.{s.id}"
        for key in (
            "units",
            "realization",
            "revenue",
            "landed_total",
            "gross_contribution",
            "gross_margin_pct",
            "opex_total",
            "operating_contribution",
            "operating_margin_pct",
            "opex_per_unit",
            "implied_cost_per_unit",
            "implied_cost_excl_marketing",
        ):
            m[f"{p}.{key}"] = getattr(s, key)
    return m
