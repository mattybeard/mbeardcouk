# Matt Beard portfolio

A static, responsive homepage based on the refined Playbook design.
Plain HTML and CSS: no framework, package installation, build step, API or database.

## Structure

- `site/`: the **only** directory uploaded to Azure. Edit `site/index.html` for the live site.
- `mocks/`: historical design concepts; excluded from Git and deployment.
  Some old concepts contain superseded personal details, so keep them local.
- `tests/site.test.mjs`: dependency-free structure, content, privacy and local-link checks.
- `scripts/serve.mjs`: local preview with redirects, the custom 404 and configured headers.
- `.github/workflows/azure-static-web-apps.yml`: validation, deployment and PR-preview cleanup.

The site uses Google Fonts with system fallbacks. There are no analytics, cookies
or tracking scripts. The MB monogram is intentional; no real portrait is required.
GitHub is the current contact destination.

## Local preview

With Node.js 24 or newer installed, run from the project root (no `npm install` needed):

```powershell
npm start
```

Open `http://localhost:4280`. Stop the server with Ctrl+C.
The preview reproduces the configured redirect, 404 and headers. It is not a
full Azure emulator and doesn't implement Azure's platform-managed features.

Run the same checks used in GitHub Actions:

```powershell
npm test
```

## Azure Static Web Apps + GitHub Actions

1. Create a GitHub repository and push this project, including the workflow,
   with `main` as the production branch. This folder has not been initialised as
   a Git repository or pushed automatically. Respect `.gitignore`: do not force-add
   `mocks/`, credentials or environment files.
2. In Azure, create a **Static Web App**. The Free plan is sufficient for this
   static portfolio. Select **Other** as the deployment source so Azure doesn't
   generate a second workflow. Use the **deployment token** authorisation policy.
3. Open the Static Web App's **Manage deployment token** option and copy the token.
4. In the GitHub repository, open **Settings → Secrets and variables → Actions**.
   Add a repository secret named `AZURE_STATIC_WEB_APPS_API_TOKEN` containing
   that token. Never put it in a file or commit.
5. Run **Validate and deploy portfolio** from the Actions tab on `main`, or push
   a commit to `main`. The workflow validates the site, then uploads `site/`
   without invoking a build.
6. Open the generated Azure hostname from the Static Web App's Overview page.
   Confirm the homepage loads, `/index.html` redirects to `/`, and an unknown
   path shows the custom 404 page with HTTP status 404.

If you instead connect GitHub in the Azure creation wizard, use **Custom** with
app location `site`, no API location and no output location. Keep only one
deployment workflow: remove Azure's generated duplicate and copy or rename its
repository secret to the name expected above.

### Deployment behaviour

- Pushes to `main`: production deployment.
- Pull requests targeting `main` from branches **in the same repository**:
  validation and Azure preview deployment.
- Closed/merged pull requests: their preview environment is removed.
- Fork and Dependabot pull requests: validation only; no deployment secrets.
- Manual runs: validation on any branch, production deployment only on `main`.

Preview slots are limited by the selected Azure plan. The deployment action's
logs contain the deployment URL; no pull-request comment permission is needed.
If you choose a different production branch, replace all `main` references in
the workflow, including `production_branch`.

### Custom domain

After the first successful deployment, use **Custom domains** on the Azure
resource to add your domain and follow its DNS instructions. Azure provisions
the HTTPS certificate. No domain name or canonical URL is hard-coded in the
site until you choose one.

### Hosting configuration

`site/staticwebapp.config.json` supplies the homepage redirect, custom 404
and browser security headers. Unknown paths return 404 rather than pretending
to be valid single-page-app routes. Only the Google Fonts origins are permitted
for external styling/fonts; inline CSS is permitted because these static pages
embed their styles. Update the policy deliberately if you add scripts or embeds.

Reference: [Azure Static Web Apps build configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration).
