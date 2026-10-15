#!/usr/bin/env bash
# Seeds the CineTrack catalogue with 20 demo movies through the public API.
# Usage:  bash scripts/seed-movies.sh
#         API_URL=http://localhost:3000 bash scripts/seed-movies.sh
#         FORCE=1 bash scripts/seed-movies.sh      # add even if >= 20 movies exist
set -euo pipefail

API="${API_URL:-https://api.hngayotomiwa.online}"
TARGET=20

count_movies() {
  curl -fsS "$API/api/movies" | python3 -c 'import sys, json; print(len(json.load(sys.stdin)))'
}

existing=$(count_movies)
if [ "$existing" -ge "$TARGET" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "Catalogue already has $existing movies - nothing to do (FORCE=1 to add anyway)."
  exit 0
fi

# POST /api/movies needs a JWT, so register a throwaway seed user.
EMAIL="seed-$(date +%s)@example.com"
PASSWORD="$(openssl rand -hex 16)"
resp=$(curl -sS -X POST "$API/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(printf '%s' "$resp" | python3 -c 'import sys, json; print(json.load(sys.stdin)["token"])' 2>/dev/null) || {
  echo "Could not register seed user. Response: $resp" >&2
  exit 1
}

# Title|Genre|Year. The LAST row inserted becomes the featured banner on the dashboard.
MOVIES=(
"The Matrix|Sci-Fi|1999"
"Interstellar|Sci-Fi|2014"
"Blade Runner 2049|Sci-Fi|2017"
"The Dark Knight|Action|2008"
"Mad Max: Fury Road|Action|2015"
"John Wick|Action|2014"
"Gladiator|Action|2000"
"The Shawshank Redemption|Drama|1994"
"Forrest Gump|Drama|1994"
"Whiplash|Drama|2014"
"The Godfather|Crime|1972"
"Pulp Fiction|Crime|1994"
"Goodfellas|Crime|1990"
"Spirited Away|Animation|2001"
"Spider-Man: Into the Spider-Verse|Animation|2018"
"Toy Story|Animation|1995"
"Parasite|Thriller|2019"
"The Silence of the Lambs|Thriller|1991"
"Get Out|Thriller|2017"
"Inception|Sci-Fi|2010"
)

for row in "${MOVIES[@]}"; do
  IFS='|' read -r title genre year <<< "$row"
  body=$(python3 -c 'import json, sys; print(json.dumps({"title": sys.argv[1], "genre": sys.argv[2], "release_year": int(sys.argv[3])}))' "$title" "$genre" "$year")
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/api/movies" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $TOKEN" \
    -d "$body")
  printf '%-45s %s\n' "$title" "$code"
done

echo "Catalogue now has $(count_movies) movies."
