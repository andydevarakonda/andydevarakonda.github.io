# Anirudh Devarakonda Portfolio

Single-page portfolio: **https://andymahesh.github.io/AnirudhDevarakondaPortfolio/**

Static site with no build step: `index.html`, `style.css`, `app.js`, plus `assets/`, which holds the images, the self-hosted GSAP 3.15 and Lenis 1.3, the fonts, and `data.js` with the project copy and image manifest.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)

1. Make the repository public: **Settings → General → Danger Zone → Change visibility**. On a free plan, Pages requires a public repository.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**, then choose **Branch: `main`**, folder **`/ (root)`**, and **Save**.
3. Wait a minute or two. The site is live at the URL above. Every push to `main` redeploys it.

`.nojekyll` makes GitHub serve the files as they are.

## Editing content

- Project text, metrics and figure captions live in `assets/data.js`. Card text on the main page is also in `index.html`, so update both.
- Every `<img>` has a `data-asset="<id>"` attribute. Each id matches an entry in `assets/img/manifest.json` and a file in `assets/img/<project>/`.
