#!/usr/bin/env python3
"""
Pure-Python Nepali legal code parser for RAG chunking.

Parses Muluki-style acts (भाग → परिच्छेद → दफा → उपदफा → खण्ड → स्पष्टीकरण/तर)
into semantically complete chunks with parent context injection.

Usage:
    python scripts/parse_nepali_law.py path/to/raw.txt
    python scripts/parse_nepali_law.py path/to/raw.txt --book civil-code --json out.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from typing import Any, Iterator, Optional

# ---------------------------------------------------------------------------
# Devanagari digit helpers
# ---------------------------------------------------------------------------

_DEVANAGARI_DIGITS = "०१२३४५६७८९"
_ARABIC_TO_DEVANAGARI = str.maketrans("0123456789", _DEVANAGARI_DIGITS)
_DEVANAGARI_TO_ARABIC = str.maketrans(_DEVANAGARI_DIGITS, "0123456789")

CLAUSE_ROMAN: dict[str, str] = {
    "क": "ka",
    "ख": "kha",
    "ग": "ga",
    "घ": "gha",
    "ङ": "nga",
    "च": "cha",
    "छ": "chha",
    "ज": "ja",
    "झ": "jha",
    "ञ": "nya",
    "ट": "ta",
    "ठ": "tha",
    "ड": "da",
    "ढ": "dha",
    "ण": "na",
    "त": "ta2",
    "थ": "tha2",
    "द": "da2",
    "ध": "dha2",
    "न": "na2",
    "प": "pa",
    "फ": "pha",
    "ब": "ba",
    "भ": "bha",
    "म": "ma",
    "य": "ya",
    "र": "ra",
    "ल": "la",
    "व": "va",
    "श": "sha",
    "ष": "sha2",
    "स": "sa",
    "ह": "ha",
}

# ---------------------------------------------------------------------------
# Book configs (align with src/lib/indexing-rules/)
# ---------------------------------------------------------------------------

BOOK_CONFIGS: dict[str, dict[str, str]] = {
    "civil-code": {
        "document_title": "मुलुकी देवानी संहिता, २०७४",
        "document_category": "सारभूत कानून (Substantive Law)",
        "book_id": "civil-code",
    },
    "civil-procedure": {
        "document_title": "मुलुकी देवानी कार्यविधि, २०७४",
        "document_category": "प्रक्रियात्मक कानून (Procedural Law)",
        "book_id": "civil-procedure",
    },
    "criminal-code": {
        "document_title": "मुलुकी अपराध संहिता, २०७४",
        "document_category": "सारभूत कानून (Substantive Law)",
        "book_id": "criminal-code",
    },
    "criminal-procedure": {
        "document_title": "मुलुकी फौजदारी कार्यविधि, २०७४",
        "document_category": "प्रक्रियात्मक कानून (Procedural Law)",
        "book_id": "criminal-procedure",
    },
}

DEFAULT_BOOK_CONFIG = {
    "document_title": "नेपाल कानून",
    "document_category": "कानून",
    "book_id": "unknown",
}

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

PART_RE = re.compile(r"भाग\s*[–\-]?\s*([\d०-९]+)")
CHAPTER_RE = re.compile(
    r"परिच्छेद\s*[–\-]\s*([\d०-९]+)(?:\s+([^\d\n]+?))?(?=\s*[\d०-९]{1,4}[क-ह]?\.|\n|$)"
)
# दफा: ६७. or १९३क. or १० स्वच्छ (period sometimes omitted in OCR sources)
DAFA_RE = re.compile(
    r"(?:^|[\s।])([\d०-९]{1,4}[क-ह]?)\.?\s+(.+)$",
    re.MULTILINE,
)
DAFA_INLINE_RE = re.compile(r"^([\d०-९]{1,4}[क-ह]?)\.?\s+(.+)$")
UPADafa_RE = re.compile(r"(?:^|[\s।])\(\s*([\d०-९]{1,2})\s*\)\s*(.*)$")
KHANDA_RE = re.compile(r"(?:^|[\s।–\-])\(\s*([क-ह])\s*\)\s*(.*)$")
SPASTIKARAN_RE = re.compile(r"^(स्पष्टीकरण[ः:])\s*(.*)$", re.IGNORECASE)
TAR_RE = re.compile(r"^(तर[ः:]?)\s+(.+)$")

HEADER_FOOTER_PATTERNS = [
    # Standalone document title lines only — not दफा (१) quoted short names
    re.compile(
        r"^मुलुकी\s*देवानी\s*[\(（]?\s*संहिता\s*[\)）]?\s*[,]?\s*२०७४\s*$",
        re.I | re.M,
    ),
    re.compile(r"^\s*[\d०-९]{1,4}\s*$", re.M),
    re.compile(r"^\s*[-–—]{2,}\s*$", re.M),
    re.compile(r"\[PAGE:\d+\]"),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def to_arabic_digits(text: str) -> str:
    return text.translate(_DEVANAGARI_TO_ARABIC)


def to_devanagari_digits(text: str) -> str:
    return text.translate(_ARABIC_TO_DEVANAGARI)


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def strip_page_noise(text: str) -> str:
    result = text
    for pattern in HEADER_FOOTER_PATTERNS:
        result = pattern.sub(" ", result)
    return normalize_whitespace(result)


def normalize_document_text(text: str) -> str:
    """Fix common OCR / legacy-font artifacts before parsing."""
    result = text
    result = re.sub(r"प\s*र\s*ि?\s*च\s*्छेद", "परिच्छेद", result)
    result = re.sub(r"फ\s*र\s*ि?\s*च\s*्छेद", "फरिच्छेद", result)
    result = result.replace("परिरच्छेद", "परिच्छेद")
    result = re.sub(r"भाग([\d०-९])", r"भाग \1", result)
    # Legacy-font section markers
    result = re.sub(r"द्द([\d०-९]{1,3})[।]", r"\n\1. ", result)
    result = re.sub(r"द्ध([\d०-९]{1,3})\s*[।]?", r"\n\1. ", result)
    # Insert newline before embedded section numbers after Devanagari letters
    result = re.sub(
        r"([\u0900-\u097F])([\d०-९]{1,4}[क-ह]?)\.\s+(?=[\u0900-\u097F])",
        lambda m: m.group(0)
        if re.search(r"[\d०-९]", m.group(1))
        else f"{m.group(1)}\n{m.group(2)}. ",
        result,
    )
    return normalize_whitespace(result)


def extract_dafa_title(body: str) -> str:
    """Title is usually the phrase ending at visarga (ः)."""
    body = body.strip()
    if not body:
        return ""
    colon = body.find("ः")
    if 0 < colon < 120:
        return body[: colon + 1].strip()
    return body[:80].strip()


_HADAMYAD_RE = re.compile(r"हदम्याद")


def is_hadamyad_title(title: Optional[str]) -> bool:
    return bool(title and _HADAMYAD_RE.search(title))


def attach_chapter_hadamyad(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Link each परिच्छेद's हदम्याद दफा to every chunk in that chapter."""
    by_parichhed: dict[str, list[dict[str, Any]]] = {}
    for chunk in chunks:
        parichhed = chunk.get("metadata", {}).get("parichhed")
        if parichhed:
            by_parichhed.setdefault(parichhed, []).append(chunk)

    for group in by_parichhed.values():
        hadamyad_dafa: Optional[str] = None
        for chunk in group:
            meta = chunk["metadata"]
            title = meta.get("dafa_title") or ""
            if is_hadamyad_title(title):
                hadamyad_dafa = meta.get("dafa")
                if meta.get("chunk_type") == "dafa":
                    meta["provision_role"] = "hadamyad"

        if not hadamyad_dafa:
            continue

        for chunk in group:
            chunk["metadata"]["chapter_hadamyad_dafa"] = hadamyad_dafa

    return chunks


