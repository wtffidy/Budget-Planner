# 💰 Budget Tracker

A simple, private budget tracker that runs entirely in your browser. No server, no accounts, no build step, no dependencies.

- **Dashboard** - pick a month: income, spent, saved, left over, savings rate, and budget vs. actual with On track / Near limit / Over budget status
- **Transactions** - add, edit, delete, search, and filter by month
- **Year** - month-by-month table and income vs. spent chart
- **Setup** - your income sources, spending categories, monthly budgets, and currency
- Light and dark mode (follows your system), works on phone and desktop
- Export a JSON backup, import it on another device, or export transactions as CSV

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `styles.css` | Styling (light/dark aware) |
| `app.js` | All app logic |
| `favicon.svg` | Tab icon |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is |
| `README.md` | This file |

## Run it locally

Just double-click `index.html`. Nothing to install.

## Host it free on GitHub Pages

1. Create a new repository on GitHub (public or private, Pages on private repos needs a paid plan).
2. Upload all the files in this folder to the repo root (drag and drop works on the GitHub website).
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**, pick `main` and `/ (root)`, then click **Save**.
5. After a minute or so your app is live at `https://<your-username>.github.io/<repo-name>/`.

Or from the command line:

```bash
git init
git add .
git commit -m "Budget tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

## About your data

- Your data is stored in your browser's `localStorage`. It is **never uploaded**, even when the app is hosted publicly. The repo only contains the code.
- That also means data is **per browser and per device**. Use **Setup → Export backup** to move it or keep a copy.
- Clearing your browser's site data erases your budget, so export a backup occasionally.
- The budget amounts and categories on first load are placeholders. Change them in **Setup**, or use **Load demo data** to see how it looks filled in.

## Customizing

- Currencies: edit the `CURRENCIES` list at the top of `app.js`.
- Colors: change the CSS variables at the top of `styles.css`.
