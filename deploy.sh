#!/bin/bash
# Netlify Deploy via Build Hook

echo "🚀 Triggering Netlify deployment..."

# Build Hook URL (from environment or fallback to default)
NETLIFY_BUILD_HOOK="${NETLIFY_BUILD_HOOK_URL:-https://api.netlify.com/build_hooks/68c029e04a4a99209a1825e8}"

# Trigger build
RESPONSE=$(curl -X POST -d '{}' "$NETLIFY_BUILD_HOOK" 2>&1)

if [ $? -eq 0 ]; then
    echo "✅ Deployment triggered!"
    echo "📊 Check status: https://app.netlify.com/sites/museumgh/deploys"
else
    echo "❌ Failed to trigger deployment"
    echo "$RESPONSE"
    exit 1
fi