def slug_dafa(num: str) -> str:
    """e.g. '१९३क' -> '193ka', '६७' -> '67'"""
    digits = []
    letter_suffix = ""
    for ch in num.replace(".", ""):
        if ch in _DEVANAGARI_DIGITS or ch.isdigit():
            digits.append(to_arabic_digits(ch))
        elif ch in CLAUSE_ROMAN:
            letter_suffix += CLAUSE_ROMAN[ch]
    return f"{''.join(digits)}{letter_suffix}"


def build_chunk_id(
    dafa_num: str,
    chunk_type: str,
    upadafa: Optional[str] = None,
    khanda: Optional[str] = None,
    index: int = 0,
) -> str:
    base = f"dafa_{slug_dafa(dafa_num)}"
    if chunk_type == "dafa":
        return base
    if chunk_type == "upadafa" and upadafa:
        return f"{base}_upadafa_{to_arabic_digits(upadafa)}"
    if chunk_type == "khanda" and upadafa and khanda:
        letter = CLAUSE_ROMAN.get(khanda, khanda)
        return f"{base}_upadafa_{to_arabic_digits(upadafa)}_{letter}"
    if chunk_type == "spastikaran":
        return f"{base}_spastikaran_{index}"
    if chunk_type == "tar":
        return f"{base}_tar_{index}"
    return f"{base}_{chunk_type}_{index}"


