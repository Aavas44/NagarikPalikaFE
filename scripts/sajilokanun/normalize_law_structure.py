#!/usr/bin/env python3
"""
Generate indented derivative .txt files from canonical lawComission sources.

Depth convention (2 spaces per level):
  0 — भाग, दफा header
  1 — परिच्छेद (under भाग), उपदफा, स्पष्टीकरण, तर
  2 — खण्ड

Usage:
  python scripts/normalize_law_structure.py --book criminal-procedure --write
  python scripts/normalize_law_structure.py --all --check
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

# Reuse marker logic from the main parser
from parse_nepali_law import (
    BOOK_CONFIGS,
    CHAPTER_RE,
    DAFA_INLINE_RE,
    KHANDA_RE,
    PART_RE,
    SPASTIKARAN_RE,
    TAR_RE,
    UPADafa_RE,
    extract_dafa_title,
    iter_logical_lines,
    normalize_whitespace,
    to_arabic_digits,
    to_devanagari_digits,
)

ROOT = Path(__file__).resolve().parent.parent
LAWFILES = ROOT / "Lawfiles"
STRUCTURED_DIR = LAWFILES / "lawComission" / ".structured"
REPORTS_DIR = STRUCTURED_DIR / "reports"

BOOK_SOURCES: dict[str, str] = {
    "civil-code": "lawComission/मुलुकी देवानी संहिता, २०७४.txt",
    "civil-procedure": "lawComission/मुलुकी देवानी कार्यविधि (संहिता), २०७४.txt",
    "criminal-code": "lawComission/मुलुकी अपराध संहिता, २०७४.txt",
    "criminal-procedure": "lawComission/मुलुकी फौजदारी कार्यविधि संहिता, २०७४.txt",
}

INDENT = "  "


@dataclass
class NormState:
    current_bhag: Optional[str] = None
    current_parichhed: Optional[str] = None
    current_dafa_num: Optional[str] = None
    current_upadafa_num: Optional[str] = None
    in_numbered_sublist: bool = False
    ambiguous: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class Block:
    depth: int
    text: str


def is_tar_exception_intro(line: str) -> bool:
    tar = TAR_RE.match(line)
    if not tar:
        return False
    text = f"{tar.group(1)} {tar.group(2)}"
    return bool(re.search(r"ः\s*[–\-]\s*$", text) or "छैनः" in text or re.search(r",\s*$", text))


def is_numbered_subclause(line: str) -> bool:
    upa = UPADafa_RE.match(line)
    if not upa:
        return False
    return bool(re.match(r"^[\d०-९]+$", to_arabic_digits(upa.group(1))))


def ends_with_list_intro(text: str) -> bool:
    """Colon + dash ends a parent block whose next lines are (१)(२)… sub-items."""
    t = text.strip()
    if re.search(r"ः\s*[–\-]\s*$", t):
        return True
    if "छैनः" in t and re.search(r"[–\-]\s*$", t):
        return True
    return False


def is_inline_bhag_ref(line: str) -> bool:
    """`भाग–२ को परिच्छेद…` / `भाग ३ को परिच्छेद…` — cross-reference, not a new भाग."""
    s = line.strip()
    if re.match(r"^भाग\s*[–\-]\s*[\d०-९]+\s+को", s):
        return True
    if re.match(r"^भाग\s+[\d०-९]+\s+को", s):
        return True
    return False


def is_inline_parichhed_ref(line: str) -> bool:
    """`परिच्छेद–१,` / `परिच्छेद–१८ को दफा` — enumeration, not a chapter header."""
    s = line.strip()
    if not re.match(r"^परिच्छेद\s*[–\-]", s):
        return False
    rest = re.sub(r"^परिच्छेद\s*[–\-]\s*[\d०-९]+\s*", "", s)
    if not rest:
        return False
    if rest.startswith(","):
        return True
    if re.match(r"^र\s+[\d०-९]", rest):
        return True
    if re.match(r"^को\s+(दफा|उपदफा|प्रयोजन)", rest):
        return True
    if re.match(r"^को\s+", rest):
        return True
    if re.match(r"^[,.\s\d०-९]", rest):
        return True
    return False


def is_bhag_section_header(text: str) -> bool:
    """`भाग–१ प्रारम्भिक` — part title, not an inline `भाग–२ को` cross-ref."""
    s = text.strip()
    return bool(re.match(r"^भाग\s*[–\-]\s*[\d०-९]+\s+\S", s)) and not is_inline_bhag_ref(s)


def is_chapter_section_header(line: str) -> bool:
    """`परिच्छेद–१ सामान्य व्यवस्था` — chapter title, not inline enumeration."""
    if is_inline_parichhed_ref(line):
        return False
    return bool(CHAPTER_RE.search(line) and "परिच्छेद" in line[:20])


def prev_ends_with_ko(prev_text: str) -> bool:
    return bool(re.search(r"को\s*$", prev_text.strip()))


def is_ko_continuation(line: str) -> bool:
    """Orphan `को परिच्छेद…` after a line ending in `…संहिताको`."""
    return bool(re.match(r"^को\s+", line.strip()))


def ends_with_tar_exception(text: str) -> bool:
    """`तर,` / `तरः–` / bare `स्पष्टीकरणः` opens a numbered exception sub-list."""
    t = text.strip()
    if ends_with_list_intro(t):
        return True
    if re.search(r"तर[ः:]?\s*,\s*$", t):
        return True
    if re.search(r"स्पष्टीकरण[ः:]?\s*$", t):
        return True
    return False


def mark_numbered_sublist_if_needed(state: NormState, block: Block) -> None:
    if ends_with_tar_exception(block.text):
        state.in_numbered_sublist = True


def prev_ends_cross_ref_enum(prev_text: str) -> bool:
    t = prev_text.strip()
    if re.search(r",\s*$", t) or re.search(r"\sर\s*$", t) or re.search(r"\sवा\s*$", t):
        return True
    if re.search(r"उपदफा\s*\(\s*[\d०-९]+\s*\)\s*को\s*खण्ड\s*$", t):
        return True
    if re.search(r"को खण्ड\s*$", t):
        return True
    if re.search(r"उपदफा\s*\(\s*[\d०-९]+\s*\)\s*,?\s*$", t):
        return True
    if re.search(r"\(\s*[\d०-९]+\s*\)\s*,\s*$", t):
        return True
    if re.search(r"\(\s*[क-ह]\s*\)\s*खण्ड\s*$", t):
        return True
    if re.search(r"\(\s*[\d०-९]+\s*\)\s*खण्ड\s*$", t):
        return True
    return False


def is_khanda_cross_ref_fragment(line: str) -> bool:
    kh = KHANDA_RE.match(line)
    if not kh:
        return False
    body = (kh.group(2) or "").strip()
    if not body:
        return True
    if re.fullmatch(r"[,रवा\s]+", body):
        return True
    if body in {",", "वा", "र"}:
        return True
    return False


def is_khanda_cross_ref_line(line: str, prev_text: str) -> bool:
    """`(क) ,` / `(ख) वा` / `(घ) बमोजिम` / `(ख) मा लेखिए` — not a new खण्ड clause."""
    kh = KHANDA_RE.match(line)
    if not kh:
        return False
    body = (kh.group(2) or "").strip()
    if is_khanda_cross_ref_fragment(line):
        return True
    if re.search(r"को खण्ड\s*$", prev_text.strip()):
        return True
    if re.search(r"\(\s*[\d०-९]+\s*\)\s*खण्ड\s*$", prev_text.strip()):
        return True
    if not prev_ends_cross_ref_enum(prev_text):
        return False
    if body == "खण्ड" or body.startswith("खण्ड "):
        return True
    if body.startswith("मा ") or body.startswith("बमोजिम"):
        return True
    return False


def is_cross_ref_enum_fragment(line: str) -> bool:
    """`(३) ,` / `(४) र` / `(२) वा (३)` / `(५) बमोजिम...` tails of a multi-ref उपदफा clause."""
    upa = UPADafa_RE.match(line)
    if not upa:
        return False
    body = (upa.group(2) or "").strip()
    if not body or re.fullmatch(r"[र,\s]+", body):
        return True
    if body.startswith("वा"):
        return True
    if body == "खण्ड" or body.startswith("खण्ड "):
        return True
    if body.startswith("बमोजिम"):
        return True
    if body.startswith("मा "):
        return True
    return False


def is_structural_line(line: str) -> bool:
    if is_inline_bhag_ref(line) or is_inline_parichhed_ref(line):
        return False
    if PART_RE.search(line) and re.match(r"^भाग\s*[–\-]\s*[\d०-९]+", line):
        return True
    if CHAPTER_RE.search(line) and "परिच्छेद" in line[:20]:
        return True
    if DAFA_INLINE_RE.match(line):
        return True
    if SPASTIKARAN_RE.match(line):
        return True
    if TAR_RE.match(line):
        return True
    if UPADafa_RE.match(line):
        return True
    if KHANDA_RE.match(line):
        return True
    return False


def should_merge_continuation(prev: Block, line: str, state: NormState) -> bool:
    if not prev:
        return False
    prev_text = prev.text.strip()

    # Compound section header: keep भाग and परिच्छेद as separate depth levels
    # (handled by process_structural_line — do not merge here)

    # `…संहिताको` + `भाग–२ को` / `को परिच्छेद–१` — iter_logical_lines splits on भाग/परिच्छेद
    if prev_ends_with_ko(prev_text) and (
        is_inline_bhag_ref(line)
        or is_inline_parichhed_ref(line)
        or is_ko_continuation(line)
    ):
        return True

    # Word-wrap / mid-sentence continuation
    if not is_structural_line(line):
        return True

    # Cross-ref fragment: "(६) बमोजिम..." when previous (६) block incomplete
    upa = UPADafa_RE.match(line)
    if upa and prev.depth == 1:
        body = (upa.group(2) or "").strip()
        if body.startswith("बमोजिम") and not prev_text.rstrip().endswith("।"):
            return True

    # Stub "(५) उपदफा" + orphan "(४) बमोजिम..."
    if re.search(r"उपदफा\s*$", prev_text) and UPADafa_RE.match(line):
        return True

    # Split half: prior उपदफा block ends with bare "उपदफा" or "अनुसन्धान उपदफा"
    if prev.depth == 1 and re.search(r"उपदफा\s*$", prev_text) and UPADafa_RE.match(line):
        return True

    # "उपदफा (६) वा" + "(८) बमोजिम..." — inline enumeration, not new उपदफा
    if upa and prev.depth == 1 and re.search(r"\sवा\s*$", prev_text):
        return True

    # "उपदफा (२), (३), (४) र (५) बमोजिम..." — multi-ref enumeration
    if (
        upa
        and prev.depth == 1
        and prev_ends_cross_ref_enum(prev_text)
        and is_cross_ref_enum_fragment(line)
    ):
        return True

    # "को खण्ड (क), (ख) वा (घ) बमोजिम" — letter cross-refs, not new खण्ड chunks
    kh = KHANDA_RE.match(line)
    if kh and is_khanda_cross_ref_line(line, prev_text):
        return True

    return False


def merge_va_cross_ref(prev_text: str, line: str) -> str:
    upa = UPADafa_RE.match(line)
    if upa:
        display = to_devanagari_digits(to_arabic_digits(upa.group(1)))
        tail = (upa.group(2) or "").strip()
        return normalize_whitespace(f"{prev_text} ({display}) {tail}")
    return normalize_whitespace(f"{prev_text} {line}")


def merge_upadafa_tail(prev_text: str, line: str) -> str:
    upa = UPADafa_RE.match(line)
    if not upa:
        return normalize_whitespace(f"{prev_text} {line}")
    tail = (upa.group(2) or "").strip()
    marker = upa.group(1)
    if re.search(r"उपदफा\s*$", prev_text.strip()):
        return normalize_whitespace(f"{prev_text} ({marker}) {tail}")
    if prev_text.strip().endswith("उपदफा"):
        return normalize_whitespace(f"{prev_text} ({marker}) {tail}")
    return normalize_whitespace(f"{prev_text} ({marker}) {tail}")


def chapter_block_depth(state: NormState) -> int:
    """परिच्छेद section titles nest under the current भाग when one is active."""
    return 1 if state.current_bhag else 0


def chapter_header_text(line: str, chapter_match: re.Match[str]) -> str:
    """Visible `परिच्छेद–N title` line for the structured file."""
    return line[: chapter_match.end()].strip()


def classify_depth(line: str, state: NormState) -> int:
    if PART_RE.search(line) and re.match(r"^भाग\s*[–\-]\s*[\d०-९]+", line):
        return 0
    if CHAPTER_RE.search(line) and "परिच्छेद" in line[:20]:
        if is_inline_parichhed_ref(line):
            return chapter_block_depth(state)
        return chapter_block_depth(state)
    if DAFA_INLINE_RE.match(line):
        return 0
    if KHANDA_RE.match(line):
        return 2
    if SPASTIKARAN_RE.match(line) or TAR_RE.match(line) or UPADafa_RE.match(line):
        return 1
    return 1


def process_structural_line(
    line: str, state: NormState, blocks: list[Block]
) -> None:
    # भाग
    if PART_RE.search(line) and re.match(r"^भाग\s*[–\-]\s*[\d०-९]+", line):
        if is_inline_bhag_ref(line):
            blocks.append(Block(classify_depth(line, state), line))
            return
        num = PART_RE.search(line).group(1)  # type: ignore[union-attr]
        display_num = to_devanagari_digits(to_arabic_digits(num))
        state.current_bhag = f"भाग {display_num}"
        state.current_parichhed = None
        state.current_dafa_num = None
        state.current_upadafa_num = None
        remainder = PART_RE.sub("", line, count=1).strip()
        if remainder:
            blocks.append(Block(0, f"भाग–{display_num} {remainder}".strip()))
        else:
            blocks.append(Block(0, f"भाग–{display_num}"))
        return

    # परिच्छेद
    chapter_match = CHAPTER_RE.search(line)
    if chapter_match and "परिच्छेद" in line[:20]:
        if is_inline_parichhed_ref(line):
            blocks.append(Block(classify_depth(line, state), line))
            return
        num = chapter_match.group(1)
        name = (chapter_match.group(2) or "").strip()
        display_num = to_devanagari_digits(to_arabic_digits(num))
        state.current_parichhed = (
            f"परिच्छेद {display_num} — {name}" if name else f"परिच्छेद {display_num}"
        )
        state.current_dafa_num = None
        state.current_upadafa_num = None
        header = chapter_header_text(line, chapter_match)
        blocks.append(Block(chapter_block_depth(state), header))
        remainder = line[chapter_match.end() :].strip()
        if remainder:
            process_structural_line(remainder, state, blocks)
        return

    # दफा
    dafa_match = DAFA_INLINE_RE.match(line)
    if dafa_match:
        state.current_dafa_num = dafa_match.group(1)
        body = dafa_match.group(2).strip()
        state.current_upadafa_num = None
        first_upa = UPADafa_RE.search(body)
        if first_upa:
            preamble = body[: first_upa.start()].strip()
            if preamble:
                blocks.append(Block(0, f"{dafa_match.group(1)}. {preamble}"))
            remainder = body[first_upa.start() :].strip()
            process_structural_line(remainder, state, blocks)
        else:
            blocks.append(Block(0, f"{dafa_match.group(1)}. {body}"))
            mark_numbered_sublist_if_needed(state, blocks[-1])
        return

    # स्पष्टीकरण / तर
    sp_match = SPASTIKARAN_RE.match(line)
    if sp_match:
        state.current_upadafa_num = None
        blocks.append(Block(1, f"{sp_match.group(1)} {sp_match.group(2)}".strip()))
        mark_numbered_sublist_if_needed(state, blocks[-1])
        return

    tar_match = TAR_RE.match(line)
    if tar_match:
        tar_body = f"{tar_match.group(1)} {tar_match.group(2)}".strip()
        if is_tar_exception_intro(line):
            state.in_numbered_sublist = True
            if blocks and blocks[-1].depth == 2:
                blocks[-1].text = normalize_whitespace(f"{blocks[-1].text} {tar_body}")
                mark_numbered_sublist_if_needed(state, blocks[-1])
            else:
                blocks.append(Block(2, tar_body))
                mark_numbered_sublist_if_needed(state, blocks[-1])
            return
        state.current_upadafa_num = None
        blocks.append(Block(1, tar_body))
        return

    # उपदफा
    upa_match = UPADafa_RE.match(line)
    if upa_match:
        upa_num = upa_match.group(1)
        body = (upa_match.group(2) or "").strip()
        state.current_upadafa_num = upa_num
        display = to_devanagari_digits(to_arabic_digits(upa_num))
        khanda_inline = KHANDA_RE.search(body)
        if khanda_inline:
            preamble = body[: khanda_inline.start()].strip()
            line_text = f"({display}) {preamble}".strip() if preamble else f"({display})"
            blocks.append(Block(1, line_text))
            letter = khanda_inline.group(1)
            kh_body = khanda_inline.group(2).strip()
            blocks.append(Block(2, f"({letter}) {kh_body}".strip()))
            mark_numbered_sublist_if_needed(state, blocks[-1])
        else:
            blocks.append(Block(1, f"({display}) {body}".strip()))
            mark_numbered_sublist_if_needed(state, blocks[-1])
        return

    # खण्ड
    kh_match = KHANDA_RE.match(line)
    if kh_match:
        state.in_numbered_sublist = False
        letter = kh_match.group(1)
        body = (kh_match.group(2) or "").strip()
        blocks.append(Block(2, f"({letter}) {body}".strip()))
        mark_numbered_sublist_if_needed(state, blocks[-1])
        return

    blocks.append(Block(classify_depth(line, state), line))


def normalize_text(raw_text: str) -> tuple[str, dict[str, Any]]:
    state = NormState()
    blocks: list[Block] = []

    for line in iter_logical_lines(raw_text):
        if state.in_numbered_sublist:
            if is_numbered_subclause(line) or is_cross_ref_enum_fragment(line):
                if blocks:
                    blocks[-1].text = normalize_whitespace(f"{blocks[-1].text} {line}")
                continue
            state.in_numbered_sublist = False

        # iter_logical_lines double-splits compound headers into duplicate परिच्छेद titles
        if blocks:
            prev_stripped = blocks[-1].text.strip()
            line_stripped = line.strip()
            if line_stripped == prev_stripped:
                continue
            if is_chapter_section_header(line) and prev_stripped.endswith(line_stripped):
                continue

        if blocks and should_merge_continuation(blocks[-1], line, state):
            if UPADafa_RE.match(line) and re.search(r"\sवा\s*$", blocks[-1].text):
                blocks[-1].text = merge_va_cross_ref(blocks[-1].text, line)
            elif UPADafa_RE.match(line) and re.search(r"उपदफा\s*$", blocks[-1].text):
                blocks[-1].text = merge_upadafa_tail(blocks[-1].text, line)
            else:
                blocks[-1].text = normalize_whitespace(f"{blocks[-1].text} {line}")
            mark_numbered_sublist_if_needed(state, blocks[-1])
            continue
        process_structural_line(line, state, blocks)

    out_lines = [INDENT * b.depth + b.text for b in blocks]
    report = {
        "block_count": len(blocks),
        "ambiguous": state.ambiguous[:200],
        "ambiguous_count": len(state.ambiguous),
    }
    return "\n".join(out_lines) + ("\n" if out_lines else ""), report


def structured_output_path(source_rel: str) -> Path:
    name = Path(source_rel).name
    return STRUCTURED_DIR / name


def run_book(book_id: str, write: bool) -> dict[str, Any]:
    if book_id not in BOOK_SOURCES:
        raise ValueError(f"Unknown book: {book_id}")

    source_rel = BOOK_SOURCES[book_id]
    source_path = LAWFILES / source_rel
    if not source_path.exists():
        raise FileNotFoundError(source_path)

    raw = source_path.read_text(encoding="utf-8")
    structured, report = normalize_text(raw)
    report["book_id"] = book_id
    report["source"] = source_rel
    report["structured_path"] = str(structured_output_path(source_rel))

    if write:
        STRUCTURED_DIR.mkdir(parents=True, exist_ok=True)
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        out_path = structured_output_path(source_rel)
        out_path.write_text(structured, encoding="utf-8")
        report_path = REPORTS_DIR / f"{book_id}.json"
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Wrote {out_path} ({report['block_count']} blocks)")
        if report["ambiguous_count"]:
            print(f"  {report['ambiguous_count']} ambiguous merges — see {report_path}")

    return report


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Normalize lawComission txt to indented structure")
    parser.add_argument("--book", choices=list(BOOK_SOURCES.keys()))
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--write", action="store_true", help="Write .structured/*.txt files")
    parser.add_argument("--check", action="store_true", help="Parse only, print stats")
    args = parser.parse_args(argv)

    books = list(BOOK_SOURCES.keys()) if args.all else ([args.book] if args.book else [])
    if not books:
        parser.error("Specify --book <id> or --all")

    for book_id in books:
        report = run_book(book_id, write=args.write or args.check)
        if args.check and not args.write:
            print(json.dumps(report, ensure_ascii=False, indent=2))

    return 0


if __name__ == "__main__":
    sys.exit(main())
