"""Display formatting. Money uses Indian digit grouping (₹10,00,000).

Rounding matches spreadsheets: values are first cut to 15 significant digits
(so 100 - 98.995 = 1.0049999999999955 reads as 1.005) and then
rounded half away from zero, which is what Excel and LibreOffice display.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal


def indian_group(digits: str) -> str:
    """Group a string of digits the Indian way: 1234567 -> 12,34,567."""
    if len(digits) <= 3:
        return digits
    head, tail = digits[:-3], digits[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return ",".join(groups + [tail])


def round_display(value: float, decimals: int) -> Decimal:
    exp = Decimal(1).scaleb(-decimals)
    return Decimal(f"{value:.15g}").quantize(exp, rounding=ROUND_HALF_UP)


def _grouped(value: float, decimals: int) -> tuple[str, str]:
    rounded = round_display(value, decimals)
    sign = "-" if rounded < 0 else ""
    text = f"{abs(rounded):.{decimals}f}"
    whole, _, frac = text.partition(".")
    return sign, indian_group(whole) + (f".{frac}" if frac else "")


def money(value: float | None, symbol: str = "₹", decimals: int = 2) -> str:
    if value is None:
        return "–"
    sign, body = _grouped(value, decimals)
    return f"{sign}{symbol}{body}"


def number(value: float | None, decimals: int = 2) -> str:
    if value is None:
        return "–"
    sign, body = _grouped(value, decimals)
    return f"{sign}{body}"


def pct(value: float | None, decimals: int = 1) -> str:
    if value is None:
        return "–"
    rounded = round_display(value * 100, decimals)
    return f"{abs(rounded) if rounded == 0 else rounded:.{decimals}f}%"
