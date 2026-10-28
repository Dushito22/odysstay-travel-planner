# Odysstay Capture

Puts Idealista and Immobiliare listings into your Odysstay feed, without Odysstay ever loading those sites.

1. **Chrome extension**: chrome://extensions → turn on Developer mode → Load unpacked → pick this folder.
   Click the extension icon, paste your capture token, Save. Then just browse Idealista or Immobiliare:
   every listing on the pages you open is sent to Odysstay (the badge counts them).
2. **Gmail alerts**: on Idealista and Immobiliare, save your searches with email alerts on. Then open
   script.google.com → New project → paste `gmail-alerts.gs`, put your token in `CAPTURE_TOKEN`, run `install`.
   New matches arrive in Odysstay every 15 minutes by themselves.

Listings appear in Discover and in Argos with the portal's photo, price, size and a link back to the original.