def build_context_prefix(
    bhag: Optional[str],
    parichhed: Optional[str],
    dafa_num: Optional[str],
    dafa_title: Optional[str],
    upadafa: Optional[str] = None,
    khanda: Optional[str] = None,
) -> str:
    parts: list[str] = []
    if bhag:
        parts.append(bhag.replace("भाग ", "भाग-") if "भाग" in bhag else bhag)
    if parichhed:
        short = parichhed.split("—")[0].strip()
        parts.append(short.replace("परिच्छेद ", "परिच्छेद–"))
    if dafa_num:
        base_digits = []
        letter_suffix = ""
        for ch in dafa_num.replace(".", ""):
            if ch in _DEVANAGARI_DIGITS or ch.isdigit():
                base_digits.append(to_devanagari_digits(to_arabic_digits(ch)))
            elif ch in CLAUSE_ROMAN:
                letter_suffix = ch
        parts.append(f"दफा {''.join(base_digits)}{letter_suffix}")
    header = ", ".join(parts)
    chain: list[str] = []
    if dafa_title:
        chain.append(dafa_title.strip())
    if upadafa:
        chain.append(f"({to_devanagari_digits(to_arabic_digits(upadafa))})")
    if khanda:
        chain.append(f"({khanda})")
    body = " -> ".join(chain)
    return f"[{header}]: {body}" if body else f"[{header}]"


def inject_context(prefix_chain: str, raw_body: str) -> str:
    """Prepend hierarchical context to chunk body."""
    raw_body = normalize_whitespace(raw_body)
    if not prefix_chain:
        return raw_body
    # prefix_chain already ends with arrow chain; append actual text after last arrow segment
    if " -> " in prefix_chain and raw_body:
        return f"{prefix_chain} {raw_body}"
    if raw_body:
        return f"{prefix_chain}: {raw_body}"
    return prefix_chain


# ---------------------------------------------------------------------------
# Parser state
# ---------------------------------------------------------------------------


