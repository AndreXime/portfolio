#!/usr/bin/env python3
"""Reescreve metadata do PDF (Creator, Producer, Subject, Keywords)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pikepdf
import yaml

CREATOR = "André Ricardo Ximenes"
PRODUCER = "andreximenes.xyz"


def load_pdf_metadata(yaml_path: Path) -> tuple[str | None, list[str]]:
    data = yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
    meta = data.get("pdf_metadata") or {}
    description = meta.get("description")
    keywords = meta.get("keywords") or []
    if isinstance(keywords, str):
        keywords = [part.strip() for part in keywords.split(",") if part.strip()]
    if not isinstance(keywords, list):
        raise SystemExit(f"pdf_metadata.keywords deve ser lista ou string: {yaml_path}")
    return description, [str(item) for item in keywords]


def write_render_yaml(source_yaml: Path, destination_yaml: Path) -> None:
    data = yaml.safe_load(source_yaml.read_text(encoding="utf-8")) or {}
    data.pop("pdf_metadata", None)
    destination_yaml.write_text(
        yaml.safe_dump(data, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )


def update_metadata(
    pdf_path: Path,
    description: str | None = None,
    keywords: list[str] | None = None,
) -> None:
    keywords = keywords or []

    with pikepdf.open(pdf_path, allow_overwriting_input=True) as pdf:
        with pdf.open_metadata(set_pikepdf_as_editor=False) as meta:
            meta["dc:creator"] = [CREATOR]
            meta["xmp:CreatorTool"] = CREATOR
            meta["pdf:Producer"] = PRODUCER
            if description:
                meta["dc:description"] = description
            if keywords:
                meta["dc:subject"] = keywords
            for key in list(meta.keys()):
                if "Typst" in str(meta.get(key, "")):
                    del meta[key]

        pdf.docinfo["/Creator"] = pikepdf.String(CREATOR)
        pdf.docinfo["/Producer"] = pikepdf.String(PRODUCER)
        if description:
            pdf.docinfo["/Subject"] = pikepdf.String(description)
        if keywords:
            pdf.docinfo["/Keywords"] = pikepdf.String(", ".join(keywords))

        pdf.save(
            pdf_path,
            fix_metadata_version=True,
            recompress_flate=True,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Atualiza metadata do PDF gerado pelo RenderCV."
    )
    parser.add_argument("pdf", nargs="?", type=Path, help="Caminho do PDF")
    parser.add_argument(
        "--yaml",
        type=Path,
        help="YAML com pdf_metadata.description e pdf_metadata.keywords",
    )
    parser.add_argument(
        "--write-render-yaml",
        type=Path,
        help="Escreve YAML sem pdf_metadata para o rendercv render",
    )
    args = parser.parse_args()

    if args.write_render_yaml is not None:
        if args.yaml is None:
            print("--write-render-yaml exige --yaml", file=sys.stderr)
            return 1
        write_render_yaml(args.yaml, args.write_render_yaml)
        return 0

    if args.pdf is None:
        print("Informe o caminho do PDF", file=sys.stderr)
        return 1

    pdf_path = args.pdf.expanduser().resolve()
    if not pdf_path.is_file():
        print(f"PDF não encontrado: {pdf_path}", file=sys.stderr)
        return 1

    description: str | None = None
    keywords: list[str] = []
    if args.yaml is not None:
        yaml_path = args.yaml.expanduser().resolve()
        if not yaml_path.is_file():
            print(f"YAML não encontrado: {yaml_path}", file=sys.stderr)
            return 1
        description, keywords = load_pdf_metadata(yaml_path)

    update_metadata(pdf_path, description=description, keywords=keywords)
    print(f"Metadata reescrita: {pdf_path}")
    print(f"  Creator/Aplicativo: {CREATOR}")
    print(f"  Producer/Produtor:  {PRODUCER}")
    print(f"  Subject/Assunto:    {description or '(não definido)'}")
    print(f"  Keywords:           {', '.join(keywords) if keywords else '(não definido)'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
