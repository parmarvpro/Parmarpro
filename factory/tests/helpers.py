import copy
import tomllib
from pathlib import Path

from unit_economics import apply_overlay, evaluate, parse_config

EXAMPLE = Path(__file__).resolve().parents[1] / "examples" / "example_product.toml"


def example_raw() -> dict:
    with EXAMPLE.open("rb") as fh:
        return tomllib.load(fh)


def evaluate_with(set_values=None, scale=None, raw=None):
    """Evaluate the example config with some inputs changed."""
    base = copy.deepcopy(raw) if raw is not None else example_raw()
    return evaluate(parse_config(apply_overlay(base, set_values or {}, scale or {})))


def by_id(items, ident):
    return next(item for item in items if item.id == ident)
