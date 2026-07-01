#!/usr/bin/env bash
# Test du déclencheur webhook Parcours
# Usage : ./scripts/test-webhook.sh [API_URL]
# Prérequis : API démarrée avec ALLOW_EMAIL_BYPASS=true

set -e

API="${1:-http://localhost:4000}"
EMAIL="webhook-test@pivot.local"
PASSWORD="Pivot1234!"
NAME="Webhook Tester"

echo ""
echo "=== Test webhook Parcours ==="
echo "API : $API"
echo ""

# ── 1. Register (idempotent — ignore si déjà existant) ─────────────────────────
echo "1. Création du compte test…"
REGISTER=$(curl -sf -X POST "$API/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"$NAME\"}" 2>/dev/null || true)

# ── 2. Login ───────────────────────────────────────────────────────────────────
echo "2. Login…"
LOGIN=$(curl -sf -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "   → token obtenu"

# ── 3. Créer un template avec triggerType=webhook ──────────────────────────────
echo "3. Création du template webhook…"
TEMPLATE=$(curl -sf -X POST "$API/api/parcours/templates" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Webhook — Achat auto",
    "description": "Template déclenché par webhook externe",
    "triggerType": "webhook",
    "triggerConfig": { "webhookTitle": "Demande reçue via webhook" },
    "steps": [
      { "type": "info", "title": "Réception demande" },
      {
        "type": "validation",
        "title": "Validation",
        "assignmentMode": "user",
        "assignedTo": null
      }
    ],
    "flowEdges": []
  }')
TEMPLATE_ID=$(echo "$TEMPLATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "   → template créé : $TEMPLATE_ID"

# ── 4. Générer le token webhook ────────────────────────────────────────────────
echo "4. Génération du token webhook…"
WEBHOOK=$(curl -sf -X POST "$API/api/parcours/templates/$TEMPLATE_ID/webhook/generate" \
  -H "Authorization: Bearer $TOKEN")
WEBHOOK_TOKEN=$(echo "$WEBHOOK" | python3 -c "import sys,json; print(json.load(sys.stdin)['webhookToken'])")
WEBHOOK_URL="$API/api/parcours/webhooks/$WEBHOOK_TOKEN"
echo "   → URL webhook : $WEBHOOK_URL"

# ── 5. Déclencher le webhook — cas achat < 40 000 € ───────────────────────────
echo "5. Déclenchement webhook (montant: 15000)…"
RESULT1=$(curl -sf -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Achat matériel réseau — Q3",
    "data": { "montant": 15000, "fournisseur": "Dell", "demandeur": "Alice" }
  }')
INSTANCE1=$(echo "$RESULT1" | python3 -c "import sys,json; print(json.load(sys.stdin)['instanceId'])")
echo "   → instance créée : $INSTANCE1"

# ── 6. Déclencher le webhook — cas achat > 40 000 € ───────────────────────────
echo "6. Déclenchement webhook (montant: 75000)…"
RESULT2=$(curl -sf -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Acquisition serveurs datacenter",
    "data": { "montant": 75000, "fournisseur": "HP", "demandeur": "Bob" }
  }')
INSTANCE2=$(echo "$RESULT2" | python3 -c "import sys,json; print(json.load(sys.stdin)['instanceId'])")
echo "   → instance créée : $INSTANCE2"

# ── 7. Déclencher sans body (titre par défaut) ─────────────────────────────────
echo "7. Déclenchement webhook sans body…"
RESULT3=$(curl -sf -X POST "$WEBHOOK_URL")
INSTANCE3=$(echo "$RESULT3" | python3 -c "import sys,json; print(json.load(sys.stdin)['instanceId'])")
echo "   → instance créée : $INSTANCE3"

# ── 8. Vérifier les instances créées ──────────────────────────────────────────
echo "8. Vérification des instances créées…"
INSTANCES=$(curl -sf "$API/api/parcours/instances" \
  -H "Authorization: Bearer $TOKEN")
COUNT=$(echo "$INSTANCES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "   → $COUNT instance(s) au total pour ce compte"

# ── 9. Test token invalide → 404 ──────────────────────────────────────────────
echo "9. Token invalide → doit retourner 404…"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/parcours/webhooks/TOKEN_INVALIDE")
if [ "$STATUS" = "404" ]; then
  echo "   → 404 ✓"
else
  echo "   → attendu 404, obtenu $STATUS ✗"
fi

# ── 10. Désactiver le webhook ──────────────────────────────────────────────────
echo "10. Suppression du token webhook…"
curl -sf -X DELETE "$API/api/parcours/templates/$TEMPLATE_ID/webhook" \
  -H "Authorization: Bearer $TOKEN" -o /dev/null
echo "    → token supprimé"

# ── 11. Token supprimé → 404 ──────────────────────────────────────────────────
echo "11. Webhook désactivé → doit retourner 404…"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_URL")
if [ "$STATUS" = "404" ]; then
  echo "    → 404 ✓"
else
  echo "    → attendu 404, obtenu $STATUS ✗"
fi

echo ""
echo "=== Terminé — 3 instances créées, token désactivé ==="
echo ""
echo "Pour voir les instances dans l'UI : http://localhost:3000/parcours"
echo "Template ID : $TEMPLATE_ID"
