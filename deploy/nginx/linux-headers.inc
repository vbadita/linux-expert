# /etc/nginx/apps.badita.com.d/linux-headers.inc
# A location with add_header drops the server's add_header lines: re-add them here.
add_header Strict-Transport-Security "max-age=31536000" always;
add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
add_header X-Content-Type-Options    "nosniff" always;
# Static files only. No inline script or style anywhere (the app sets styles through
# the CSSOM, which the CSP allows). tests/serve.py sends the same policy.
add_header Content-Security-Policy   "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
