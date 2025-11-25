# GraphQL Endpoint Debugging Guide

## ✅ Current Status

The GraphQL endpoint is **working correctly** when tested directly:
- ✅ Backend is running on port 4000
- ✅ GraphQL endpoint responds at `http://localhost:4000/graphql`
- ✅ CORS is configured correctly
- ✅ Test query returns data successfully

## Quick Tests

### Test 1: Basic GraphQL Query
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { receipts { id storeName totalAmount } }"}'
```

**Expected Response:**
```json
{"data":{"receipts":[{"id":"...","storeName":"...","totalAmount":...}]}}
```

### Test 2: Test with CORS Headers
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"query":"query { receipts { id } }"}'
```

**Expected:** Should return data with CORS headers

### Test 3: Test GraphQL Introspection
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}'
```

## Common Issues & Solutions

### Issue 1: "Failed to fetch" or Network Error

**Symptoms:**
- Browser console shows network error
- GraphQL queries fail with network error

**Solutions:**
1. **Check if backend is running:**
   ```bash
   docker compose ps backend
   docker compose logs backend --tail 20
   ```

2. **Verify GraphQL URL in frontend:**
   - Check browser console for the actual URL being called
   - Ensure `NEXT_PUBLIC_GRAPHQL_URL` is set correctly
   - Should be `http://localhost:4000/graphql` (not `http://backend:4000/graphql`)

3. **Check CORS configuration:**
   - Backend CORS should allow `http://localhost:3000`
   - Check `FRONTEND_URL` environment variable in backend

4. **Verify port accessibility:**
   ```bash
   curl http://localhost:4000/graphql
   # Should return GraphQL error (not connection refused)
   ```

### Issue 2: 400 Bad Request

**Symptoms:**
- GraphQL returns 400 status
- Error message about invalid query

**Solutions:**
1. **Check query syntax:**
   - Verify all requested fields exist in schema
   - Check for typos in field names

2. **Check GraphQL schema:**
   ```bash
   # Test introspection
   curl -X POST http://localhost:4000/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ __type(name: \"Receipt\") { fields { name } } }"}'
   ```

3. **Verify resolver implementation:**
   - Check backend logs for resolver errors
   - Ensure all resolvers return correct data types

### Issue 3: CORS Errors

**Symptoms:**
- Browser console shows CORS error
- "Access-Control-Allow-Origin" errors

**Solutions:**
1. **Check CORS configuration in backend:**
   ```typescript
   app.use(cors({
     origin: process.env.FRONTEND_URL || 'http://localhost:3000',
     credentials: true,
   }));
   ```

2. **Verify FRONTEND_URL environment variable:**
   ```bash
   docker compose exec backend printenv | grep FRONTEND_URL
   ```

3. **Check browser console for actual origin:**
   - The origin must match exactly what's in CORS config

### Issue 4: Apollo Client Not Connecting

**Symptoms:**
- No errors but queries don't execute
- Apollo Client shows loading state indefinitely

**Solutions:**
1. **Check Apollo Client configuration:**
   ```typescript
   const httpLink = createHttpLink({
     uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
     credentials: 'include',
   });
   ```

2. **Verify environment variable is set:**
   ```bash
   docker compose exec frontend printenv | grep GRAPHQL
   ```

3. **Check browser Network tab:**
   - Look for GraphQL requests
   - Check request URL, headers, and response

4. **Enable Apollo Client error logging:**
   - Error link is now added to log all errors

## Debugging Steps

### Step 1: Verify Backend is Running
```bash
docker compose ps backend
# Should show "Up" status

docker compose logs backend --tail 20
# Should show "Server ready at http://localhost:4000/graphql"
```

### Step 2: Test GraphQL Endpoint Directly
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { receipts { id } }"}'
```

### Step 3: Check Frontend Environment Variables
```bash
docker compose exec frontend printenv | grep NEXT_PUBLIC
```

### Step 4: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for GraphQL errors
4. Go to Network tab
5. Filter by "graphql"
6. Check request/response details

### Step 5: Check Apollo Client Errors
The Apollo Client now has error logging enabled. Check browser console for:
- `[GraphQL error]:` - Query/field errors
- `[Network error]:` - Network/connection errors

## Environment Variables

### Backend (.env or docker-compose.yml)
```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/shewaber_ocr?schema=public
REDIS_URL=redis://redis:6379
FRONTEND_URL=http://localhost:3000
PORT=4000
UPLOAD_DIR=/app/uploads
```

### Frontend (docker-compose.yml)
```env
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
NEXT_PUBLIC_API_URL=http://localhost:4000
```

**Important:** `NEXT_PUBLIC_*` variables must be set at **build time** for Next.js.

## Testing Queries

### Get All Receipts
```graphql
query {
  receipts {
    id
    storeName
    purchaseDate
    totalAmount
    items {
      id
      name
      quantity
      price
    }
  }
}
```

### Get Single Receipt
```graphql
query {
  receipt(id: "receipt-id-here") {
    id
    storeName
    totalAmount
    items {
      name
      price
    }
  }
}
```

### Update Receipt
```graphql
mutation {
  updateReceipt(
    id: "receipt-id"
    input: {
      storeName: "New Store"
      totalAmount: 100.00
    }
    items: [
      { name: "Item 1", quantity: 2, price: 10.50 }
    ]
  ) {
    id
    storeName
    totalAmount
  }
}
```

## Restart Services

If issues persist, restart services:
```bash
# Restart backend
docker compose restart backend

# Restart frontend
docker compose restart frontend

# Or restart all
docker compose restart
```

## Check Logs

```bash
# Backend logs
docker compose logs backend --tail 50 -f

# Frontend logs
docker compose logs frontend --tail 50 -f

# All logs
docker compose logs --tail 50 -f
```

## Next Steps

If GraphQL is still not working:

1. ✅ Check browser console for specific error messages
2. ✅ Check Network tab for failed requests
3. ✅ Verify environment variables are set correctly
4. ✅ Test GraphQL endpoint directly with curl
5. ✅ Check backend logs for errors
6. ✅ Verify CORS configuration
7. ✅ Ensure Apollo Client is properly configured