@dataclass
class ParserState:
    current_bhag: Optional[str] = None
    current_parichhed: Optional[str] = None
    current_dafa_num: Optional[str] = None
    current_dafa_title: Optional[str] = None
    current_upadafa_num: Optional[str] = None
    current_upadafa_text: str = ""
    current_khanda: Optional[str] = None
    spastikaran_count: int = 0
    tar_count: int = 0
    book_config: dict[str, str] = field(default_factory=lambda: dict(DEFAULT_BOOK_CONFIG))
    chunks: list[dict[str, Any]] = field(default_factory=list)

    def reset_dafa_children(self) -> None:
        self.current_upadafa_num = None
        self.current_upadafa_text = ""
        self.current_khanda = None
        self.spastikaran_count = 0
        self.tar_count = 0

    def last_chunk(self) -> Optional[dict[str, Any]]:
        return self.chunks[-1] if self.chunks else None

    def append_to_last_chunk(self, line: str) -> bool:
        """Multi-line fallback: extend previous chunk when no marker matched."""
        chunk = self.last_chunk()
        if not chunk:
            return False
        extra = normalize_whitespace(line)
        if not extra:
            return True
        chunk["text"] = normalize_whitespace(f"{chunk['text']} {extra}")
        return True

    def make_metadata(
        self,
        chunk_type: str,
        upadafa: Optional[str] = None,
        khanda: Optional[str] = None,
    ) -> dict[str, Any]:
        return {
            "document_title": self.book_config.get("document_title"),
            "document_category": self.book_config.get("document_category"),
            "book_id": self.book_config.get("book_id"),
            "bhag": self.current_bhag,
            "parichhed": self.current_parichhed,
            "dafa": to_devanagari_digits(to_arabic_digits(self.current_dafa_num or "")),
            "dafa_arabic": slug_dafa(self.current_dafa_num or ""),
            "dafa_title": self.current_dafa_title,
            "upadafa": to_devanagari_digits(to_arabic_digits(upadafa)) if upadafa else None,
            "khanda": khanda,
            "chunk_type": chunk_type,
        }

    def emit_chunk(
        self,
        chunk_type: str,
        body: str,
        upadafa: Optional[str] = None,
        khanda: Optional[str] = None,
    ) -> None:
        if not self.current_dafa_num or not normalize_whitespace(body):
            return

        prefix = build_context_prefix(
            self.current_bhag,
            self.current_parichhed,
            self.current_dafa_num,
            self.current_dafa_title,
            upadafa,
            khanda,
        )

        if chunk_type == "spastikaran":
            self.spastikaran_count += 1
            chunk_index = self.spastikaran_count
        elif chunk_type == "tar":
            self.tar_count += 1
            chunk_index = self.tar_count
        else:
            chunk_index = 0

        chunk_id = build_chunk_id(
            self.current_dafa_num, chunk_type, upadafa, khanda, chunk_index
        )
        metadata = self.make_metadata(chunk_type, upadafa, khanda)
        metadata["chunk_id"] = chunk_id
        from extract_legal_references import extract_legal_references

        metadata["references"] = extract_legal_references(
            body, self.current_dafa_num
        )

        self.chunks.append(
            {
                "chunk_id": chunk_id,
                "text": inject_context(prefix, body),
                "metadata": metadata,
            }
        )


# ---------------------------------------------------------------------------
# Line classification
# ---------------------------------------------------------------------------


def iter_logical_lines(raw_text: str) -> Iterator[str]:
    """Split on newlines but also break inline structural markers onto their own lines."""
    normalized = normalize_document_text(strip_page_noise(raw_text))
    # Promote inline markers to line starts for the state machine
    normalized = re.sub(r"\s+(?=भाग\s*[–\-]\s*[\d०-९])", "\n", normalized)
    normalized = re.sub(r"\s+(?=परिच्छेद\s*[–\-])", "\n", normalized)
    normalized = re.sub(
        r"(?<=[\u0900-\u097F।])\s+(?=[\d०-९]{1,4}[क-ह]?\.\s)",
        "\n",
        normalized,
    )
    # दफा without period after danda: "... । २४ निजी ..."
    normalized = re.sub(
        r"(?<=[।])\s+(?=[\d०-९]{1,4}[क-ह]?\s+[\u0900-\u097F])",
        "\n",
        normalized,
    )
    # Merged mid-line: Devanagari/quote then "N. title"
    normalized = re.sub(
        r'(?<=[\u0900-\u097F"\u201c\u201d])\s+(?=[\d०-९]{1,4}[क-ह]?\.\s+[\u0900-\u097F])',
        "\n",
        normalized,
    )
    # Ellipsis filler before next दफा: "……… ५४. ..."
    normalized = re.sub(
        r"…+\s+(?=[\d०-९]{1,4}[क-ह]?\.\s+[\u0900-\u097F])",
        lambda m: m.group(0).rstrip() + "\n",
        normalized,
    )
    normalized = re.sub(
        r"\.{4,}\s+(?=[\d०-९]{1,4}[क-ह]?\.\s+[\u0900-\u097F])",
        lambda m: m.group(0).rstrip() + "\n",
        normalized,
    )
    normalized = re.sub(r"\s+(?=\(\s*[\d०-९]{1,2}\s*\))", "\n", normalized)
    normalized = re.sub(r"\s+(?=\(\s*[क-ह]\s*\))", "\n", normalized)
    normalized = re.sub(r"\s+(?=स्पष्टीकरण)", "\n", normalized, flags=re.I)
    normalized = re.sub(r"\s+(?=तर[ः:]?\s)", "\n", normalized)

    for line in normalized.split("\n"):
        line = line.strip()
        if line:
            yield line


