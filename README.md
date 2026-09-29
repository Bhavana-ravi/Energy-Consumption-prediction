# Wattwise energy outlook

A GitHub Pages-ready household energy dashboard. React, browser-side ARIMA, CSV parsing, charts, and SVG export all run in the browser; no Flask server or external API is required.

## Publish on GitHub Pages

The production JavaScript bundles are prepared in the project root; no local commands or folders in GitHub are needed.

1. In **Settings → Pages**, choose **Deploy from a branch**, then select `main` and `/(root)`.
2. Upload or replace `index.html`, `app.js`, `async.js`, and `styles.css` directly in the repository root. Keep all other source files there too, then commit to `main`.
3. Wait for GitHub Pages to finish publishing, then open `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

Do not upload `node_modules`, `.venv`, or generated build folders. When the app changes, replace the root `app.js` and `async.js` bundles as well as the source files.

## Important

- The published Pages site is public. Do not put private meter readings or other personal data in the repository.
- Forecasts are estimates based on the readings available in the browser, not official utility measurements or billing advice.

## CSV format and data storage

Upload a CSV with a date/timestamp column and a numeric consumption column. Common headings such as `date`, `timestamp`, `usage`, `consumption`, `energy`, `kwh`, and `value` are recognized. Multiple readings on the same date are added together; gaps between readings are interpolated. At least 12 days of data are required. Uploaded readings are saved in the current browser's local storage and are not sent to a server. The included `sample_energy.csv` is an example upload; a generated sample profile is shown by default.

## Forecast

The app fits an ARIMA(2, 1, 2) model in the browser and displays a 7- or 14-day forecast. The chart download is an SVG generated from the rendered chart.
