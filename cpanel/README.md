# Running the site on cPanel (PHP + MySQL)

This branch runs the whole site — the marketing pages and the Customer
Support Professional Assessment — on ordinary cPanel hosting. The assessment
API is written in PHP and stores everything in a cPanel MySQL (or MariaDB)
database. Supabase and Vercel are not used.

It behaves like the Vercel version: the same pages, the same rules for
attempts, marking, payments and certificates, and the same API paths
(`/api/v1/...`). The differences are listed at the end.

## What you need

- cPanel hosting with **PHP 8.1 or newer** and these PHP extensions:
  `pdo_mysql`, `curl`, `mbstring`, `openssl` and `gd`
  (`intl` is recommended; names are normalised with it when available).
  In cPanel, check them under **Select PHP Version** or **MultiPHP Manager**.
- Apache with `mod_rewrite`, `mod_headers` and `.htaccess` overrides
  (standard on cPanel). The rules use Apache 2.4 syntax.
- An SSL certificate on the domain (cPanel **SSL/TLS Status** → AutoSSL).
  Paystack and the sign-in tokens need HTTPS.
- A MySQL 5.7+ / 8.x or MariaDB 10.4+ database (tested on MariaDB 10.4).

## 1. Build the release

There are two ways to get the site onto the server:

- **Git (recommended):** every push to `main` runs the GitHub workflow
  `.github/workflows/cpanel-release.yml`. It checks and builds the site and
  commits the result to the `cpanel-release` branch, which cPanel pulls. You
  don't need to build anything yourself; skip to step 2, then follow
  **3a**.
- **Zip upload:** build on your computer as below, then follow **3b**.

To build on your computer, you need Node.js, PHP 8.1+ and Composer.

```
npm install
npm run build:cpanel
```

This creates:

```
cpanel-dist/
  public_html/                → the website and the API entry point
  csp-app/                    → the application code (keep it private)
  10x-cpanel-release.zip      → both folders in one file
```

The build fails if any part of the answer key, a source map or a secret
would end up in `public_html`.

## 2. Create the database

1. cPanel → **MySQL Databases**.
2. Create a database (for example `account_csp`).
3. Create a user with a long, random password. Keep the password in your
   password manager; it goes into `.env` in step 4, nowhere else.
4. **Add User To Database** and give it these privileges only:
   `SELECT`, `INSERT`, `UPDATE`, `DELETE`.
5. cPanel → **phpMyAdmin** → select the new database → **Import** →
   choose `csp-app/database/schema.sql` → **Go**.

The import runs once on an empty database. Don't import it again over a live
database.

## 3a. Deploy with Git (cPanel Git Version Control)

The GitHub repository is private, so cPanel needs a read-only key to clone
it.

1. cPanel → **SSH Access** → **Manage SSH Keys** → **Generate a New Key**.
   Leave the passphrase empty (cPanel's Git tool can't enter one), then
   **View/Download** the public key and copy it.
2. GitHub → the repository → **Settings** → **Deploy keys** → **Add deploy
   key**. Paste the public key, and leave **Allow write access** unticked.
3. If you gave the key a name other than `id_rsa`, create `~/.ssh/config`
   in File Manager with:

   ```
   Host github.com
     IdentityFile ~/.ssh/<key name>
   ```

4. cPanel → **Git Version Control** → **Create**:
   - **Clone URL:** `git@github.com:fiyeduala/10x-marketing-solutions.git`
   - **Repository Path:** `repositories/10x-marketing-solutions`. This must
     **not** be inside `public_html`: the repository contains the answer key.
   - **Repository Name:** anything, e.g. `10x site`.
5. After it clones, open **Manage** → **Basic Information** and set
   **Checked-Out Branch** to `cpanel-release` → **Update**.
6. **Pull or Deploy** tab → **Deploy HEAD Commit**. This runs `.cpanel.yml`,
   which copies `public_html/` and `csp-app/` into your home directory.

If the domain's document root isn't `~/public_html`, edit the destination in
`cpanel/.cpanel.yml` on `main` and push.

Then continue with step 4.

## 3b. Upload the files

Upload and extract `10x-cpanel-release.zip` into your home directory
(cPanel → **File Manager**, one level *above* `public_html`). You should end
up with:

```
/home/<account>/
  csp-app/         ← NOT inside public_html
  public_html/
    index.html
    .htaccess
    api/
      index.php
      .htaccess
    assets/ ...
```

If `public_html` already has files you want to keep, back them up first.
The release replaces `index.html`, `.htaccess` and `assets/`.

`csp-app` must stay **outside** `public_html`: it holds the question bank
with the answers and your `.env`. `public_html/api/index.php` loads it from
`../../csp-app/`. If your domain's document root is somewhere else (an
addon domain, for example), keep `csp-app` two levels above
`api/index.php`, or edit the path in that file.

