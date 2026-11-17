# intro-video

Fonte Hyperframes da intro do portfólio (fora do build Astro).

Cenas: hero → experiências → tecnologias → projetos de laboratório → CTA.  
Visual alinhado a `tokens.css` / `design.md` (paper/hero, accent `oklch(48% 0.09 180)`, Bricolage + Geist).

## Setup

```bash
cd intro-video
```

Node 22+, FFmpeg e Chrome (o CLI baixa o headless shell na primeira execução).

## Preview

```bash
npm run dev
```

## Render

```bash
npm run render
```

Gera `out/intro.mp4` e copia para `../public/videos/intro.mp4` (versionado, servido pelo site).

## SFX

Pixabay (Universfield), em `assets/sfx/`:

- `click.mp3` — clique do cursor no nome
- `whoosh.mp3` — transição entre cenas
