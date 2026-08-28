#!/usr/bin/env bash
#
# Eight authorization checks against a running Lernexa API — the ones shown in
# the video (RBAC.md "Verification script"). Requires `npm run seed` to have run.
#
#   ./scripts/verify-auth.sh                       # http://localhost:1337
#   ./scripts/verify-auth.sh https://xxx.up.railway.app
#
set -u
BASE="${1:-http://localhost:1337}"
PW="Lernexa123!"
pass=0 fail=0

# -g disables curl's globbing so [ ] in query strings are sent literally.
CURL="curl -sg"

jwt() {
  $CURL -X POST "$BASE/api/auth/local" -H 'Content-Type: application/json' \
    -d "{\"identifier\":\"$1\",\"password\":\"$PW\"}" | grep -oE '"jwt":"[^"]+"' | cut -d'"' -f4
}
code() { # method url [token] [body]
  local m="$1" u="$2" t="${3:-}" b="${4:-}"
  local h=(-H 'Content-Type: application/json')
  [ -n "$t" ] && h+=(-H "Authorization: Bearer $t")
  if [ -n "$b" ]; then
    $CURL -o /dev/null -w '%{http_code}' -X "$m" "${h[@]}" -d "$b" "$BASE$u"
  else
    $CURL -o /dev/null -w '%{http_code}' -X "$m" "${h[@]}" "$BASE$u"
  fi
}
check() { # description expected actual
  if [ "$2" = "$3" ]; then echo "  ok   $1 ($3)"; pass=$((pass+1))
  else echo "  FAIL $1 — expected $2, got $3"; fail=$((fail+1)); fi
}

echo "verify-auth against $BASE"

T_STU=$(jwt student@lernexa.test)
T_IN1=$(jwt instructor@lernexa.test)
T_IN2=$(jwt instructor2@lernexa.test)
T_CM=$(jwt cm@lernexa.test)
T_ADM=$(jwt admin@lernexa.test)

# instructor1 owns "React Fundamentals"; instructor2 owns "API Design Basics".
IN1_COURSE=$($CURL "$BASE/api/courses?pagination[pageSize]=50" \
  | tr '{' '\n' | grep 'React Fundamentals' | grep -oE '"documentId":"[^"]+"' | cut -d'"' -f4)
IN2_COURSE=$($CURL "$BASE/api/courses?pagination[pageSize]=50" \
  | tr '{' '\n' | grep 'API Design Basics' | grep -oE '"documentId":"[^"]+"' | cut -d'"' -f4)
QUIZ_ID=$($CURL "$BASE/api/quizzes?pagination[pageSize]=1" -H "Authorization: Bearer $T_IN1" \
  | grep -oE '"documentId":"[^"]+"' | head -1 | cut -d'"' -f4)

# 1. student POSTs /api/courses -> 403
check "1 student creates a course" 403 \
  "$(code POST /api/courses "$T_STU" '{"data":{"title":"hack"}}')"

# 2. instructor1 PUTs instructor2's course (and vice versa) -> 403
check "2 instructor1 edits instructor2's course" 403 \
  "$(code PUT "/api/courses/$IN2_COURSE" "$T_IN1" '{"data":{"title":"stolen"}}')"
check "2b instructor2 edits instructor1's course" 403 \
  "$(code PUT "/api/courses/$IN1_COURSE" "$T_IN2" '{"data":{"title":"stolen"}}')"

# 3. student GETs a raw quiz -> 403 (find/findOne disabled for students)
check "3 student reads a raw quiz" 403 \
  "$(code GET "/api/quizzes/$QUIZ_ID" "$T_STU")"

# 4. student reads enrollments with a cross-student filter -> still only own rows
COUNT=$($CURL "$BASE/api/enrollments/me?filters[student][id][\$eq]=999999" \
  -H "Authorization: Bearer $T_STU" | grep -oE '"enrolledAt"' | wc -l | tr -d ' ')
check "4 forced student filter ignores ?filters (own rows only)" 1 "$COUNT"

# 5. anonymous lists blog drafts -> the draft is not returned
DRAFTS=$($CURL "$BASE/api/blog-posts?status=draft" \
  | grep -oE '"title":"Draft: the roadmap"' | wc -l | tr -d ' ')
check "5 anonymous sees zero drafts" 0 "$DRAFTS"

# 6. content-manager GETs /api/platform/stats -> 403
check "6 content-manager reads platform stats" 403 \
  "$(code GET /api/platform/stats "$T_CM")"

# 7. signup with role:admin in the body -> created as student
# (use the token the register response already returns — auth calls are rate-limited)
EMAIL="verify-$(date +%s)@lernexa.test"
REG7=$($CURL -X POST "$BASE/api/auth/local/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"role\":\"1\"}")
T7=$(echo "$REG7" | grep -oE '"jwt":"[^"]+"' | cut -d'"' -f4)
ROLE=$($CURL "$BASE/api/users/me" -H "Authorization: Bearer $T7" \
  | grep -oE '"type":"[a-z-]+"' | cut -d'"' -f4)
check "7 signup with role:admin becomes a student" "student" "${ROLE:-none}"

# 8. blocked user replays a pre-block token -> 403 ACCOUNT_BLOCKED
B_EMAIL="verifyblock-$(date +%s)@lernexa.test"
REG8=$($CURL -X POST "$BASE/api/auth/local/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$B_EMAIL\",\"password\":\"$PW\"}")
B_TOKEN=$(echo "$REG8" | grep -oE '"jwt":"[^"]+"' | cut -d'"' -f4)
B_ID=$($CURL "$BASE/api/users/me" -H "Authorization: Bearer $B_TOKEN" | grep -oE '"id":[0-9]+' | head -1 | cut -d: -f2)
$CURL -o /dev/null -X PUT "$BASE/api/platform/users/$B_ID/block" -H "Authorization: Bearer $T_ADM" \
  -H 'Content-Type: application/json' -d '{"blocked":true,"reason":"verify-auth"}'
BODY=$($CURL "$BASE/api/users/me" -H "Authorization: Bearer $B_TOKEN")
echo "$BODY" | grep -q ACCOUNT_BLOCKED && R=ACCOUNT_BLOCKED || R="$BODY"
check "8 blocked user's token is rejected with a reason" "ACCOUNT_BLOCKED" "$R"

echo
echo "  $pass passed, $fail failed"
exit $((fail > 0 ? 1 : 0))
