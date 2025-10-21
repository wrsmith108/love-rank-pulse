#!/bin/bash

# Prisma Setup Verification Script
# Run this to verify Prisma is correctly configured

echo "🔍 Verifying Prisma Setup..."
echo "=================================="
echo ""

# Check if .env exists
echo "📋 1. Checking .env file..."
if [ -f ".env" ]; then
    echo "   ✅ .env file exists"
    if grep -q "DATABASE_URL" .env; then
        echo "   ✅ DATABASE_URL is configured"
    else
        echo "   ❌ DATABASE_URL not found in .env"
        echo "   📝 Add: DATABASE_URL=\"postgresql://user:pass@localhost:5432/love_rank_pulse\""
    fi
else
    echo "   ❌ .env file not found"
    echo "   📝 Create .env and add DATABASE_URL"
fi
echo ""

# Check if schema.prisma exists
echo "📋 2. Checking Prisma schema..."
if [ -f "prisma/schema.prisma" ]; then
    echo "   ✅ schema.prisma exists"
    # Count models
    MODEL_COUNT=$(grep -c "^model" prisma/schema.prisma)
    echo "   ℹ️  Models defined: $MODEL_COUNT"
else
    echo "   ❌ schema.prisma not found"
fi
echo ""

# Check if seed.ts exists
echo "📋 3. Checking seed script..."
if [ -f "prisma/seed.ts" ]; then
    echo "   ✅ seed.ts exists"
else
    echo "   ❌ seed.ts not found"
fi
echo ""

# Check if tsx is installed
echo "📋 4. Checking dependencies..."
if npm list tsx --depth=0 >/dev/null 2>&1; then
    echo "   ✅ tsx is installed"
else
    echo "   ❌ tsx not installed"
    echo "   📝 Run: npm install --save-dev tsx"
fi

if npm list @prisma/client --depth=0 >/dev/null 2>&1; then
    echo "   ✅ @prisma/client is installed"
else
    echo "   ❌ @prisma/client not installed"
    echo "   📝 Run: npm install @prisma/client"
fi

if npm list prisma --depth=0 >/dev/null 2>&1; then
    echo "   ✅ prisma is installed"
else
    echo "   ❌ prisma not installed"
    echo "   📝 Run: npm install --save-dev prisma"
fi
echo ""

# Check package.json scripts
echo "📋 5. Checking npm scripts..."
if grep -q "prisma:migrate" package.json; then
    echo "   ✅ prisma:migrate script configured"
else
    echo "   ❌ prisma:migrate script missing"
fi

if grep -q "prisma:seed" package.json; then
    echo "   ✅ prisma:seed script configured"
else
    echo "   ❌ prisma:seed script missing"
fi

if grep -q "prisma:generate" package.json; then
    echo "   ✅ prisma:generate script configured"
else
    echo "   ❌ prisma:generate script missing"
fi
echo ""

# Validate schema
echo "📋 6. Validating Prisma schema..."
if npm run prisma:validate >/dev/null 2>&1; then
    echo "   ✅ Schema is valid"
else
    echo "   ⚠️  Schema validation had issues (may be ok if DB not connected)"
fi
echo ""

echo "=================================="
echo "📊 Summary"
echo "=================================="
echo ""
echo "Next steps:"
echo "  1. Ensure PostgreSQL is running"
echo "  2. Configure DATABASE_URL in .env"
echo "  3. Run: npm run prisma:generate"
echo "  4. Run: npm run prisma:migrate"
echo "  5. Run: npm run prisma:seed"
echo "  6. Run: npm run prisma:studio (to view data)"
echo ""
echo "For detailed documentation, see:"
echo "  - /workspaces/love-rank-pulse/docs/database-migrations.md"
echo "  - /workspaces/love-rank-pulse/docs/database-quick-reference.md"
echo "  - /workspaces/love-rank-pulse/prisma/README.md"
echo ""
