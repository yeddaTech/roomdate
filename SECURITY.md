# Security policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately through GitHub: open the **Security** tab of this repository and choose **Report a vulnerability**. Include what you found, how to reproduce it and what an attacker could do with it.

The maintainer will reply in the same private report, and the fix will be credited to you unless you prefer otherwise.

## Scope

Only the version deployed at <https://roomdate.vercel.app> (the `main` branch) receives fixes.

In scope: the web app and the API in this repository. Problems in the services it relies on (Vercel, Neon, Pusher, Cloudflare R2, the browsers' push services) should be reported to those providers.

Please do not run automated scans against the production site, do not access other people's accounts or data, and stop as soon as you can show the problem.
