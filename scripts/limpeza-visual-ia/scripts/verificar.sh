#!/usr/bin/env bash
# Verificador da limpeza visual. Uso: scripts/limpeza-visual/verificar.sh [--build] [caminho ...]
# Sem caminho, verifica src/. Sai com 1 se houver violação. Ajustar as três variáveis abaixo ao projeto.
# Com --texto, também falha com travessão (— –), barra vertical separando texto e aspas curvas (“ ” ‘ ’). Usar na Fase 3 e na entrega final.
# Fora do alcance de script (conferir na revisão): card dentro de card, ícone decorativo,
# mais de um botão primário por área, estado repetido na tela, cores dentro de imagens.
UI_DIR="src/components/ui"; TOKENS="src/index.css"; BASE="${BASE:-limpeza-visual-base}"

BUILD=0; TEXTO=0; ALVOS=()
for a in "$@"; do case "$a" in --build) BUILD=1;; --texto) TEXTO=1;; *) ALVOS+=("$a");; esac; done
if [ ${#ALVOS[@]} -eq 0 ]; then ALVOS=(src); for extra in index.html public; do [ -e "$extra" ] && ALVOS+=("$extra"); done; fi
EXCL=(-g "!$UI_DIR/**" -g "!$TOKENS" -g "!src/uikit.tsx")
falhas=0

checa() { # nome, padrão
  local saida; saida=$(rg -nIH "${EXCL[@]}" -e "$2" "${ALVOS[@]}" 2>/dev/null)
  if [ -n "$saida" ]; then
    echo "FALHA: $1 ($(echo "$saida" | wc -l) ocorrências)"; echo "$saida" | head -15; echo
    falhas=$((falhas + 1))
  fi
}

checa "cor direta do framework" '(text|bg|border|ring|fill|stroke|divide|from|to|via|placeholder)-(red|amber|yellow|orange|emerald|green|blue|sky|purple|indigo|violet|rose|teal|slate|gray|zinc|neutral|stone|cyan|pink|lime|fuchsia)-[0-9]+'
checa "hex solto" '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b'
checa "gradiente" 'bg-gradient|\bfrom-|\bvia-|\bto-[a-z]'
checa "prefixo dark: em componente" '\bdark:'
checa "raio ou sombra fora dos tokens" 'rounded-(xl|2xl|3xl)|shadow-(sm|md|lg|xl|2xl)\b'
checa "cor em estilo inline" 'style=\{\{[^}]*(color|background|border|fill|stroke|[sS]hadow)'
checa "cor em função (rgb, hsl)" '\brgba?\(|\bhsla?\('
checa "cor nomeada em atributo de SVG" '(fill|stroke)="(red|orange|yellow|green|blue|purple|pink|teal|cyan|indigo|violet|gray|grey|black|white)"'
checa "classe de cor montada por código" '\b(bg|text|border|ring|fill|stroke|from|to)-\$\{'
checa "gradiente ou sombra em CSS ou estilo" '(^|[^-])(linear|radial)-gradient|box-shadow:'
checa "borda e sombra no mesmo elemento" 'className="[^"]*\bborder\b[^"]*\bshadow|className="[^"]*\bshadow[^"]*\bborder\b'
if [ "$TEXTO" = 1 ]; then
  checa "travessão (— ou –)" '[—–]'
  checa "aspas curvas" '[“”‘’]'
  checa "barra vertical como separador de texto" '>[^<>{}|]*[[:alnum:]] [|│¦] [[:alnum:]][^<>{}]*<|(title|placeholder|aria-label|alt|label)="[^"|]*[[:alnum:]] [|│¦] [[:alnum:]][^"]*"|[│¦‖｜]'
fi

# Lógica: o inventário de handlers e chamadas não pode mudar em relação ao commit de partida.
inventario() { # [rev]
  if [ -n "${1:-}" ]; then git grep -hoE 'on[A-Z][A-Za-z]*=\{[^}]*\}|useEffect\(|fetch\(|navigate\(' "$1" -- "${ALVOS[@]}" 2>/dev/null | sort
  else git grep -hoE 'on[A-Z][A-Za-z]*=\{[^}]*\}|useEffect\(|fetch\(|navigate\(' -- "${ALVOS[@]}" 2>/dev/null | sort; fi
}
if git rev-parse -q --verify "$BASE" >/dev/null 2>&1; then
  dif=$(diff <(inventario "$BASE") <(inventario) | head -15)
  if [ -n "$dif" ]; then echo "FALHA: handlers ou chamadas mudaram em relação a $BASE"; echo "$dif"; echo; falhas=$((falhas + 1)); fi
else echo "AVISO: ref $BASE não existe; checagem de lógica ignorada"; fi

[ -f scripts/limpeza-visual/contraste.py ] && { python3 -I scripts/limpeza-visual/contraste.py || falhas=$((falhas + 1)); }
[ "$BUILD" = 1 ] && { npm run build --silent >/dev/null 2>&1 || { echo "FALHA: build"; falhas=$((falhas + 1)); }; }

if [ "$falhas" -eq 0 ]; then echo "OK: nenhuma violação"; exit 0; fi
echo "$falhas checagem(ns) com falha"; exit 1
