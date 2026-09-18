#!/bin/bash
WORKSPACE="/home/uber/Apps/official"

add_js_header() {
  local file="$1"
  local filename=$(basename "$file")
  local first_line=$(head -1 "$file")
  
  # Skip if already has copyright header
  if echo "$first_line" | grep -q "Copyright"; then
    return
  fi
  
  # Build description from filename
  local desc=""
  case "$filename" in
    http.js) desc="HTTP utilities — JSON responses, CORS, admin key auth, input sanitization, IP extraction" ;;
    ua.js) desc="User-agent parser — extracts browser name from request headers" ;;
    stream.js) desc="Live stream management — auto-archive, archive rotation, purge, public/admin views" ;;
    storage.js) desc="Vercel KV (Redis) access layer — key names, list caps, get/set helpers" ;;
    seed.js) desc="Seed data — default events, media episodes, stream config, newsletter HTML template" ;;
    newsletter.js) desc="Newsletter builder — event list HTML, date ranges, template interpolation" ;;
    geo.js) desc="IP geolocation — ip-api.com lookup with timeout and fallback" ;;
    email.js) desc="Resend email sender wrapper" ;;
    download.js) desc="E-book delivery — presigned URLs or static fallback" ;;
    audit.js) desc="Append-only audit trail" ;;
    ai.js) desc="AI utilities" ;;
    visit.js) desc="Visitor logging endpoint — captures IP, geolocation, browser, device on every page load" ;;
    stream.js) desc="Live stream API — get/update stream status, manage schedule, archive management" ;;
    podcast-rss.js) desc="Podcast RSS feed generator — builds valid RSS 2.0 with iTunes namespace" ;;
    newsletter.js) desc="Newsletter signup endpoint — captures name, email, geolocation, device fingerprint" ;;
    media.js) desc="Media CRUD API — podcast, vlog, and Coffee Talk episode management" ;;
    guestbook.js) desc="Guestbook CRUD — list, add, download (admin), clear (admin)" ;;
    events.js) desc="Calendar CRUD API — list (public), add/update/delete (admin key auth)" ;;
    cron-newsletter.js) desc="Vercel Cron newsletter sender — builds and emails newsletter via Resend" ;;
    admin.js) desc="Admin API — stats, subscriber list, visitor log, newsletter HTML builder, stream management" ;;
    contact.js) desc="Contact form endpoint — sends message via Resend" ;;
    community.js) desc="Community API — gallery, testimonials, comments" ;;
    ebook.js) desc="E-book download endpoint — tokenized one-time links" ;;
    unsubscribe.js) desc="Newsletter unsubscribe endpoint — tokenized opt-out" ;;
    support.js) desc="Support/donations endpoint" ;;
    docs-auth.js) desc="Document library authentication" ;;
    public-nav.js) desc="Shared navigation — dropdown menus, mobile hamburger, nav state" ;;
    marked.esm.js) desc="Third-party Markdown parser (marked.js)" ;;
    grant-intel.js) desc="Grant Intelligence Engine — discover, match, prepare, submit" ;;
    event-model.js) desc="Event model — validation, normalization, calendar sync" ;;
    episodes.js) desc="Scheduled broadcast validation and calendar event syncing" ;;
    compliance-engine.js) desc="Compliance engine — gate evaluation, state transitions" ;;
    document-registry.js) desc="Document registry — canonical document metadata" ;;
    document-references.js) desc="Document reference resolution and transclusion" ;;
    generation.js) desc="Content generation utilities" ;;
    icalendar.js) desc="iCalendar event generation" ;;
    newsletter-signup.js) desc="Newsletter signup utilities" ;;
    notify.js) desc="Notification utilities" ;;
    social-media.js) desc="Social media integration" ;;
    story-model.js) desc="Story/testimonial model" ;;
    visitor-stats.js) desc="Visitor statistics aggregation" ;;
    welcome.js) desc="Welcome email builder" ;;
    onboarding-references.generated.js) desc="Generated onboarding reference data" ;;
    document-manifest.generated.js) desc="Generated document manifest from Autobiography source" ;;
    compliance-workflows.generated.js) desc="Generated compliance workflow definitions" ;;
    catalog.js) desc="ACE catalog — workflow definitions and categories" ;;
    engine.js) desc="ACE engine — workflow execution, gate enforcement, record management" ;;
    legacy.js) desc="ACE legacy compatibility layer" ;;
    templates.js) desc="ACE workflow templates and field definitions" ;;
    screening.js) desc="Grant screening — eligibility checks and scoring" ;;
    provider.js) desc="Grant data provider interface" ;;
    normalize.js) desc="Grant data normalization" ;;
    intelligence.js) desc="Grant intelligence — search, filter, match" ;;
    grants-gov.js) desc="Grants.gov API integration" ;;
    dedup.js) desc="Grant deduplication" ;;
    *.workflow.js) desc="ACE workflow definition" ;;
    *) desc="Source file" ;;
  esac
  
  # For workflow files, get a better description
  if [[ "$file" == *".workflow.js" ]]; then
    local basename=$(basename "$file" .workflow.js)
    desc="ACE workflow definition — ${basename}"
  fi
  
  local header="/**\n * @file        ${filename}\n * @description ${desc}\n * @project     Lost Limb Riders (lostlimbriders.org)\n * @author      C. Hirschauer\n * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.\n * @license     Proprietary. No unauthorized reproduction or distribution.\n */\n"
  
  echo -e "${header}$(cat "$file")" > "$file"
}

