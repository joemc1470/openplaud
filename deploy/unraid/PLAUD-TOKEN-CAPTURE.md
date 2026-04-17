# Capturing your Plaud bearer token

openplaud syncs recordings off your Plaud Note Pro by impersonating the
official web app. To do that it needs the same bearer token your browser
gets when you log in. You capture it once, paste it into the openplaud
onboarding wizard, and it's stored encrypted in Postgres.

## Steps

1. Open Chrome (or any Chromium browser — Safari's DevTools work too but
   the screenshots below assume Chrome).

2. Go to **https://app.plaud.ai/** and log in with your Plaud account.

3. Open DevTools: `Cmd+Opt+I` (Mac) or `F12` (Windows/Linux).

4. Click the **Network** tab.

5. **Reload the page** (`Cmd+R`). The Network tab fills with requests.

6. In the filter box at the top of Network, type `api.plaud` to narrow the
   list. You'll see entries like `recordings`, `user/profile`, etc.

7. Click any one of those rows. The right-hand panel opens. Click the
   **Headers** tab.

8. Scroll down to **Request Headers** and find the line:
   `Authorization: Bearer eyJhbGci...` (the token is a long string of
   letters, numbers, dots, dashes).

9. Copy **everything after** `Bearer ` (don't include the word "Bearer "
   itself or the space). Just the token.

10. Note the **request URL host** at the top of that same row. It's either:
    - `api.plaud.ai` → US account
    - `api-euc1.plaud.ai` → EU account
    - other regional hosts may exist

    You'll select this host in the openplaud onboarding wizard's region
    dropdown.

11. Paste the token into openplaud's onboarding wizard, "Connect Plaud
    device" step, "Bearer token" field. Pick the matching region from the
    dropdown.

## Token expiry

Plaud's tokens are JWTs and expire eventually. The exact lifetime isn't
documented; the community reports anywhere from a few hours to a few weeks.

When openplaud's sync starts returning 401s, the UI will show an alert.
Re-run this capture process and paste the new token into Settings →
Plaud Connection → Update Token.

## Security notes

- The token grants full read access to your Plaud cloud account. Treat it
  like a password.
- openplaud encrypts the token at rest with the `ENCRYPTION_KEY` you
  generated for the deployment. If that key is lost, the token (along with
  every other encrypted secret) is unrecoverable.
- Don't paste the token into any other app, Discord, screenshots that get
  shared, etc.
