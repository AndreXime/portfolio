#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POSTPROCESS="$ROOT/postprocess_pdf_metadata.py"

cd "$ROOT"

if ! python3 -c "import pikepdf, yaml" >/dev/null 2>&1; then
  echo "Dependências Python não encontradas. Instale com:" >&2
  echo "  sudo apt install python3-pikepdf python3-yaml" >&2
  exit 1
fi

if ! command -v rendercv >/dev/null 2>&1; then
  echo "rendercv não encontrado no PATH" >&2
  exit 1
fi

mapfile -t YAMLS < <(
  if [[ $# -gt 0 ]]; then
    for arg in "$@"; do
      if [[ "$arg" = /* ]]; then
        printf '%s\n' "$arg"
      else
        printf '%s\n' "$ROOT/$arg"
      fi
    done
  else
    find "$ROOT" -maxdepth 1 -type f -name '*.yaml' ! -name '.render_*.yaml' | sort
  fi
)

if [[ ${#YAMLS[@]} -eq 0 ]]; then
  echo "Nenhum YAML encontrado em $ROOT" >&2
  exit 1
fi

render_one() {
  local YAML="$1"
  local TMP_YAML PDF

  if [[ ! -f "$YAML" ]]; then
    echo "YAML não encontrado: $YAML" >&2
    return 1
  fi

  echo "=== $(basename "$YAML") ==="

  TMP_YAML="$(mktemp "$ROOT/.render_XXXXXX.yaml")"
  cleanup_tmp() {
    rm -f "$TMP_YAML"
  }
  trap cleanup_tmp RETURN

  python3 "$POSTPROCESS" --yaml "$YAML" --write-render-yaml "$TMP_YAML"
  rendercv render "$TMP_YAML"

  PDF="$(python3 - <<PY
import yaml
from pathlib import Path
data = yaml.safe_load(Path(r"""$YAML""").read_text(encoding="utf-8"))
pdf_path = data["settings"]["render_command"]["pdf_path"]
print((Path(r"""$ROOT""") / pdf_path).resolve())
PY
)"

  if [[ ! -f "$PDF" ]]; then
    echo "PDF não encontrado: $PDF" >&2
    return 1
  fi

  python3 "$POSTPROCESS" "$PDF" --yaml "$YAML"
  echo
}

for YAML in "${YAMLS[@]}"; do
  render_one "$YAML"
done

echo "PDFs em: $ROOT/../public/CVs"
