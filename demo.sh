#!/usr/bin/env bash
set -e
BASE_URL="http://localhost:3000/api"

echo "=== 1. Register new user ==="
curl -s -X POST "$BASE_URL/register" -H "Content-Type: application/json" -d '{"username":"demoUser","email":"demo@example.com","password":"demoPass","role":"employee"}'

echo "\n=== 2. Login (password) ==="
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/login" -H "Content-Type: application/json" -d '{"username":"demoUser","password":"demoPass"}')
TOKEN=$(echo $LOGIN_RESP | python -c "import sys, json; print(json.load(sys.stdin)['user']['token'])")
OTP=$(echo $LOGIN_RESP | python -c "import sys, json; print(json.load(sys.stdin)['otp'])")
echo "Token: $TOKEN"
echo "OTP (displayed for demo): $OTP"

# In a real flow you would verify OTP, but the server already logs it.

echo "\n=== 3. Get documents (should be empty) ==="
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/documents" | python -m json.tool

echo "\n=== 4. Upload a document ==="
DOC_RESP=$(curl -s -X POST "$BASE_URL/documents" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"Demo Document","encryptedContent":"SGVsbG8gd29ybGQ=","encryptionKey":"key123","signature":"sig","category":"general","classification":"public"}')
DOC_ID=$(echo $DOC_RESP | python -c "import sys, json; print(json.load(sys.stdin)['document']['id'])")

echo "Uploaded document ID: $DOC_ID"

echo "\n=== 5. Get documents again (should list the new doc) ==="
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/documents" | python -m json.tool

# Clean up (optional)
# echo "=== 6. Delete the document ==="
# curl -s -X DELETE "$BASE_URL/documents/$DOC_ID" -H "Authorization: Bearer $TOKEN"

echo "Demo completed."
