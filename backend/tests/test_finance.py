from finance import to_paise, to_inr


def test_to_paise_exact():
    assert to_paise("1250.50") == 125050
    assert to_paise(1000000) == 100_000_000
    assert to_paise("0.01") == 1


def test_to_paise_rejects_negative():
    import pytest
    with pytest.raises(ValueError):
        to_paise(-5)


def test_to_inr_indian_formatting():
    assert to_inr(125050) == "₹1,250.50"
    assert to_inr(100_000_000) == "₹10,00,000.00"
    assert to_inr(0) == "₹0.00"
    assert to_inr(30_000_000) == "₹3,00,000.00"
