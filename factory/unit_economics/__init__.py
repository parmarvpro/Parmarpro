"""Unit-economics engine for consumer products sold offline and online.

Typical use::

    from unit_economics import load_config, evaluate
    results = evaluate(load_config("examples/example_product.toml"))
    for finding in results.findings:
        print(finding.severity, finding.message)
"""

from .config import ConfigError, apply_overlay, load_config, parse_config
from .model import evaluate, metrics, run_sensitivities

__all__ = [
    "ConfigError",
    "apply_overlay",
    "evaluate",
    "load_config",
    "metrics",
    "parse_config",
    "run_sensitivities",
]
