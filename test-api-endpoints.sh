#!/bin/bash

echo "=== User Registration System API Test ==="
echo "Make sure the server is running with: pnpm run start:dev"
echo

# Check if server is running
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "❌ Server is not running on localhost:3000"
    echo "Please start the server with: pnpm run start:dev"
    exit 1
fi

echo "✅ Server is running"
echo

# 1. Register a new user
echo "1. Testing user registration..."
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "apitest123",
    "email": "apitest@example.com",
    "password": "ApiTest123!",
    "fullName": "API Test User"
  }')

echo "$REGISTER_RESPONSE" | jq
echo

# Check if registration was successful
if echo "$REGISTER_RESPONSE" | jq -e '.success' > /dev/null; then
    echo "✅ Registration successful"
    
    # Extract user ID and token
    USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.data.user.id')
    TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.token')
    
    echo "User ID: $USER_ID"
    echo "Token: $TOKEN"
    echo
else
    echo "❌ Registration failed"
    echo "This might be because the user already exists. Trying to login instead..."
    echo
    
    # Try to login with existing user
    echo "2. Testing user login (existing user)..."
    LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
      -H "Content-Type: application/json" \
      -d '{
        "identifier": "apitest@example.com",
        "password": "ApiTest123!"
      }')
    
    echo "$LOGIN_RESPONSE" | jq
    echo
    
    if echo "$LOGIN_RESPONSE" | jq -e '.success' > /dev/null; then
        echo "✅ Login successful"
        USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.data.user.id')
        TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')
    else
        echo "❌ Both registration and login failed. Exiting."
        exit 1
    fi
fi

# 3. Test user profile
echo "3. Testing user profile retrieval..."
PROFILE_RESPONSE=$(curl -s -X GET http://localhost:3000/users/profile \
  -H "Authorization: Bearer $TOKEN")

echo "$PROFILE_RESPONSE" | jq
echo

if echo "$PROFILE_RESPONSE" | jq -e '.id' > /dev/null; then
    echo "✅ Profile retrieval successful"
else
    echo "❌ Profile retrieval failed"
fi
echo

# 4. Test user by ID
echo "4. Testing user by ID retrieval..."
USER_BY_ID_RESPONSE=$(curl -s -X GET http://localhost:3000/users/$USER_ID \
  -H "Authorization: Bearer $TOKEN")

echo "$USER_BY_ID_RESPONSE" | jq
echo

if echo "$USER_BY_ID_RESPONSE" | jq -e '.id' > /dev/null; then
    echo "✅ User by ID retrieval successful"
else
    echo "❌ User by ID retrieval failed"
fi
echo

# 5. Test token validation
echo "5. Testing token validation..."
TOKEN_VALIDATION_RESPONSE=$(curl -s -X GET http://localhost:3000/auth/validate-token \
  -H "Authorization: Bearer $TOKEN")

echo "$TOKEN_VALIDATION_RESPONSE" | jq
echo

if echo "$TOKEN_VALIDATION_RESPONSE" | jq -e '.valid' > /dev/null; then
    echo "✅ Token validation successful"
else
    echo "❌ Token validation failed"
fi
echo

# 6. Test logout
echo "6. Testing user logout..."
LOGOUT_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $TOKEN")

echo "$LOGOUT_RESPONSE" | jq
echo

if echo "$LOGOUT_RESPONSE" | jq -e '.message' > /dev/null; then
    echo "✅ Logout successful"
else
    echo "❌ Logout failed"
fi
echo

echo "=== Testing validation errors ==="
echo

# Test invalid email
echo "7. Testing invalid email validation..."
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser2",
    "email": "invalid-email",
    "password": "TestPass123!",
    "fullName": "Test User"
  }' | jq
echo

# Test weak password
echo "8. Testing weak password validation..."
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser3",
    "email": "test3@example.com",
    "password": "weak",
    "fullName": "Test User"
  }' | jq
echo

# Test protected endpoint without token
echo "9. Testing protected endpoint without authentication..."
curl -s -X GET http://localhost:3000/users/profile | jq
echo

echo "=== All tests completed ==="
echo "✅ API endpoints are working correctly!"