def process_line(state: ParserState, line: str) -> None:
    # 1. भाग (Part)
    part_match = PART_RE.search(line)
    if part_match and re.match(r"^भाग\s*[–\-]\s*[\d०-९]+", line):
        num = part_match.group(1)
        state.current_bhag = f"भाग {to_devanagari_digits(to_arabic_digits(num))}"
        remainder = PART_RE.sub("", line, count=1).strip()
        if remainder and not state.append_to_last_chunk(remainder):
            pass
        return

    # 2. परिच्छेद (Chapter)
    chapter_match = CHAPTER_RE.search(line)
    if chapter_match and "परिच्छेद" in line[:20]:
        num = chapter_match.group(1)
        name = (chapter_match.group(2) or "").strip()
        display_num = to_devanagari_digits(to_arabic_digits(num))
        state.current_parichhed = (
            f"परिच्छेद {display_num} — {name}" if name else f"परिच्छेद {display_num}"
        )
        remainder = line[chapter_match.end() :].strip()
        if remainder:
            process_line(state, remainder)
        return

    # 3. दफा (Section) — must appear before subsection checks
    dafa_match = DAFA_INLINE_RE.match(line)
    if dafa_match:
        state.current_dafa_num = dafa_match.group(1)
        body = dafa_match.group(2).strip()
        state.current_dafa_title = extract_dafa_title(body)
        state.reset_dafa_children()
        state.current_upadafa_text = body

        # Split inline उपदफा on the same line as the दफा header
        first_upa = UPADafa_RE.search(body)
        if first_upa:
            preamble = body[: first_upa.start()].strip()
            if preamble:
                state.emit_chunk("dafa", preamble)
            remainder = body[first_upa.start() :].strip()
            process_line(state, remainder)
        else:
            state.emit_chunk("dafa", body)
        return

    # 4. स्पष्टीकरण
    sp_match = SPASTIKARAN_RE.match(line)
    if sp_match:
        label, body = sp_match.group(1), sp_match.group(2)
        state.emit_chunk("spastikaran", f"{label} {body}".strip())
        return

    # 5. तर (Exception)
    tar_match = TAR_RE.match(line)
    if tar_match:
        label, body = tar_match.group(1), tar_match.group(2)
        state.emit_chunk("tar", f"{label} {body}".strip())
        return

    # 6. उपदफा (Subsection)
    upa_match = UPADafa_RE.match(line)
    if upa_match:
        upa_num = upa_match.group(1)
        body = upa_match.group(2).strip()
        state.current_upadafa_num = upa_num
        state.current_upadafa_text = body
        state.current_khanda = None

        # Subsection may contain inline खण्ड on same line
        khanda_inline = KHANDA_RE.search(body)
        if khanda_inline:
            preamble = body[: khanda_inline.start()].strip()
            if preamble:
                state.emit_chunk("upadafa", f"({to_devanagari_digits(to_arabic_digits(upa_num))}) {preamble}", upa_num)
            state.current_khanda = khanda_inline.group(1)
            kh_body = khanda_inline.group(2).strip()
            state.emit_chunk("khanda", kh_body, upa_num, state.current_khanda)
        else:
            state.emit_chunk("upadafa", body, upa_num)
        return

    # 7. खण्ड (Clause)
    kh_match = KHANDA_RE.match(line)
    if kh_match:
        letter = kh_match.group(1)
        body = kh_match.group(2).strip()
        state.current_khanda = letter
        upa = state.current_upadafa_num or "1"
        state.emit_chunk("khanda", body, upa, letter)
        return

    # 8. Multi-line fallback
    if state.append_to_last_chunk(line):
        return

    # Orphan continuation inside an active दफा before any chunk emitted
    if state.current_dafa_num and state.current_upadafa_num:
        state.current_upadafa_text = normalize_whitespace(
            f"{state.current_upadafa_text} {line}"
        )
        chunk = state.last_chunk()
        if chunk and chunk["metadata"].get("chunk_type") == "upadafa":
            chunk["text"] = inject_context(
                build_context_prefix(
                    state.current_bhag,
                    state.current_parichhed,
                    state.current_dafa_num,
                    state.current_dafa_title,
                    state.current_upadafa_num,
                ),
                state.current_upadafa_text,
            )
    elif state.current_dafa_num:
        state.current_upadafa_text = normalize_whitespace(
            f"{state.current_upadafa_text} {line}"
        )
        chunk = state.last_chunk()
        if chunk and chunk["metadata"].get("chunk_type") == "dafa":
            chunk["text"] = inject_context(
                build_context_prefix(
                    state.current_bhag,
                    state.current_parichhed,
                    state.current_dafa_num,
                    state.current_dafa_title,
                ),
                state.current_upadafa_text,
            )


