"""Money handling utilities.

All monetary values are stored as INTEGER paise (1/100 of a rupee) to avoid
floating-point drift. Arithmetic is performed only in integer space.
"""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


def to_paise(amount) -> int:
    """Convert a rupee amount (str/float/int/Decimal) to integer paise.

    Raises ValueError on invalid or non-positive-after-round values problems
    but allows 0. Always returns an exact integer.
    """
    if amount is None:
        raise ValueError("amount is required")
    try:
        if isinstance(amount, Decimal):
            d = amount
        else:
            d = Decimal(str(amount))
    except (InvalidOperation, ValueError):
        raise ValueError("invalid amount")
    if d.is_nan() or d.is_infinite():
        raise ValueError("invalid amount")
    if d < 0:
        raise ValueError("amount must be non-negative")
    paise = (d * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(paise)


def from_paise(paise: int) -> Decimal:
    return Decimal(int(paise)) / Decimal(100)


def to_inr(paise) -> str:
    """Format integer paise as Indian Rupee string, e.g. '₹1,25,000.00'."""
    if paise is None:
        paise = 0
    paise = int(paise)
    sign = "-" if paise < 0 else ""
    value = Decimal(abs(paise)) / Decimal(100)
    int_part = int(value)
    frac = f"{value:.2f}".split(".")[1]
    s = _indian_group(str(int_part))
    return f"{sign}₹{s}.{frac}"


def _indian_group(int_str: str) -> str:
    """Group integer string with Indian convention (last 3, then groups of 2)."""
    neg = int_str.startswith("-")
    if neg:
        int_str = int_str[1:]
    if len(int_str) <= 3:
        return ("-" if neg else "") + int_str
    last3 = int_str[-3:]
    rest = int_str[:-3]
    parts = []
    while len(rest) > 2:
        parts.append(rest[-2:])
        rest = rest[:-2]
    if rest:
        parts.append(rest)
    grouped = ",".join(reversed(parts)) + "," + last3
    return ("-" if neg else "") + grouped
