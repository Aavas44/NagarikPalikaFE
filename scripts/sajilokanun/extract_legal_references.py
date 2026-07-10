#!/usr/bin/env python3
"""Extract inline दफा / उपदफा / खण्ड cross-references from chunk body text."""

from __future__ import annotations

import re
from typing import Any, Optional

from parse_nepali_law import to_arabic_digits, to_devanagari_digits

_REF_SEEN: set[tuple[str, str, str]] = set()


def _norm_dafa(num: str) -> str:
    return to_devanagari_digits(to_arabic_digits(num.strip()))


def _norm_upa(num: str) -> str:
    return to_devanagari_digits(to_arabic_digits(num.strip()))


def _add_ref(
    refs: list[dict[str, Any]],
    seen: set[tuple[str, str, str]],
    *,
    section_dafa: str,
    subsection_upadafa: Optional[str] = None,
    clause_khanda: Optional[str] = None,
    raw: str = "",
) -> None:
    dafa = _norm_dafa(section_dafa)
    upa = _norm_upa(subsection_upadafa) if subsection_upadafa else ""
    kh = (clause_khanda or "").strip()
    key = (dafa, upa, kh)
    if key in seen:
        return
    seen.add(key)
    refs.append(
        {
            "section_dafa": dafa,
            "subsection_upadafa": upa or None,
            "clause_khanda": kh or None,
            "raw": raw.strip(),
        }
    )


def _khanda_tail(text: str) -> list[str]:
    return re.findall(r"\(\s*([क-ह])\s*\)", text)


def _upadafa_tail(text: str) -> list[str]:
    return re.findall(r"\(\s*([\d०-९]+)\s*\)", text)


def extract_legal_references(
    text: str, current_dafa: Optional[str] = None
) -> list[dict[str, Any]]:
    """
    Resolve cross-references in Nepali legal prose.

    - ``दफा ९५ को खण्ड (ख), (ग) वा (च)`` → दफा ९५ + each खण्ड
    - ``उपदफा (१), (३) वा (४) बमोजिम`` → current दफा + each उपदफा (unless दफा named)
    - ``दफा ९७ बमोजिम`` / ``दफा ९९ मा`` → दफा-only ref
    """
    refs: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    current = _norm_dafa(current_dafa) if current_dafa else None

    # दफा N को खण्ड (ख), (ग) …
    for m in re.finditer(
        r"दफा\s*([\d०-९]+[क-ह]?)\s*को\s*खण्ड\s*([^।]+?)(?=बमोजिम|को\s*प्रयोजन|मा\s|।)",
        text,
    ):
        dafa = m.group(1)
        for kh in _khanda_tail(m.group(2)):
            _add_ref(
                refs,
                seen,
                section_dafa=dafa,
                clause_khanda=kh,
                raw=m.group(0),
            )

    # दफा N को उपदफा (M)
    for m in re.finditer(
        r"दफा\s*([\d०-९]+[क-ह]?)\s*को\s*उपदफा\s*\(\s*([\d०-९]+)\s*\)",
        text,
    ):
        _add_ref(
            refs,
            seen,
            section_dafa=m.group(1),
            subsection_upadafa=m.group(2),
            raw=m.group(0),
        )

    # उपदफा (१), (३) वा (४) बमोजिम — optional leading दफा N को
    for m in re.finditer(
        r"(?:दफा\s*([\d०-९]+[क-ह]?)\s*को\s*)?उपदफा\s*([^।]+?)\s*बमोजिम",
        text,
    ):
        dafa = m.group(1) or current_dafa
        if not dafa:
            continue
        for upa in _upadafa_tail(m.group(2)):
            _add_ref(
                refs,
                seen,
                section_dafa=dafa,
                subsection_upadafa=upa,
                raw=m.group(0),
            )

    # उपदफा (N) को प्रयोजन… — same-दफा unless दफा named
    for m in re.finditer(
        r"(?:दफा\s*([\d०-९]+[क-ह]?)\s*को\s*)?उपदफा\s*\(\s*([\d०-९]+)\s*\)\s*को\s*प्रयोजन",
        text,
    ):
        dafa = m.group(1) or current_dafa
        if not dafa:
            continue
        _add_ref(
            refs,
            seen,
            section_dafa=dafa,
            subsection_upadafa=m.group(2),
            raw=m.group(0),
        )

    # दफा N बमोजिम / दफा N मा (section-level, skip if only used as खण्ड anchor above)
    for m in re.finditer(
        r"दफा\s*([\d०-९]+[क-ह]?)\s*(?:बमोजिम|मा\s)",
        text,
    ):
        dafa = m.group(1)
        # Skip "दफा N को खण्ड" — already expanded to खण्ड refs
        after = text[m.end() : m.end() + 12]
        before = text[max(0, m.start() - 20) : m.start()]
        if "को खण्ड" in before + m.group(0):
            continue
        _add_ref(refs, seen, section_dafa=dafa, raw=m.group(0))

    return refs


if __name__ == "__main__":
    samples = [
        (
            "९९",
            "दफा ९५ को खण्ड (ख), (ग), (घ), (ङ) वा (च) बमोजिमको आधारमा पत्नीले सम्बन्ध विच्छेदको लागि निवेदन गरेकोमा उपदफा (१) को प्रयोजनको लागि",
        ),
        ("९९", "उपदफा (१) , (३) वा (४) बमोजिम अंशबण्डा गर्दा"),
        ("९९", "दफा ९४ को खण्ड (ख), (ग) वा (घ) बमोजिमको आधारमा"),
    ]
    for dafa, body in samples:
        print(f"--- दफा {dafa} ---")
        for r in extract_legal_references(body, dafa):
            print(r)
