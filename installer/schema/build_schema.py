#!/usr/bin/env python3
"""Stage schema-only SQL from administrator-supplied phpMyAdmin/MySQL dumps.

Rows, triggers, routines, grants, database selection, and original sequence
positions are excluded. No database connection is made.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path


def statements(source: str):
    delimiter = ";"
    quote = None
    comment = None
    chunks = []
    i = 0
    line_start = True
    while i < len(source):
        char = source[i]
        following = source[i : i + 2]
        if comment == "line":
            if char == "\n":
                comment = None
                chunks.append("\n")
                line_start = True
            i += 1
            continue
        if comment == "block":
            if following == "*/":
                comment = None
                chunks.append(" ")
                i += 2
            else:
                i += 1
            continue
        if quote:
            chunks.append(char)
            if char == "\\" and i + 1 < len(source):
                chunks.append(source[i + 1])
                i += 2
                continue
            if char == quote:
                if i + 1 < len(source) and source[i + 1] == quote:
                    chunks.append(source[i + 1])
                    i += 2
                    continue
                quote = None
            i += 1
            continue
        if line_start:
            match = re.match(r"[ \t]*DELIMITER[ \t]+(\S+)[ \t]*(?:\r?\n|$)", source[i:], re.I)
            if match:
                if "".join(chunks).strip():
                    raise ValueError("Unexpected SQL before DELIMITER directive")
                delimiter = match.group(1)
                chunks.clear()
                i += match.end()
                continue
        if following == "/*":
            comment = "block"
            i += 2
            continue
        if char == "#" or (following == "--" and (i + 2 == len(source) or source[i + 2].isspace())):
            comment = "line"
            i += 1 if char == "#" else 2
            continue
        if char in "'\"`":
            quote = char
        elif source.startswith(delimiter, i):
            statement = "".join(chunks).strip()
            if statement:
                yield statement
            chunks.clear()
            i += len(delimiter)
            line_start = False
            continue
        chunks.append(char)
        if char == "\n":
            line_start = True
        elif not char.isspace():
            line_start = False
        i += 1
    if quote or comment == "block":
        raise ValueError("Unterminated SQL quote or comment")
    remainder = "".join(chunks).strip()
    if remainder:
        yield remainder


def extract(source: Path):
    selected = []
    tables = {}
    for statement in statements(source.read_text(encoding="utf-8-sig")):
        match = re.match(r"^(CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|ALTER\s+TABLE)\s+`([A-Za-z0-9_]+)`\s*", statement, re.I)
        if not match:
            continue
        table = match.group(2)
        if match.group(1).upper().startswith("CREATE"):
            if table in tables:
                raise ValueError(f"Duplicate table definition: {table}")
            columns = re.findall(r"^\s*`([A-Za-z0-9_]+)`\s+", statement, re.M)
            if not columns:
                raise ValueError(f"No columns found: {table}")
            tables[table] = columns
        elif table not in tables:
            raise ValueError(f"ALTER precedes or references missing table: {table}")
        # Preserve AUTO_INCREMENT column attributes; reset only sequence values.
        statement = re.sub(r"\bAUTO_INCREMENT\s*=\s*\d+", "AUTO_INCREMENT=1", statement, flags=re.I)
        selected.append(statement + ";")
    if not tables:
        raise ValueError(f"No table definitions found in {source.name}")
    sql = "-- Lightem fresh-install schema. No application rows or triggers.\n\n" + "\n\n".join(selected) + "\n"
    return sql, {"tables": tables, "statementCount": len(selected), "sha256": hashlib.sha256(sql.encode()).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--primary-source", type=Path, required=True)
    parser.add_argument("--report-source", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent)
    parser.add_argument("--defaults-root", type=Path, default=Path(__file__).resolve().parents[2] / "database")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = {"formatVersion": 1, "mode": "fresh-empty", "schemas": {}, "bootstrap": {}}
    for name, source in (("primary", args.primary_source), ("report", args.report_source)):
        sql, metadata = extract(source)
        (args.output / f"{name}.sql").write_text(sql, encoding="utf-8")
        manifest["schemas"][name] = metadata
        print(f"{name}: {len(metadata['tables'])} tables, {metadata['statementCount']} schema statements; no rows copied")
    # These are application-defined defaults from reviewed repository migrations,
    # never INSERT statements taken from the customer database dumps.
    defaults = {
        "permissions": ("2026-08-09_pos_role_access_tables.sql", {"tbl_pos_permissions", "tbl_pos_roles", "tbl_pos_role_permissions"}),
        "discounts": ("2026-07-12_lkp_discount_type.sql", {"lkp_discount_type"}),
    }
    for name, (filename, allowed_tables) in defaults.items():
        selected = []
        for statement in statements((args.defaults_root / filename).read_text()):
            match = re.match(r"^(?:INSERT(?:\s+IGNORE)?\s+INTO|UPDATE)\s+`([A-Za-z0-9_]+)`", statement, re.I)
            if match and match.group(1) in allowed_tables:
                selected.append(statement + ";")
        if not selected:
            raise ValueError(f"No application defaults found for {name}")
        sql = "-- Fresh installations only: application defaults, no copied user rows.\n\n" + "\n\n".join(selected) + "\n"
        (args.output / f"bootstrap-{name}.sql").write_text(sql, encoding="utf-8")
        manifest["bootstrap"][name] = {"sha256": hashlib.sha256(sql.encode()).hexdigest(), "statementCount": len(selected)}
    (args.output / "schema-manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