INDENT_STEP = 2


def parse_indented_line(line: str) -> tuple[int, str]:
    """Return (depth, text) from a 2-space indented structured line."""
    depth = 0
    pos = 0
    while line.startswith(" " * INDENT_STEP, pos):
        depth += 1
        pos += INDENT_STEP
    return depth, line[pos:].strip()


def process_indented_block(state: ParserState, depth: int, text: str) -> None:
    """Parse one pre-merged indented block (continuations already folded)."""
    if not text:
        return

    if depth == 0:
        process_line(state, text)
        return

    if depth == 2:
        kh_match = KHANDA_RE.match(text)
        if kh_match:
            letter = kh_match.group(1)
            body = kh_match.group(2).strip() or text
            upa = state.current_upadafa_num or "1"
            state.current_khanda = letter
            state.emit_chunk("khanda", body, upa, letter)
        else:
            upa = state.current_upadafa_num or "1"
            state.emit_chunk("khanda", text, upa, state.current_khanda)
        return

    # depth == 1 — परिच्छेद section title or उपदफा / स्पष्टीकरण / तर
    if CHAPTER_RE.search(text) and "परिच्छेद" in text[:20] and text.strip().startswith("परिच्छेद"):
        process_line(state, text)
        return

    sp_match = SPASTIKARAN_RE.match(text)
    if sp_match:
        label, body = sp_match.group(1), sp_match.group(2)
        state.current_upadafa_num = None
        state.emit_chunk("spastikaran", f"{label} {body}".strip())
        return

    tar_match = TAR_RE.match(text)
    if tar_match:
        label, body = tar_match.group(1), tar_match.group(2)
        state.current_upadafa_num = None
        state.emit_chunk("tar", f"{label} {body}".strip())
        return

    upa_match = UPADafa_RE.match(text)
    if upa_match:
        upa_num = upa_match.group(1)
        body = upa_match.group(2).strip() or text
        state.current_upadafa_num = upa_num
        state.current_khanda = None
        state.emit_chunk("upadafa", body, upa_num)
        return

    if state.current_upadafa_num:
        state.emit_chunk("upadafa", text, state.current_upadafa_num)


