# GeoReachAid — Link Location Beacon

## Original Problem Statement
User wants a donation-outreach tool: paste any URL (e.g. a YouTube link), the app generates a new tracking link. Whoever opens the tracking link has their precise GPS location recorded, then is instantly redirected to the original URL, so the user can reach beneficiaries to give donations.

## User Choices
- Location capture: Precise GPS (browser Geolocation), IP-based fallback if denied
- Redirect: instant to original URL after capture
- Admin dashboard: yes, with a map
- Works for: ANY URL
- Auth: none (open dashboard)

## Architecture
- Backend: FastAPI + MongoDB (motor). Routes under /api.
- Frontend: React + react-router, Leaflet (CartoDB dark tiles), sonner toasts, Tailwind.
- Geocoding: Nominatim (reverse geocode GPS -> place/city/country), ip-api.com (IP fallback). No API keys.

## Implemented (2026-06)
- POST /api/links, GET /api/links, GET /api/links/{code}, DELETE /api/links/{code}
- GET /api/resolve/{code}, POST /api/track (GPS + IP fallback), POST /api/simulate
- GET /api/records, PATCH /api/records/{id} (dispatch status + notes), GET /api/export (CSV)
- Dashboard: stats, link generator, beacon list (copy/simulate/delete), live Leaflet map, records table with dispatch status
- Visitor gate /r/:shortCode: geolocation prompt -> capture -> instant redirect

## Backlog / Remaining
- P1: QR code for each link; per-link detail page
- P2: Login/auth (currently open); clustering on map; distance-from-base calc
