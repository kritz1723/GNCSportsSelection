# GNC Sports Selection 2026–27

Guru Nanak College (Autonomous), Chennai — Sports Selection Portal

## Files

| File | Purpose |
|---|---|
| `index.html` | Student-facing application form |
| `dashboard.html` | Staff monitoring dashboard |
| `GNC_AppScript_v4.gs` | Google Apps Script (paste into Apps Script editor) |
| `gnc-logo.jpeg` | College logo (used in the topbar of the dashboard) |

## Hosting on GitHub Pages

1. Push all files to a GitHub repository
2. Go to **Settings → Pages → Source → main / root**
3. Your URLs will be:
   - Form: `https://YOUR_USERNAME.github.io/YOUR_REPO/`
   - Dashboard: `https://YOUR_USERNAME.github.io/YOUR_REPO/dashboard.html`

## One-time setup

1. Open the [Google Sheet](https://docs.google.com/spreadsheets/d/1jgAraXG4HpyPHRrYn9-MSDhbwgE9QPZuElh6DR9CvK8)
2. Go to **Extensions → Apps Script**
3. Paste the contents of `GNC_AppScript_v4.gs` and save
4. **Deploy → New Deployment → Web App**
   - Execute as: *Me*
   - Who has access: *Anyone*
5. Copy the Web App URL — it's already set in both `index.html` and `dashboard.html`

## Dashboard logo

Upload `gnc-logo.jpeg` to the root of your repo. The dashboard topbar will pick it up automatically via:
```
https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/gnc-logo.jpeg
```
Update the `onerror` fallback in `dashboard.html` with your actual GitHub username and repo name.

## Data flow

```
Student fills index.html
        ↓  POST JSON
  Apps Script (doPost)
        ↓
  Google Sheet  ←──── dashboard.html polls via doGet?action=data
  Google Drive (certificates)
```
