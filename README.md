# NZ Malaya – Lead Capture Form

A visitor fills in **name, email, WhatsApp number** → the lead lands in your **Google Sheet** → you get a **WhatsApp alert** on your business number.

```
Form (GitHub Pages) ──POST──▶ Google Apps Script ──▶ Google Sheet (row added)
                                      └──────────────▶ WhatsApp Cloud API ──▶ your phone
```

No servers to run, no cost (Google + GitHub Pages are free; WhatsApp charges small per-message fees after the free tier).

## Files
| File | What it is |
|---|---|
| `index.html` | The public form (mobile-friendly, dark-mode aware, spam honeypot) |
| `apps-script/Code.gs` | Backend: saves to Sheet + sends WhatsApp alert |

## Setup (about 20 minutes)

### 1. Google Sheet + script
1. Create a new Google Sheet (e.g. "NZ Malaya Leads").
2. **Extensions → Apps Script**. Delete the sample code, paste in `apps-script/Code.gs`, save.
3. The first lead creates a `Leads` tab with headers automatically.

### 2. WhatsApp Business Cloud API (Meta)
1. Go to [developers.facebook.com](https://developers.facebook.com) → create an app (type **Business**) → add the **WhatsApp** product.
2. Connect/add your WhatsApp business number and note the **Phone number ID**.
3. Create a **System User** token in Business Settings with `whatsapp_business_messaging` permission (permanent token).
4. **Create a message template** (WhatsApp Manager → Message templates), category *Utility*, name `new_lead`, language English, body:
   ```
   New NZ Malaya lead 🎉
   Name: {{1}}
   Email: {{2}}
   WhatsApp: {{3}}
   ```
   Wait for approval (usually minutes). A template is required because WhatsApp only allows free-text replies within 24h of the recipient messaging you.

### 3. Store your secrets (never commit them)
In Apps Script: **Project Settings (⚙) → Script properties → Add**:

| Property | Value |
|---|---|
| `WA_TOKEN` | Your permanent access token |
| `WA_PHONE_ID` | Phone number ID from step 2 |
| `NOTIFY_TO` | Number to alert, digits only with country code (e.g. `64211234567`) |
| `WA_TEMPLATE` | `new_lead` (optional) |
| `WA_TEMPLATE_LANG` | `en` (optional) |

Tip: the alert recipient can be a different number from the sending business number (Meta won't deliver a business number to itself).

### 4. Deploy and connect the form
1. Apps Script: **Deploy → New deployment → Web app** · Execute as **Me** · Who has access **Anyone** → Deploy, authorise, copy the **Web app URL**.
2. Paste that URL into `ENDPOINT` near the bottom of `index.html` and commit.
3. Test the backend first: in the editor select `testLead` → **Run**. Check the Sheet row and the "WhatsApp alert status" column (it says `sent` or the error).

### 5. Publish the form
GitHub repo → **Settings → Pages → Deploy from branch** → pick your main branch, `/ (root)`. Your form is live at `https://<user>.github.io/<repo>/`. Link it from Instagram/TikTok/Facebook bios.

## Tracking which post brought each lead
Add UTM tags to the link you put on each post/bio. The form records them next to every lead (columns **Source, Medium, Campaign, Post / Content, Referrer**; no tags = `direct`).

```
https://<user>.github.io/<repo>/?utm_source=instagram&utm_medium=reel&utm_campaign=bali-trip&utm_content=reel-12
```
Use a different `utm_content` per post (e.g. `reel-12`, `story-sep3`, `tiktok-hook-b`), then filter or pivot the sheet to see which posts convert. If the link goes through Linktree, put the tagged URL as the Linktree button's destination.

## Notes
- The Apps Script URL is public by design (the form must call it), so the script validates input, drops bot submissions (honeypot) and neutralises spreadsheet formula injection. Secrets stay in Script properties, not in this repo.
- Whenever you edit `Code.gs`, use **Deploy → Manage deployments → Edit → New version** or changes won't go live.
- Privacy: you're collecting personal data – add a short privacy note/consent line to the form if you market to people in NZ/Malaysia/EU.

## Ideas to extend
Auto-reply email via `MailApp`, a daily lead summary to WhatsApp, or a Meta Pixel/TikTok Pixel for retargeting.
