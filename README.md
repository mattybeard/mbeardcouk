# Matt Beard portfolio

A static, responsive homepage based on the refined Playbook design.
Plain HTML and CSS: no framework, package installation, build step, API or database.

## Structure

- `site/`: the **only** directory published to Azure. Edit `site/index.html` for the live site.
- `tests/site.test.mjs`: dependency-free structure, content, privacy and local-link checks.
- `scripts/serve.mjs`: local preview with redirects, the custom 404 and configured headers.
- `.github/workflows/validate.yml`: runs the checks on pushes and pull requests. It does not deploy.
- `.github/workflows/azure-static-web-apps-<name>.yml`: deployment workflow generated
  by Azure when the Static Web App is connected to GitHub (see below).

The site uses Google Fonts with system fallbacks. There are no analytics, cookies
or tracking scripts. The MB monogram is intentional; no real portrait is required.
GitHub is the current contact destination. Old design mocks are kept locally in
`mocks/` and excluded from Git.

## Local preview

With Node.js 24 or newer installed, run from the project root (no `npm install` needed):

```powershell
npm start
```

Open `http://localhost:4280`. Stop the server with Ctrl+C.
The preview reproduces the configured redirect, 404 and headers. It is not a
full Azure emulator.

Run the same checks used in GitHub Actions:

```powershell
npm test
```

## Deploying to Azure Static Web Apps

Azure connects directly to this GitHub repository and creates the deployment workflow.

1. In the Azure portal, create a **Static Web App**:
   - **Plan:** Free is sufficient.
   - **Source:** GitHub. Sign in as **mattybeard** (not a work GitHub account).
     If the wrong account appears, sign out of GitHub in the browser and authorise again.
   - **Organization / Repository / Branch:** `mattybeard` / `mbeardcouk` / `main`.
   - **Build presets:** Custom.
   - **App location:** `site`
   - **Api location:** leave blank.
   - **Output location:** leave blank.
2. Select **Review + create**, then **Create**. Azure will:
   - commit `.github/workflows/azure-static-web-apps-<name>.yml` to `main`;
   - add a repository secret named `AZURE_STATIC_WEB_APPS_API_TOKEN_<NAME>`;
   - run the first deployment.
3. Pull Azure's commit locally before making further changes:

   ```powershell
   git pull
   ```

4. Optional but recommended: in the generated workflow, add `skip_app_build: true`
   under the `with:` block of the deploy step. The site has nothing to build, so
   this skips Azure's build detection and makes deployments faster.
5. Open the Azure hostname from the Static Web App's **Overview** page. Confirm the
   homepage loads, `/index.html` redirects to `/`, and an unknown path shows the
   custom 404 page.

Do not rename or copy the generated secret into files. Keep only Azure's workflow
for deployment; `validate.yml` is intentionally deploy-free so there is never a
second deployment.

### Deployment behaviour (Azure-generated workflow)

- Pushes to `main`: production deployment.
- Pull requests to `main`: a preview environment, removed when the pull request closes.
- `validate.yml` runs alongside and reports any broken HTML, links or content.
  To block merging on it, enable branch protection on `main` and require the
  **Validate site / validate** check.

Preview environments are limited by the Azure plan.

### Custom domain

After the first successful deployment, use **Custom domains** on the Azure
resource to add your domain and follow its DNS instructions. Azure provisions
the HTTPS certificate.

### Hosting configuration

`site/staticwebapp.config.json` supplies the homepage redirect, custom 404
and browser security headers. Unknown paths return 404 rather than pretending
to be single-page-app routes. Only Google Fonts origins are permitted for external
styles and fonts; inline CSS is permitted because the pages embed their styles.
Update the policy deliberately if you add scripts or embeds.

Reference: [Azure Static Web Apps build configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration).