def parse_nepali_law_indented(
    raw_text: str,
    *,
    document_title: Optional[str] = None,
    document_category: Optional[str] = None,
    book_id: Optional[str] = None,
    book_key: Optional[str] = None,
) -> list[dict[str, Any]]:
    config = dict(DEFAULT_BOOK_CONFIG)
    if book_key and book_key in BOOK_CONFIGS:
        config.update(BOOK_CONFIGS[book_key])
    if document_title:
        config["document_title"] = document_title
    if document_category:
        config["document_category"] = document_category
    if book_id:
        config["book_id"] = book_id

    state = ParserState(book_config=config)
    for line in raw_text.split("\n"):
        if not line.strip():
            continue
        depth, text = parse_indented_line(line)
        process_indented_block(state, depth, text)

    return attach_chapter_hadamyad(state.chunks)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def parse_nepali_law(
    raw_text: str,
    *,
    document_title: Optional[str] = None,
    document_category: Optional[str] = None,
    book_id: Optional[str] = None,
    book_key: Optional[str] = None,
    input_format: str = "markers",
) -> list[dict[str, Any]]:
    """
    Parse raw Nepali legal text into RAG-ready chunks.

    Parameters
    ----------
    raw_text:
        Full document text (OCR output, extracted PDF text, etc.)
    document_title, document_category, book_id:
        Override metadata attached to every chunk.
    book_key:
        Shortcut into BOOK_CONFIGS (e.g. "civil-code").
    input_format:
        "markers" (default) or "indented" (derived .structured files).

    Returns
    -------
    list of dicts: { chunk_id, text, metadata }
    """
    if input_format == "indented":
        return parse_nepali_law_indented(
            raw_text,
            document_title=document_title,
            document_category=document_category,
            book_id=book_id,
            book_key=book_key,
        )

    config = dict(DEFAULT_BOOK_CONFIG)
    if book_key and book_key in BOOK_CONFIGS:
        config.update(BOOK_CONFIGS[book_key])
    if document_title:
        config["document_title"] = document_title
    if document_category:
        config["document_category"] = document_category
    if book_id:
        config["book_id"] = book_id

    state = ParserState(book_config=config)
    for line in iter_logical_lines(raw_text):
        process_line(state, line)

    return attach_chapter_hadamyad(state.chunks)


def parse_nepali_law_file(
    path: str,
    **kwargs: Any,
) -> list[dict[str, Any]]:
    with open(path, encoding="utf-8") as f:
        return parse_nepali_law(f.read(), **kwargs)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Parse Nepali legal code text into RAG chunks")
    parser.add_argument("--json-stdin", action="store_true", help="Read JSON from stdin, write chunks JSON to stdout")
    parser.add_argument("input", nargs="?", help="Path to raw .txt file")
    parser.add_argument("--book", default="civil-code", help="Book key from BOOK_CONFIGS")
    parser.add_argument("--json", metavar="OUT", help="Write chunks JSON to file")
    parser.add_argument("--limit", type=int, default=5, help="Preview first N chunks")
    args = parser.parse_args(argv)

    if args.json_stdin:
        payload = json.load(sys.stdin)
        input_format = payload.get("input_format", "markers")
        chunks = parse_nepali_law(
            payload["text"],
            document_title=payload.get("document_title"),
            document_category=payload.get("document_category"),
            book_id=payload.get("book_id"),
            book_key=payload.get("book_key"),
            input_format=input_format,
        )
        json.dump({"chunks": chunks}, sys.stdout, ensure_ascii=False)
        return 0

    if not args.input:
        parser.error("input file required unless --json-stdin is used")

    chunks = parse_nepali_law_file(args.input, book_key=args.book)
    print(f"Parsed {len(chunks)} chunks (book={args.book})")

    for chunk in chunks[: args.limit]:
        print("\n---", chunk["chunk_id"], "---")
        print(json.dumps(chunk["metadata"], ensure_ascii=False, indent=2))
        print(chunk["text"][:300], "..." if len(chunk["text"]) > 300 else "")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(chunks, f, ensure_ascii=False, indent=2)
        print(f"\nWrote {len(chunks)} chunks to {args.json}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
