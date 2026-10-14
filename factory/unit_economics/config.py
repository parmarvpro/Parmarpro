"""Load, overlay and validate unit-economics configs written in TOML.

Every numeric input is a :class:`Param` that carries its value together with
where it came from (``source``) and how trustworthy it is (``status``), so the
model can always say which numbers are evidence and which are assumptions.
"""

from __future__ import annotations

import copy
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

STATUSES = ("report", "assumption", "research", "quote", "actual", "unspecified")
CHANNELS = ("offline", "online")
BASES = ("per_order", "per_unit", "pct_of_order_value")
KINDS = ("shipping", "marketing", "payment", "other")
UNIT_COST_BASES = ("landed", "loaded")
VIA = ("direct", "distributor")


class ConfigError(ValueError):
    """A config is missing data or contains an invalid value."""


@dataclass(frozen=True)
class Param:
    """A numeric input with its provenance."""

    value: float
    source: str = ""
    status: str = "unspecified"
    path: str = ""


@dataclass(frozen=True)
class Meta:
    name: str
    unit: str
    currency_symbol: str
    confidential: bool
    notes: str


@dataclass(frozen=True)
class Component:
    """A per-unit cost allocation added on top of the landed product cost."""

    id: str
    name: str
    amount: Param
    channels: tuple[str, ...]


@dataclass(frozen=True)
class Product:
    mrp: Param
    landed_cost: Param
    gst_rate: Param
    planning_cost_min: Param | None
    planning_cost_max: Param | None
    components: tuple[Component, ...]


@dataclass(frozen=True)
class Route:
    """One offline route to market, e.g. brand -> distributor -> retailer."""

    id: str
    name: str
    via: str
    price: Param
    retailer_price: Param | None
    scheme_buy: int
    scheme_free: int

    @property
    def scheme(self) -> str:
        return f"{self.scheme_buy}+{self.scheme_free}" if self.scheme_free else ""


@dataclass(frozen=True)
class CostLine:
    """A per-order cost of an online channel."""

    id: str
    name: str
    kind: str
    basis: str
    amount: Param
    input_gst: bool


@dataclass(frozen=True)
class Offer:
    id: str
    name: str
    units: int
    price: Param


@dataclass(frozen=True)
class PriceCard:
    """A set of offers that are on sale at the same time."""

    id: str
    name: str
    offer_ids: tuple[str, ...]


@dataclass(frozen=True)
class OnlineChannel:
    id: str
    name: str
    unit_cost_basis: str
    irrecoverable_input_gst: Param
    customer_shipping_fee: Param
    free_shipping_threshold: Param
    costs: tuple[CostLine, ...]
    offers: tuple[Offer, ...]
    price_cards: tuple[PriceCard, ...]


@dataclass(frozen=True)
class MixItem:
    name: str
    share: Param
    realization: Param


@dataclass(frozen=True)
class OpexLine:
    id: str
    name: str
    kind: str
    amount: Param


@dataclass(frozen=True)
class Scenario:
    id: str
    name: str
    units: Param
    blended_realization: Param | None
    mix: tuple[MixItem, ...]
    opex: tuple[OpexLine, ...]


@dataclass(frozen=True)
class Targets:
    retailer_margin_min: Param | None
    retailer_margin_max: Param | None
    min_gross_margin: Param | None
    min_offline_contribution: Param | None
    min_online_contribution: Param | None


@dataclass(frozen=True)
class Sensitivity:
    id: str
    name: str
    set: dict[str, Any]
    scale: dict[str, float]


@dataclass(frozen=True)
class Config:
    meta: Meta
    product: Product
    routes: tuple[Route, ...]
    online: tuple[OnlineChannel, ...]
    scenarios: tuple[Scenario, ...]
    targets: Targets
    sensitivities: tuple[Sensitivity, ...]
    register: tuple[Param, ...]
    raw: dict[str, Any]


# --------------------------------------------------------------------------- reading


def load_config(path: str | Path) -> Config:
    """Read a TOML config file and return a validated :class:`Config`."""
    path = Path(path)
    try:
        with path.open("rb") as fh:
            raw = tomllib.load(fh)
    except tomllib.TOMLDecodeError as exc:
        raise ConfigError(f"{path}: invalid TOML: {exc}") from exc
    return parse_config(raw)


