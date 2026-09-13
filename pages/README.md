# FCM development entry

Flow: website → fixed development account sign-in → OS selection / install / client
version check / update → Run client in the installed checker.

`login.js` implements a development UI gate only. It is not server authentication
or download access control. Credentials are not stored in browser storage or sent
in a native launch URI. Production authentication remains a separate task.

The `frankonia://launch` handler opens the installed client checker (1.3.0 or newer).
Clients up to 1.2.0 must install 1.3.0 manually once. The native checker verifies
the installed version against `releases.json`, validates the update SHA-256, and
blocks launch until checking/updating succeeds. Updates preserve local data.

Each target in `releases.json` has `version`, `url`, and `sha256`. Publish an immutable,
versioned installer to the approved HTTPS download host, verify its downloaded hash,
then update this manifest. A null URL/hash displays a not-yet-available message.
Do not add SFTP credentials or unverified Mac download links here.

Windows x64 has been exercised with the actual installer and local FCM session.
Mac Intel/Apple Silicon installer code exists in the development workspace but
native package creation and real-machine verification remain pending.

Browser regression test: install `fct` dependencies and Playwright Chromium, then
run `node client-installer/verify-web.mjs` from the repository root. Windows uses
installed Edge. The GitHub Actions entry check runs on pull requests; the existing
Pages workflow publishes this directory on changes merged to main.
