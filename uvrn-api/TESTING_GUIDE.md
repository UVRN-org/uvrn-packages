# Delta Engine API - Testing Guide

## Quick Start

### 1. Start the Development Server

```bash
cd packages/uvrn-api
npm run dev
```

**What to look for:**
- ✅ Server starts without errors
- ✅ You see log messages like:
  ```
  🚀 Delta Engine API server running at http://0.0.0.0:3000
  📊 Health check: http://0.0.0.0:3000/api/v1/health
  📦 Environment: development
  🔒 Rate limit: 100 requests per 1 minute
  ```

### 2. Run Automated Tests

From the repository root:

```bash
./test-api.sh
```

This will test all 5 endpoints plus error scenarios.

---

## Manual Testing

### Test 1: Health Check ✅

**Purpose:** Verify the server is running and the engine is available

```bash
curl http://localhost:3000/api/v1/health
```

**Expected Response (200 OK):**
```json
{
  "status": "healthy",
  "uptime": 12345,
  "version": "1.0.0",
  "engine": {
    "available": true
  },
  "timestamp": "2026-01-15T14:55:00.000Z"
}
```

**What to look for:**
- ✅ `status: "healthy"`
- ✅ `engine.available: true`
- ✅ HTTP status code `200`

---

### Test 2: Version Information ✅

**Purpose:** Check API, engine, and protocol versions

```bash
curl http://localhost:3000/api/v1/version
```

**Expected Response (200 OK):**
```json
{
  "apiVersion": "1.0.0",
  "engineVersion": "1.0.0",
  "protocolVersion": "1.0"
}
```

**What to look for:**
- ✅ All version fields present
- ✅ HTTP status code `200`

---

### Test 3: Validate Bundle Schema ✅

**Purpose:** Validate a bundle without executing it

```bash
curl -X POST http://localhost:3000/api/v1/delta/validate \
  -H "Content-Type: application/json" \
  -d '{
    "bundleId": "test-bundle-001",
    "claim": "Revenue reconciliation test",
    "dataSpecs": [
      {
        "id": "spec-1",
        "label": "Q4 Revenue Report",
        "sourceKind": "report",
        "originDocIds": ["doc-123"],
        "metrics": [
          {"key": "revenue", "value": 100000, "unit": "USD"}
        ]
      }
    ],
    "thresholdPct": 0.1
  }'
```

**Expected Response (200 OK):**
```json
{
  "valid": true
}
```

**What to look for:**
- ✅ `valid: true` for correct bundles
- ✅ HTTP status code `200`

---

### Test 4: Run Engine on Bundle 🚀

**Purpose:** Execute the delta engine and get a receipt

```bash
curl -X POST http://localhost:3000/api/v1/delta/run \
  -H "Content-Type: application/json" \
  -d '{
    "bundleId": "revenue-q4-2025",
    "claim": "Q4 2025 revenue: $500K",
    "dataSpecs": [
      {
        "id": "spec-1",
        "label": "Accounting System",
        "sourceKind": "report",
        "originDocIds": ["acc-report-q4"],
        "metrics": [
          {"key": "revenue", "value": 500000, "unit": "USD"}
        ]
      },
      {
        "id": "spec-2",
        "label": "Sales Database",
        "sourceKind": "report",
        "originDocIds": ["sales-db-q4"],
        "metrics": [
          {"key": "revenue", "value": 502000, "unit": "USD"}
        ]
      }
    ],
    "thresholdPct": 0.05
  }'
```

**Expected Response (200 OK):**
```json
{
  "bundleId": "revenue-q4-2025",
  "deltaFinal": 0.004,
  "sources": ["Accounting System", "Sales Database"],
  "rounds": [
    {
      "round": 1,
      "deltasByMetric": {"revenue": 0.004},
      "withinThreshold": true,
      "witnessRequired": false
    }
  ],
  "suggestedFixes": [],
  "outcome": "consensus",
  "hash": "abc123..."
}
```

**What to look for:**
- ✅ Receipt contains all fields: `bundleId`, `deltaFinal`, `sources`, `rounds`, `outcome`, `hash`
- ✅ `outcome` is either `"consensus"` or `"indeterminate"`
- ✅ `hash` is a SHA-256 hash string
- ✅ HTTP status code `200`

---

### Test 5: Verify Receipt 🔐

**Purpose:** Verify receipt integrity by recomputing the hash

```bash
curl -X POST http://localhost:3000/api/v1/delta/verify \
  -H "Content-Type: application/json" \
  -d '{
    "bundleId": "test-001",
    "deltaFinal": 0.02,
    "sources": ["Source A", "Source B"],
    "rounds": [
      {
        "round": 1,
        "deltasByMetric": {"metric1": 0.02},
        "withinThreshold": true,
        "witnessRequired": false
      }
    ],
    "suggestedFixes": [],
    "outcome": "consensus",
    "hash": "abc123def456..."
  }'
```

**Expected Response (200 OK):**
```json
{
  "verified": true,
  "recomputedHash": "abc123def456..."
}
```

**What to look for:**
- ✅ `verified: true` if hash matches
- ✅ `verified: false` if hash doesn't match
- ✅ `recomputedHash` is provided
- ✅ HTTP status code `200`

---

## Error Scenario Testing

### Test 6: Invalid Bundle Schema ❌

