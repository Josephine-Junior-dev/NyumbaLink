# NyumbaLink

A mobile-first real estate marketplace foundation for Kenya. Buyers discover properties; owners and agents create and manage their own listings.

## Stack
- HTML, CSS and vanilla JavaScript
- Supabase Auth and PostgreSQL
- Row Level Security (RLS)
- GitHub Pages hosting

## Setup
1. Create or open your Supabase project.
2. Open **SQL Editor** and run all of `supabase/schema.sql`.
3. Open `config.js` and replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY` with the project's URL and publishable/anon key.
4. Commit the changes to GitHub.
5. In repository **Settings → Pages**, deploy from the `main` branch, root folder.
6. Open the Pages URL after deployment.

The browser must use only the Supabase publishable/anon key. Never put a service-role key in `config.js`.

## Included in this first build
- Responsive marketplace home page
- Property search by location, type and maximum price
- Public available-property browsing
- Email sign-up and sign-in
- Authenticated property listing creation
- Owner-only listing edits and deletion
- Property detail view and WhatsApp contact link
- Separate `nl_` database tables and owner-scoped RLS policies

## Product roadmap
- User profiles and buyer/owner/agent role onboarding
- Secure image uploads to a private-aware public listing bucket
- Favourites and saved searches
- In-app enquiries and agent inbox
- Agent dashboards, verification workflow and moderation console
- Subscription plans, featured listings and payment integration
- Admin audit trail, abuse reporting and analytics

## Important production notes
This is the first working marketplace foundation, not a fully launched brokerage or payment platform. Listings are user-submitted and are not verified by default. Buyers should independently verify ownership, title documents, agent identity and property details before paying deposits. Subscription activation, verification badges and featured placement must be controlled by trusted server-side/admin processes.