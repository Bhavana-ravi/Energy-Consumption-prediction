# Wattwise energy outlook

A GitHub Pages-ready household energy dashboard. React, browser-side ARIMA, CSV parsing, charts, and SVG export all run in the browser; no Flask server or external API is required.

## Deploy without a local build

You do not need to install Node.js, run the app, or build it on your computer. GitHub Actions installs the dependencies and builds the site after the files are uploaded.

1. On GitHub, create a new **empty** repository. Use a regular project name such as `energy-outlook`; do not add a README, license, or `.gitignore` during repository creation.
2. In that repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
3. Open the repository's **Code** tab, select **Add file → Upload files**, then drag the project files from File Explorer into the upload area. Keep `App.jsx`, `forecast.js`, `main.jsx`, `styles.css`, `index.html`, `vite.config.js`, `package.json`, `package-lock.json`, `README.md`, and `sample_energy.csv` directly in the repository root. Also include `.github/workflows/deploy.yml` in its `.github/workflows` folder. In File Explorer, turn on **View → Show → Hidden items** to see `.github`.
4. Do not upload `node_modules`, `.venv`, or `dist`; GitHub Actions creates the production build itself.
5. Enter a commit message such as `Add energy outlook app`, select **Commit directly to the main branch**, and commit the upload.
6. In the repository's **Actions** tab, wait for **Deploy to GitHub Pages** to finish successfully. The site will be available at `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`. Future commits to `main` publish updates automatically.

The workflow in `.github/workflows/deploy.yml` builds the static site and sets the repository subpath for project Pages sites. No local server or backend is needed.

## Important

- Upload `.github/workflows/deploy.yml` with the project files. Without it, GitHub Actions cannot publish the site.
- The published Pages site is public. Do not put private meter readings or other personal data in the repository.
- CSV readings selected in the site stay in that browser's local storage. They are not uploaded to GitHub or shared between devices. Clearing browser data removes them.
- Forecasts are estimates based on the readings available in the browser, not official utility measurements or billing advice.

## CSV format and data storage

Upload a CSV with a date/timestamp column and a numeric consumption column. Common headings such as `date`, `timestamp`, `usage`, `consumption`, `energy`, `kwh`, and `value` are recognized. Multiple readings on the same date are added together; gaps between readings are interpolated. At least 12 days of data are required. Uploaded readings are saved in the current browser's local storage and are not sent to a server. The included `sample_energy.csv` is an example upload; a generated sample profile is shown by default.

## Forecast

The app fits an ARIMA(2, 1, 2) model in the browser and displays a 7- or 14-day forecast. The chart download is an SVG generated from the rendered chart.