```bash
curl -X POST http://localhost:3000/api/v1/delta/validate \
  -H "Content-Type: application/json" \
  -d '{
    "bundleId": "incomplete",
    "claim": "Missing dataSpecs field"
  }'
```

**Expected Response (200 OK with validation errors):**
```json
{
  "valid": false,
  "errors": [
    {
      "field": "bundle",
      "message": "Missing required field: dataSpecs"
    }
  ]
}
```

**What to look for:**
- ✅ `valid: false`
- ✅ `errors` array with details
- ✅ HTTP status code `200` (validation succeeded, bundle failed)

---

### Test 7: Wrong Content-Type ❌

```bash
curl -X POST http://localhost:3000/api/v1/delta/run \
  -H "Content-Type: text/plain" \
  -d 'not json'
```

**Expected Response (415 Unsupported Media Type):**
```json
{
  "error": {
    "code": "UNSUPPORTED_MEDIA_TYPE",
    "message": "Content-Type must be application/json",
    "details": {
      "receivedContentType": "text/plain"
    }
  }
}
```

**What to look for:**
- ✅ HTTP status code `415`
- ✅ Error message explains the issue

---

### Test 8: Malformed JSON ❌

```bash
curl -X POST http://localhost:3000/api/v1/delta/run \
  -H "Content-Type: application/json" \
  -d '{invalid json'
```

**Expected Response (400 Bad Request):**
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid JSON",
    "details": {...}
  }
}
```

**What to look for:**
- ✅ HTTP status code `400`
- ✅ Clear error message

---

### Test 9: Rate Limiting 🚦

```bash
# Run this in a loop to exceed rate limit
for i in {1..105}; do
  curl -s http://localhost:3000/api/v1/health > /dev/null
done
curl http://localhost:3000/api/v1/health
```

**Expected Response (429 Too Many Requests):**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later",
    "details": {
      "rateLimitMax": 100,
      "timeWindow": "1 minute"
    }
  }
}
```

**What to look for:**
- ✅ HTTP status code `429`
- ✅ Rate limit details in response

---

### Test 10: 404 Not Found ❌

```bash
curl http://localhost:3000/api/v1/nonexistent
```

**Expected Response (404 Not Found):**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route GET /api/v1/nonexistent not found",
    "details": {
      "method": "GET",
      "url": "/api/v1/nonexistent"
    }
  }
}
```

**What to look for:**
- ✅ HTTP status code `404`
- ✅ Clear error message with URL

---

## Testing with Real Bundles

You can test with existing demo bundles from the CLI:

```bash
# Find demo bundles
ls ../../examples/*.json

# Test with a real bundle
curl -X POST http://localhost:3000/api/v1/delta/run \
  -H "Content-Type: application/json" \
  -d @../../examples/revenue-bundle.json
```

---

## Server Logs

When running in development mode (`npm run dev`), you'll see detailed logs:

**Good logs to look for:**
```
[INFO] Incoming request - GET /api/v1/health
[INFO] Request completed - Status: 200, Time: 5ms
```

**Error logs:**
```
[ERROR] Engine execution failed - Invalid bundle structure
[WARN] Rate limit exceeded for IP 127.0.0.1
```

---

## Checklist: Server is Working ✅

After running all tests, verify:

- [ ] Health endpoint returns `healthy` status
- [ ] Version endpoint returns correct versions
- [ ] Validate endpoint accepts valid bundles
- [ ] Validate endpoint rejects invalid bundles
- [ ] Run endpoint executes engine and returns receipt
- [ ] Verify endpoint checks receipt integrity
- [ ] Rate limiting kicks in after 100 requests
- [ ] Wrong content-type returns 415 error
- [ ] Malformed JSON returns 400 error
- [ ] Non-existent routes return 404 error
- [ ] All responses have correct error structure
- [ ] Server logs requests and responses
- [ ] No crashes or unhandled exceptions

---

## Performance Testing

To test performance and concurrent requests:

```bash
# Install autocannon if not already installed
npm install -g autocannon

# Run load test (100 requests, 10 concurrent)
autocannon -c 10 -d 10 http://localhost:3000/api/v1/health
```

**What to look for:**
- ✅ Response times < 100ms for health endpoint
- ✅ No 5xx errors under load
- ✅ Rate limiting works correctly

---

## Troubleshooting

### Server won't start

1. Check if port 3000 is already in use:
   ```bash
   lsof -i :3000
   ```

2. Use a different port:
   ```bash
   PORT=3001 npm run dev
   ```

### Engine not available

If health check shows `engine.available: false`:

1. Ensure `@uvrn/core` is installed:
   ```bash
   npm list @uvrn/core
   ```

2. Build the engine package:
   ```bash
   cd ../uvrn-core && npm run build
   ```

### CORS errors (in browser)

If testing from a browser and seeing CORS errors:

1. Set allowed origins in `.env`:
   ```
   CORS_ORIGINS=http://localhost:3000,http://localhost:8080
   ```

2. Restart the server

---

## Next Steps

Once all tests pass:
1. ✅ Proceed to Task A.2.3 (OpenAPI Specification)
2. ✅ Add integration tests with Jest
3. ✅ Deploy to staging environment
4. ✅ Run load tests with realistic traffic

---

**Created:** 2026-01-15
**API Version:** 1.0.0
**Last Updated:** 2026-01-15
