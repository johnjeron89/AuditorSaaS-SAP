# Auditer SaaS — Google Workspace Security Auditor

SaaS platform for auditing Google Workspace tenants against CIS, GDPR, and SOC 2 frameworks.

## Architecture Overview

This project is built with:
*   **Supabase:** Postgres database, Edge Functions, Storage, and Authentication.
*   **Next.js Dashboard:** React frontend for users to manage tenants, view audit runs, and download reports.

## Prerequisites

*   Node.js 18+
*   Supabase CLI
*   Deno (for local edge function development)

## Quick Start

1.  **Clone the repository**
2.  **Start Supabase locally:**
    ```bash
    supabase start
    ```
3.  **Apply database migrations:**
    ```bash
    supabase db reset
    ```
4.  **Set up Vault secret for credential encryption:**
    Connect to your local database (e.g., via Studio at `http://localhost:54323` or psql) and run:
    ```sql
    select vault.create_secret('YOUR_LOCAL_SECRET_KEY_HERE', 'credentials_encryption_key', 'AES key for encrypting tenant service account credentials');
    ```
5.  **Start the Next.js Dashboard:**
    ```bash
    cd dashboard
    npm install
    npm run dev
    ```

## Environment Variables

Create a `.env.local` file in the dashboard directory with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key_for_report_generation
```

## Edge Functions

To deploy or run Edge Functions locally:

```bash
# Serve locally
supabase functions serve

# Deploy to project
supabase functions deploy
```

## 20 Checks Overview

| Check ID | Title | Severity |
| :--- | :--- | :--- |
| `gws-auth-1` | Enforce 2-Step Verification | Critical |
| `gws-auth-2` | Disable Less Secure Apps | High |
| `gws-auth-3` | Review Admin Privileges | Critical |
| `gws-drive-1` | Restrict External Sharing | High |
| `gws-drive-2` | Disable Public Link Sharing | High |
| `gws-mail-1` | Enforce SPF Records | Critical |
| `gws-mail-2` | Enforce DKIM Records | Critical |
| `gws-mail-3` | Enforce DMARC Records | High |
| `gws-mobile-1` | Require Screen Locks | Medium |
| `gws-mobile-2` | Enable Device Encryption | Medium |
| `gws-apps-1` | Restrict Third-Party App Access | High |
| `gws-apps-2` | Review OAuth Scopes | Medium |
| `gws-audit-1` | Retain Admin Audit Logs | Medium |
| `gws-audit-2` | Retain Login Audit Logs | Medium |
| `gws-sec-1` | Alert on Suspicious Login | High |
| `gws-sec-2` | Password Policy Enforcement | High |
| `gws-user-1` | Suspension of Inactive Users | Medium |
| `gws-data-1` | DLP Rules for Sensitive Data | Critical |
| `gws-groups-1` | Restrict Group Creation | Low |
| `gws-meet-1` | External Participant Warnings | Low |

## License

MIT License. See LICENSE for more information.
