# Paper deployment

Review local code and homepage-review.html before making any production change.

1. Apply supabase/paper.sql once to the existing project. It adds two tables and a private PDF bucket, with owner and active workspace membership policies. It does not change the research workspace.
2. Generate a random 32-byte key using Node crypto.randomBytes(32).toString('base64'). Set PAPER_ENCRYPTION_KEY as a server-only Vercel environment variable. Never use a public variable name or commit the value. Keep a recoverable private copy; changing this value makes existing saved API keys unreadable until re-entered.
3. Retain existing SUPABASE_URL and SUPABASE_ANON_KEY variables. No service-role credential is required.
4. Approve and deploy through the existing Vercel project. Sign in, visit /paper and register provider keys in Settings. Use “모델 불러오기” to check key access and select an available model ID.

Keys are encrypted with AES-256-GCM and owner/provider additional authenticated data. Only the last four characters return to the UI. Keys never enter browser storage. Provider calls go through fixed server-side HTTPS endpoints. PDF requests include the paper only when selected; translation never sends the PDF. PDFs are limited to 2.5 MB to fit the existing Vercel JSON request limit. Larger files need to be reduced before upload.

Records use optimistic revision checks. On a conflict, export local Markdown before refreshing. A browser-close warning protects unsaved in-memory edits. Generation history retains at most 40 entries. Deleting a project or detaching a PDF removes its record/reference; old file objects remain private in paper-files and can be removed by the owner during storage maintenance.

Local preview: the existing localhost developer session can open /paper. Set an encryption key locally only if testing real keys. Static homepage-review.html uses fictional in-memory data and blocks keys, file uploads and model calls.

Verification is mocked unless real provider credentials are deliberately supplied after deployment. Model IDs are editable and can be refreshed from each account’s Models API; no fallback provider is called automatically.