add_html_header() {
  local file="$1"
  local filename=$(basename "$file")
  local first_line=$(head -1 "$file")
  
  # Skip if already has copyright header
  if echo "$first_line" | grep -q "Copyright"; then
    return
  fi
  
  local desc=""
  case "$filename" in
    index.html) desc="Homepage — hero carousel, guestbook, newsletter signup, contact form" ;;
    media.html) desc="Podcast player, YouTube vlogs, Coffee Talk episodes, live stream, subscribe links" ;;
    mission.html) desc="Mission statement, board of directors, programs overview, donate" ;;
    events.html) desc="Interactive calendar — month/week views, CRUD events, category filters, admin mode" ;;
    admin.html) desc="Admin dashboard — stats, subscriber profiles, visitor log, newsletter compose/preview" ;;
    community.html) desc="Community hub — photo gallery, testimonials, comments" ;;
    shop.html) desc="Merchandise shop — apparel, gear, and accessories" ;;
    sponsors.html) desc="Sponsor wall — Title, Major, Supporting tiers" ;;
    newsletter.html) desc="Newsletter signup page" ;;
    join.html) desc="Membership signup page" ;;
    donate.html) desc="Donation page" ;;
    grants.html) desc="Grant Intelligence dashboard" ;;
    compliance.html) desc="Compliance engine — workflow definitions, transaction management" ;;
    documentation.html) desc="Document library — canonical document browser" ;;
    documentation-viewer.html) desc="Document viewer — Markdown rendering with reference transclusion" ;;
    peer-support.html) desc="Peer support program page" ;;
    healthcare-partnerships.html) desc="Hospital and prosthetic outreach partnerships" ;;
    volunteer-employment.html) desc="Volunteer and employment pathways" ;;
    *) desc="Page" ;;
  esac
  
  local header="<!--\n  @file        ${filename}\n  @description ${desc}\n  @project     Lost Limb Riders (lostlimbriders.org)\n  @author      C. Hirschauer\n  @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.\n  @license     Proprietary. No unauthorized reproduction or distribution.\n-->\n"
  
  echo -e "${header}$(cat "$file")" > "$file"
}

# Process all JS files
find "$WORKSPACE" -name "*.js" -not -path "*/node_modules/*" -not -path "*/.git/*" | while read -r file; do
  add_js_header "$file"
  echo "JS: $file"
done

# Process all HTML files
find "$WORKSPACE" -name "*.html" -not -path "*/node_modules/*" -not -path "*/.git/*" | while read -r file; do
  add_html_header "$file"
  echo "HTML: $file"
done

echo "DONE"