File Manager hides dotfiles by default. Use **Settings → Show Hidden Files**
to check that both `.htaccess` files arrived.

## 4. Configure `.env`

In File Manager, copy `csp-app/.env.example` to `csp-app/.env` and edit
the copy:

| Setting | Value |
| --- | --- |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | From step 2 (cPanel adds your account prefix to the names) |
| `APP_SECRET` | A new random value; run `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"` on your computer. Never change it after launch. |
| `APP_BASE_URL` | Your site's address, e.g. `https://www.your-domain` (no trailing slash) |
| `PAYSTACK_SECRET_KEY` | `sk_test_...` while testing; `sk_live_...` only when you go live |

Then set the file's permissions to **600** (File Manager → Permissions).

Leave `APP_ENV`, `PAYSTACK_API_BASE` and `TRUST_TEST_IP` unset on the live
site; they are for local testing only.

If the site is behind Cloudflare, set `CLIENT_IP_HEADER=CF-Connecting-IP`
so rate limits apply per visitor rather than per Cloudflare server.

## 5. Set the administrator password

The schema adds `10xpromotionscompany@gmail.com` as the only administrator,
with no password. To set one, run this **on your computer** from the
`cpanel/csp-app` folder:

```
php tools/admin-password.php 10xpromotionscompany@gmail.com
```

Type the password when asked (at least 12 characters; it is not shown or
saved). The tool prints one `UPDATE admin_users ...` line that contains only
the password's hash. Paste that line into phpMyAdmin → your database →
**SQL** → **Go**.

Run the tool again whenever you want to change the password. Changing it
signs out every existing admin session.

To add another administrator, first run
`INSERT INTO admin_users (email) VALUES ('their@email');` in phpMyAdmin,
then set their password the same way.

## 6. Connect Paystack

In the Paystack dashboard → **Settings → API Keys & Webhooks**:

- **Webhook URL:** `https://<your-domain>/api/v1/paystack/webhook`
- **Callback URL:** you can leave this empty. The site sends its own
  callback address with each payment.

Use test mode and the `sk_test_` key until a full test payment works. Switch
to the live key in `.env` only when you are ready to take real payments.

## 7. Check it works

1. Open `https://<your-domain>/api/v1/config`. You should see JSON with
   `"paymentsAvailable": true` once the Paystack key is set. A message
   about `vendor` or a 503 error means a step above is incomplete.
2. Open `https://<your-domain>/csp-app/.env` and
   `https://<your-domain>/api/.env`. Both must give "Not Found" or
   "Forbidden".
3. Take the assessment with a test email. Pay with a Paystack **test card**,
   download the certificate and check the verification link.
4. Sign in at `/customer-support-assessment/admin` and confirm that the
   attempt and the payment appear.

No cron job is needed. An attempt that runs out of time is marked
automatically the next time it is opened, and payments are confirmed by
the Paystack webhook or the return from checkout.

## Updating the site later

Most of the site's wording, services and projects live in
`src/content/site.ts`; project images are in `src/assets/`.

**With Git:** commit the change and push to `main`. Wait for the
**cPanel release** workflow to go green on GitHub (**Actions** tab, about
two minutes). If the checks or build fail, nothing is published. Then
cPanel → **Git Version Control** → **Manage** → **Pull or Deploy** →
**Update from Remote**, then **Deploy HEAD Commit**.

**With a zip:** run `npm run build:cpanel` again and upload `public_html/`
and `csp-app/` over the old copies.

Either way `csp-app/.env` is kept, because the release never contains one.
Old files are not deleted, so earlier versions of the hashed files in
`public_html/assets/` stay behind; they are harmless. Database changes, if a future update needs them, come as a
separate SQL file with its own instructions.

When you change questions in `server/questionBank.ts`, run
`npx tsx scripts/export-question-bank.mts` before building. That
regenerates `csp-app/data/questionBank.php`.

## How this differs from the Vercel version

- **Administrator sign-in:** the admin enters an email and password checked
  by the PHP API, instead of Supabase Auth. Sessions last 8 hours, and
  "Sign out" ends them on the server.
- **Database integrity:** database triggers are replaced by checks inside
  transactions in the PHP code. Unique keys still stop a second open attempt,
  a second successful payment and a second certificate for one attempt.
- **Fresh data:** this database starts empty. Nothing is copied from the
  Supabase project.

## Local development

`cpanel/dev-router.php` runs the API with PHP's built-in server. To run the
end-to-end tests, use a development database with the schema imported —
never the live one:

```
cd cpanel/csp-app && composer install && cd ../..
# export DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD and APP_SECRET first
npx vite build
npx tsx tests/e2e/scenarios.mts
```
