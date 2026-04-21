# ⚛️ Atomic Player

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkayan4bit%2Fspofree)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/kayan4bit/spofree)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kayan4bit/spofree)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kayan4bit/spofree)
[![Deploy to Railway](https://railway.com/button.svg)](https://railway.com/template/deploy?repo=https://github.com/kayan4bit/spofree)
[![Run on Fly.io](https://fly.io/static/images/launch/button.svg)](https://fly.io/launch?repo=https://github.com/kayan4bit/spofree)

**Atomic Player** is a futuristic, free, open-source, ad-free Hi-Res music player powered by TIDAL. It features a glassmorphic UI, neon accents, AI-driven recommendations, offline downloads, and a catalogue that covers anything TIDAL has.

> Formerly known as _SpoFree_. Same soul, fully rebuilt UI, faster APIs, new features.

## ✨ Features

- ⚛️ **Futuristic Glassmorphic UI** — neon cyan / violet / magenta accents with subtle animations
- 🧠 **AI Recommendations** — local, private "For You" picks derived from what you actually listen to
- 💎 **Hi-Res / Lossless Audio** (LOW / HIGH / LOSSLESS / HI_RES selectable)
- 🚫 **Ad-Free** listening, always
- 🎧 **Huge Catalogue** backed by the full TIDAL library
- 🎶 **Playlists** — create, edit, import (text / CSV / local files), export (CSV / FLAC ZIP)
- 💾 **Reliable downloads** with proper file-extension detection (FLAC, M4A, MP3, AAC, OGG, WAV)
- 📥 **Batch ZIP export** for entire playlists/albums
- ⌨️ **Keyboard shortcuts** — Space, ⌘/Ctrl + ←/→, L (like), M (mute), Esc
- 📱 **Media Session API** for lock-screen / control-center controls
- 📚 **Library** — Playlists, Liked Songs, Saved Albums, Followed Artists
- ⏰ **Sleep Timer**, 🎨 **Accent Picker**, ♿ **Reduced Motion / Grayscale / High-Performance** modes
- 📶 **Automatic API failover** across multiple public HiFi wrappers

## 🌐 API Instances

Atomic Player uses public [HiFi API wrappers](https://github.com/EduardPrigoana/hifi-instances) and automatically fails over between them. The current default instances are:

- `triton.squid.wtf`
- `hund.qqdl.site`
- `katze.qqdl.site`
- `vogel.qqdl.site`
- `wolf.qqdl.site`
- `maus.qqdl.site`

## ⚙️ How it works

1. You search for a track / album / artist
2. Atomic Player queries a HiFi API wrapper
3. The API returns a direct TIDAL lossless stream URL
4. Atomic Player streams, caches, and optionally downloads the audio — fully client-side

## 🚀 Local development

```bash
npm install
npm run dev      # Vite dev server
npm run build    # Production build
```

TypeScript strict mode and Vite 6 are used throughout.

## ☁️ Deploying

Atomic Player is a pure client-side SPA. Pick any host:

| Host | Config | Notes |
|---|---|---|
| **Cloudflare Pages** | Dashboard → Connect to Git | Vite preset, `npm run build`, output `dist` |
| **Cloudflare Workers** | `wrangler.json` | `npx wrangler deploy` (serves `dist` as static assets with SPA fallback) |
| **Vercel** | `vercel.json` | Click the button or `vercel --prod` |
| **Netlify** | `netlify.toml` + `public/_redirects` + `public/_headers` | Click the button or `netlify deploy --prod` |
| **Render** | `render.yaml` | Static site, auto-builds on push |
| **Railway** | `railway.json` + `Dockerfile` | Docker + nginx |
| **Fly.io** | `fly.toml` + `Dockerfile` | `flyctl launch` |
| **GitHub Pages** | `.github/workflows/deploy-pages.yml` | Auto-deploys `main` to Pages |
| **Docker (self-host)** | `Dockerfile` + `nginx.conf` | `docker build -t atomic-player . && docker run -p 8080:80 atomic-player` |

## 🤝 Contributing

Contributions welcome — open an issue or PR. Please keep changes focused and follow the existing code style.

## 🔗 Related projects

- https://github.com/uimaxbai/tidal-ui — inspiration
- https://github.com/uimaxbai/hifi-api — stream-resolving API
- https://github.com/EduardPrigoana/hifi-instances — public instance list