def parse_config(raw: dict[str, Any]) -> Config:
    """Validate a raw config dict (as read from TOML) and build a :class:`Config`."""
    reader = _Reader()
    meta = _parse_meta(_table(raw, "meta", "meta"))
    product = _parse_product(reader, _table(raw, "product", "product"))
    routes = _parse_routes(reader, _table(raw, "offline", "offline", required=False))
    online = _parse_online(reader, _list(raw, "online", "online"))
    scenarios = _parse_scenarios(reader, _list(raw, "scenarios", "scenarios"))
    targets = _parse_targets(reader, _table(raw, "targets", "targets", required=False))
    sensitivities = _parse_sensitivities(_list(raw, "sensitivities", "sensitivities"))
    return Config(
        meta=meta,
        product=product,
        routes=routes,
        online=online,
        scenarios=scenarios,
        targets=targets,
        sensitivities=sensitivities,
        register=tuple(reader.register),
        raw=copy.deepcopy(raw),
    )


class _Reader:
    """Reads Params and records every one of them in an assumption register."""

    def __init__(self) -> None:
        self.register: list[Param] = []

    def param(
        self,
        table: dict[str, Any],
        key: str,
        path: str,
        *,
        default: float | None = None,
        required: bool = True,
        minimum: float | None = None,
        maximum: float | None = None,
        item: dict[str, Any] | None = None,
    ) -> Param | None:
        raw = table.get(key)
        item = item or {}
        if raw is None:
            if default is None:
                if required:
                    raise ConfigError(f"{path}: required value is missing")
                return None
            param = Param(float(default), "default (not set in config)", "unspecified", path)
        else:
            if isinstance(raw, dict):
                if "value" not in raw:
                    raise ConfigError(f"{path}: an inline table needs a 'value' key")
                value = _number(raw["value"], path)
                source = raw.get("source", item.get("source", ""))
                status = raw.get("status", item.get("status", "unspecified"))
            else:
                value = _number(raw, path)
                source = item.get("source", "")
                status = item.get("status", "unspecified")
            if status not in STATUSES:
                raise ConfigError(f"{path}: status must be one of {', '.join(STATUSES)}, got {status!r}")
            param = Param(value, str(source), str(status), path)
        if minimum is not None and param.value < minimum:
            raise ConfigError(f"{path}: must be >= {minimum}, got {param.value}")
        if maximum is not None and param.value > maximum:
            raise ConfigError(f"{path}: must be <= {maximum}, got {param.value}")
        self.register.append(param)
        return param


