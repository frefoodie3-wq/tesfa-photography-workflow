# Tesfa Photography Client Gallery

A client gallery for Tesfa Photography with optional Supabase persistence.

The site supports a professional proofing setup:

1. Create a gallery.
2. Upload preview images.
3. Send a private client link.
4. Let the client select favorites.
5. Receive the selected filename list for editing and later delivery.

## Supabase setup for the photographer

1. Create a new Supabase project for the photographer.
2. In Supabase Auth, create a user for the photographer.
3. Open the Supabase SQL editor and run `supabase/schema.sql`.
4. Open `supabase-config.js` and paste the project URL and anon public key.
5. Deploy to Vercel.

The anon key is safe to publish when the SQL policies are installed. Do not put the Supabase service-role key in this website.

Without Supabase config, the app still opens in browser-only mode for testing, but galleries and selections are not saved online.
