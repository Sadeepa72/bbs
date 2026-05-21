# Deploy Guide — Beverage Billing System

## Architecture

```
Browser ──► Cloudflare Pages (frontend, free, SSL)
                │
                ▼
           Render (Node.js API, free, SSL)
                │
                ▼
           Azure SQL Database (MSSQL, free)
```

---

## Step 1: Create Azure SQL Database (Free)

1. Go to **[portal.azure.com](https://portal.azure.com)** → **Create a resource** → **SQL Database**
2. Create a **Resource Group** (e.g., `bbs-rg`)
3. **Database name**: `InventoryForCheck`
4. **Server**: Click **Create new**
   - Server name: `bbs-server` (pick any unique name)
   - Admin: `sqladmin` / pick a strong password (save these)
5. **Compute + storage**: Click **Configure database** → select **Free offer** (serverless, 100k vCore sec/mo, 32 GB — always free)
6. Click **Review + Create**

### Save Connection String

After deployment:
- Go to your SQL server → **Connection strings** → **ADO.NET**
- It looks like: `Server=tcp:bbs-server.database.windows.net,1433;Database=InventoryForCheck;User ID=sqladmin;Password=YOUR_PASSWORD;Encrypt=true;`
- Copy this — you'll need it later

### Allow Render IPs

- Go to your SQL server → **Networking** → **Firewall rules**
- Add a rule: `AllowAllAzure` / Start IP: `0.0.0.0` / End IP: `0.0.0.0` (allows Azure services)
- Also add Render's outbound IPs: [render-docs.com/static-ips](https://render.com/docs/static-ips) (or just add `0.0.0.0` temporarily)

---

## Step 2: Deploy Backend to Render

1. Go to **[render.com](https://render.com)** → Sign up with GitHub
2. Click **New +** → **Web Service**
3. Connect your GitHub repo (`Spyboss/bbs`)
4. Configure:
   - **Name**: `bbs-api`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Plan**: Free
5. Click **Advanced** → **Add Environment Variable**:
   - `DB_USER` = `sqladmin`
   - `DB_PASSWORD` = your password
   - `DB_SERVER` = `bbs-server.database.windows.net`
   - `DB_DATABASE` = `InventoryForCheck`
   - `DB_PORT` = `1433`
   - `PORT` = `3000`
6. Click **Create Web Service**

Wait for deploys. Copy the URL (e.g., `https://bbs-api.onrender.com`).

---

## Step 3: Deploy Frontend to Cloudflare Pages

1. Go to **[cloudflare.com](https://cloudflare.com)** → **Pages**
2. Click **Create a project** → **Connect to Git**
3. Connect GitHub and select `Spyboss/bbs`
3. Configure:
   - **Project name**: `bbs`
   - **Production branch**: `master`
   - **Build command**: (leave empty — it's static)
   - **Build output directory**: `/public`
4. Click **Save and Deploy**

### Update API URL

Cloudflare Pages needs to know your Render URL. Add an environment variable:

- In Cloudflare Pages → your project → **Settings** → **Environment variables**
- Add: `API_URL` = `https://bbs-api.onrender.com`

Then update the frontend code to use it.

---

## Step 4: Wire It Up

Edit `/public/script.js` and `/public/login.html` — replace all `fetch("/api/...")` with `fetch("https://bbs-api.onrender.com/api/...")`, or better, detect the API URL at runtime:

```js
const API = "https://bbs-api.onrender.com";
// then use fetch(API + "/api/customers") etc
```

Commit and push. Cloudflare auto-deploys.

---

## Done

Your app is live at: `https://bbs.pages.dev`

**Services used (all free):**
- Cloudflare Pages — frontend hosting + SSL
- Render — Node.js API
- Azure SQL — MSSQL database