def _number(value: Any, path: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ConfigError(f"{path}: expected a number, got {value!r}")
    return float(value)


def _table(raw: dict[str, Any], key: str, path: str, required: bool = True) -> dict[str, Any]:
    value = raw.get(key)
    if value is None:
        if required:
            raise ConfigError(f"{path}: section is missing")
        return {}
    if not isinstance(value, dict):
        raise ConfigError(f"{path}: expected a table")
    return value


def _list(raw: dict[str, Any], key: str, path: str) -> list[dict[str, Any]]:
    value = raw.get(key, [])
    if not isinstance(value, list) or not all(isinstance(v, dict) for v in value):
        raise ConfigError(f"{path}: expected an array of tables ([[{path}]])")
    return value


def _text(table: dict[str, Any], key: str, path: str, default: str | None = None) -> str:
    value = table.get(key, default)
    if value is None:
        raise ConfigError(f"{path}.{key}: required text is missing")
    if not isinstance(value, str) or not value.strip():
        raise ConfigError(f"{path}.{key}: expected non-empty text, got {value!r}")
    return value


def _choice(table: dict[str, Any], key: str, path: str, choices: tuple[str, ...], default: str) -> str:
    value = table.get(key, default)
    if value not in choices:
        raise ConfigError(f"{path}.{key}: must be one of {', '.join(choices)}, got {value!r}")
    return value


def _ids(items: list[dict[str, Any]], path: str) -> list[str]:
    ids = []
    for i, item in enumerate(items):
        ident = _text(item, "id", f"{path}[{i}]")
        if ident in ids:
            raise ConfigError(f"{path}: duplicate id {ident!r}")
        if "." in ident:
            raise ConfigError(f"{path}: id {ident!r} must not contain '.'")
        ids.append(ident)
    return ids


def _parse_meta(table: dict[str, Any]) -> Meta:
    return Meta(
        name=_text(table, "name", "meta"),
        unit=_text(table, "unit", "meta", "unit"),
        currency_symbol=_text(table, "currency_symbol", "meta", "₹"),
        confidential=bool(table.get("confidential", False)),
        notes=str(table.get("notes", "")),
    )


def _parse_product(reader: _Reader, table: dict[str, Any]) -> Product:
    mrp = reader.param(table, "mrp", "product.mrp", minimum=0.01)
    landed = reader.param(table, "landed_cost", "product.landed_cost", minimum=0)
    gst = reader.param(table, "gst_rate", "product.gst_rate", default=0.0, minimum=0, maximum=1)
    pmin = reader.param(table, "planning_cost_min", "product.planning_cost_min", required=False, minimum=0)
    pmax = reader.param(table, "planning_cost_max", "product.planning_cost_max", required=False, minimum=0)
    if (pmin is None) != (pmax is None):
        raise ConfigError("product: set both planning_cost_min and planning_cost_max, or neither")
    if pmin is not None and pmax is not None and pmin.value > pmax.value:
        raise ConfigError("product: planning_cost_min is greater than planning_cost_max")
    items = _list(table, "components", "product.components")
    ids = _ids(items, "product.components")
    components = []
    for ident, item in zip(ids, items):
        path = f"product.components.{ident}"
        channels = item.get("channels", list(CHANNELS))
        if not isinstance(channels, list) or not channels or any(c not in CHANNELS for c in channels):
            raise ConfigError(f"{path}.channels: use a non-empty list drawn from {', '.join(CHANNELS)}")
        components.append(
            Component(
                id=ident,
                name=_text(item, "name", path),
                amount=reader.param(item, "amount", f"{path}.amount", minimum=0, item=item),
                channels=tuple(channels),
            )
        )
    return Product(mrp, landed, gst, pmin, pmax, tuple(components))


def _parse_scheme(value: Any, path: str) -> tuple[int, int]:
    if value in (None, ""):
        return 0, 0
    if isinstance(value, str):
        parts = value.replace(" ", "").split("+")
        if len(parts) != 2 or not all(p.isdigit() for p in parts):
            raise ConfigError(f"{path}: scheme must look like '10+1', got {value!r}")
        buy, free = int(parts[0]), int(parts[1])
    elif isinstance(value, dict):
        buy, free = value.get("buy"), value.get("free")
        if not isinstance(buy, int) or not isinstance(free, int):
            raise ConfigError(f"{path}: scheme table needs integer 'buy' and 'free'")
    else:
        raise ConfigError(f"{path}: scheme must be text like '10+1' or a table")
    if buy < 1 or free < 0:
        raise ConfigError(f"{path}: scheme needs buy >= 1 and free >= 0")
    return buy, free


def _parse_routes(reader: _Reader, table: dict[str, Any]) -> tuple[Route, ...]:
    items = _list(table, "routes", "offline.routes")
    ids = _ids(items, "offline.routes")
    routes = []
    for ident, item in zip(ids, items):
        path = f"offline.routes.{ident}"
        via = _choice(item, "via", path, VIA, "direct")
        price = reader.param(item, "price", f"{path}.price", minimum=0.01, item=item)
        retailer_price = None
        if via == "distributor":
            retailer_price = reader.param(item, "retailer_price", f"{path}.retailer_price", minimum=0.01, item=item)
        elif "retailer_price" in item:
            raise ConfigError(f"{path}: retailer_price only applies to via = 'distributor'")
        buy, free = _parse_scheme(item.get("scheme"), f"{path}.scheme")
        routes.append(Route(ident, _text(item, "name", path), via, price, retailer_price, buy, free))
    return tuple(routes)


def _parse_online(reader: _Reader, items: list[dict[str, Any]]) -> tuple[OnlineChannel, ...]:
    ids = _ids(items, "online")
    channels = []
    for ident, item in zip(ids, items):
        path = f"online.{ident}"
        cost_items = _list(item, "costs", f"{path}.costs")
        cost_ids = _ids(cost_items, f"{path}.costs")
        costs = []
        for cid, citem in zip(cost_ids, cost_items):
            cpath = f"{path}.costs.{cid}"
            basis = _choice(citem, "basis", cpath, BASES, "per_order")
            amount = reader.param(
                citem,
                "amount",
                f"{cpath}.amount",
                minimum=0,
                maximum=1 if basis == "pct_of_order_value" else None,
                item=citem,
            )
            costs.append(
                CostLine(
                    id=cid,
                    name=_text(citem, "name", cpath),
                    kind=_choice(citem, "kind", cpath, KINDS, "other"),
                    basis=basis,
                    amount=amount,
                    input_gst=bool(citem.get("input_gst", False)),
                )
            )
        offer_items = _list(item, "offers", f"{path}.offers")
        if not offer_items:
            raise ConfigError(f"{path}: define at least one [[online.offers]] entry")
        offer_ids = _ids(offer_items, f"{path}.offers")
        offers = []
        for oid, oitem in zip(offer_ids, offer_items):
            opath = f"{path}.offers.{oid}"
            units = oitem.get("units")
            if isinstance(units, bool) or not isinstance(units, int) or units < 1:
                raise ConfigError(f"{opath}.units: expected a whole number >= 1, got {units!r}")
            price = reader.param(oitem, "price", f"{opath}.price", minimum=0.01, item=oitem)
            offers.append(Offer(oid, _text(oitem, "name", opath), units, price))
        card_items = _list(item, "price_cards", f"{path}.price_cards")
        card_ids = _ids(card_items, f"{path}.price_cards")
        cards = []
        for card_id, card in zip(card_ids, card_items):
            members = card.get("offers")
            if not isinstance(members, list) or not members:
                raise ConfigError(f"{path}.price_cards.{card_id}.offers: list the offer ids on this card")
            unknown = [m for m in members if m not in offer_ids]
            if unknown:
                raise ConfigError(f"{path}.price_cards.{card_id}: unknown offer id(s) {unknown}")
            units_seen = [o.units for o in offers if o.id in members]
            if len(set(units_seen)) != len(units_seen):
                raise ConfigError(f"{path}.price_cards.{card_id}: two offers on one card have the same units")
            cards.append(PriceCard(card_id, _text(card, "name", f"{path}.price_cards.{card_id}"), tuple(members)))
        if not cards:
            units_seen = [o.units for o in offers]
            if len(set(units_seen)) != len(units_seen):
                raise ConfigError(f"{path}: offers share the same units; define [[online.price_cards]] to say which are sold together")
            cards.append(PriceCard("all", "All offers", tuple(offer_ids)))
        channels.append(
            OnlineChannel(
                id=ident,
                name=_text(item, "name", path),
                unit_cost_basis=_choice(item, "unit_cost_basis", path, UNIT_COST_BASES, "landed"),
                irrecoverable_input_gst=reader.param(
                    item, "irrecoverable_input_gst", f"{path}.irrecoverable_input_gst", default=0.0, minimum=0, maximum=1
                ),
                customer_shipping_fee=reader.param(
                    item, "customer_shipping_fee", f"{path}.customer_shipping_fee", default=0.0, minimum=0
                ),
                free_shipping_threshold=reader.param(
                    item, "free_shipping_threshold", f"{path}.free_shipping_threshold", default=0.0, minimum=0
                ),
                costs=tuple(costs),
                offers=tuple(offers),
                price_cards=tuple(cards),
            )
        )
    return tuple(channels)


def _parse_scenarios(reader: _Reader, items: list[dict[str, Any]]) -> tuple[Scenario, ...]:
    ids = _ids(items, "scenarios")
    scenarios = []
    for ident, item in zip(ids, items):
        path = f"scenarios.{ident}"
        units = reader.param(item, "units", f"{path}.units", minimum=1, item=item)
        mix_items = _list(item, "mix", f"{path}.mix")
        mix = []
        for i, m in enumerate(mix_items):
            mpath = f"{path}.mix[{i}]"
            mix.append(
                MixItem(
                    name=_text(m, "name", mpath),
                    share=reader.param(m, "share", f"{mpath}.share", minimum=0, maximum=1, item=m),
                    realization=reader.param(m, "realization", f"{mpath}.realization", minimum=0, item=m),
                )
            )
        if mix and abs(sum(m.share.value for m in mix) - 1.0) > 1e-9:
            raise ConfigError(f"{path}.mix: shares must add up to 1, got {sum(m.share.value for m in mix):.6g}")
        blended = reader.param(item, "blended_realization", f"{path}.blended_realization", required=not mix, minimum=0, item=item)
        opex_items = _list(item, "opex", f"{path}.opex")
        opex_ids = _ids(opex_items, f"{path}.opex")
        opex = [
            OpexLine(
                id=oid,
                name=_text(o, "name", f"{path}.opex.{oid}"),
                kind=_choice(o, "kind", f"{path}.opex.{oid}", KINDS, "other"),
                amount=reader.param(o, "amount", f"{path}.opex.{oid}.amount", minimum=0, item=o),
            )
            for oid, o in zip(opex_ids, opex_items)
        ]
        scenarios.append(Scenario(ident, _text(item, "name", path), units, blended, tuple(mix), tuple(opex)))
    return tuple(scenarios)


def _parse_targets(reader: _Reader, table: dict[str, Any]) -> Targets:
    def opt(key: str, **bounds: float) -> Param | None:
        return reader.param(table, key, f"targets.{key}", required=False, **bounds)

    targets = Targets(
        retailer_margin_min=opt("retailer_margin_min", minimum=0, maximum=1),
        retailer_margin_max=opt("retailer_margin_max", minimum=0, maximum=1),
        min_gross_margin=opt("min_gross_margin", minimum=-1, maximum=1),
        min_offline_contribution=opt("min_offline_contribution"),
        min_online_contribution=opt("min_online_contribution"),
    )
    lo, hi = targets.retailer_margin_min, targets.retailer_margin_max
    if (lo is None) != (hi is None):
        raise ConfigError("targets: set both retailer_margin_min and retailer_margin_max, or neither")
    if lo is not None and hi is not None and lo.value > hi.value:
        raise ConfigError("targets: retailer_margin_min is greater than retailer_margin_max")
    return targets


def _parse_sensitivities(items: list[dict[str, Any]]) -> tuple[Sensitivity, ...]:
    ids = _ids(items, "sensitivities")
    out = []
    for ident, item in zip(ids, items):
        set_ = item.get("set", {})
        scale = item.get("scale", {})
        if not isinstance(set_, dict) or not isinstance(scale, dict) or not (set_ or scale):
            raise ConfigError(f"sensitivities.{ident}: give a 'set' and/or 'scale' table of path = value")
        for key, factor in scale.items():
            _number(factor, f"sensitivities.{ident}.scale.{key}")
        out.append(Sensitivity(ident, _text(item, "name", f"sensitivities.{ident}"), dict(set_), dict(scale)))
    return tuple(out)


# --------------------------------------------------------------------------- overlays


def apply_overlay(
    raw: dict[str, Any],
    set_values: dict[str, Any] | None = None,
    scale: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Return a copy of ``raw`` with values replaced (``set``) or multiplied (``scale``).

    Paths are dotted, e.g. ``online.d2c.costs.shipping.amount``; inside an
    array of tables the segment selects the item whose ``id`` matches.
    """
    out = copy.deepcopy(raw)
    for path, value in (set_values or {}).items():
        parent, key = _resolve(out, path, create=True)
        if isinstance(parent.get(key), dict) and "value" in parent[key] and not isinstance(value, dict):
            parent[key]["value"] = value
        else:
            parent[key] = value
    for path, factor in (scale or {}).items():
        parent, key = _resolve(out, path, create=False)
        current = parent[key]
        if isinstance(current, dict) and "value" in current:
            current["value"] = _number(current["value"], path) * factor
        else:
            parent[key] = _number(current, path) * factor
    return out


def _resolve(root: dict[str, Any], path: str, create: bool) -> tuple[dict[str, Any], str]:
    parts = path.split(".")
    node: Any = root
    for i, part in enumerate(parts[:-1]):
        where = ".".join(parts[: i + 1])
        if isinstance(node, list):
            matches = [item for item in node if isinstance(item, dict) and item.get("id") == part]
            if not matches:
                raise ConfigError(f"overlay path {path!r}: no item with id {part!r} at {where}")
            node = matches[0]
        elif isinstance(node, dict):
            if part not in node:
                raise ConfigError(f"overlay path {path!r}: {where} does not exist")
            node = node[part]
        else:
            raise ConfigError(f"overlay path {path!r}: cannot descend into {where}")
    if isinstance(node, list):
        raise ConfigError(f"overlay path {path!r}: must end at a value, not a list item")
    if not isinstance(node, dict):
        raise ConfigError(f"overlay path {path!r}: parent is not a table")
    key = parts[-1]
    if key not in node and not create:
        raise ConfigError(f"overlay path {path!r}: {key!r} is not set, so it cannot be scaled")
    return node, key
