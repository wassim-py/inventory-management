# WE Brand OS - Comprehensive Testing Plan

## Overview
This document outlines a comprehensive testing strategy for the WE Brand OS implementation, covering unit tests, integration tests, API testing, and end-to-end user scenarios.

## Testing Strategy

### 1. Unit Testing
Test individual functions and components in isolation.

### 2. Integration Testing
Test interactions between different modules and services.

### 3. API Testing
Validate all API endpoints with various scenarios.

### 4. End-to-End Testing
Test complete user workflows from frontend to database.

### 5. Performance Testing
Ensure system meets NFR requirements (< 3 second load times).

## Backend API Testing

### Setup Test Environment

1. **Create Test Database**
   ```bash
   # Create test database
   createdb we_brand_test
   
   # Set test environment variable
   export DATABASE_URL="postgresql://user:password@localhost:5432/we_brand_test"
   export NODE_ENV="test"
   ```

2. **Install Testing Dependencies**
   ```bash
   cd server
   npm install --save-dev jest supertest @types/jest @types/supertest
   ```

3. **Configure Jest**
   ```json
   // server/package.json
   {
     "scripts": {
       "test": "jest",
       "test:watch": "jest --watch",
       "test:coverage": "jest --coverage"
     },
     "jest": {
       "preset": "ts-jest",
       "testEnvironment": "node",
       "setupFilesAfterEnv": ["<rootDir>/src/tests/setup.ts"]
     }
   }
   ```

### API Test Cases

#### Dashboard API Tests
```typescript
// server/src/tests/dashboard.test.ts
import request from 'supertest';
import app from '../index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Dashboard API', () => {
  beforeEach(async () => {
    // Clean and seed test data
    await prisma.$executeRaw`TRUNCATE TABLE "Orders" RESTART IDENTITY CASCADE`;
    await seedTestData();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /dashboard', () => {
    it('should return dashboard metrics', async () => {
      const response = await request(app)
        .get('/dashboard')
        .expect(200);

      expect(response.body).toHaveProperty('kpis');
      expect(response.body.kpis).toHaveProperty('currentCapital');
      expect(response.body.kpis).toHaveProperty('netProfit');
      expect(response.body.kpis).toHaveProperty('grossProfit');
      expect(response.body.kpis).toHaveProperty('averageOrderValue');
      expect(response.body.kpis).toHaveProperty('returnRate');
    });

    it('should filter metrics by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      
      const response = await request(app)
        .get(`/dashboard?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      expect(response.body).toHaveProperty('kpis');
      // Add specific assertions for filtered data
    });

    it('should return charts data', async () => {
      const response = await request(app)
        .get('/dashboard')
        .expect(200);

      expect(response.body).toHaveProperty('charts');
      expect(response.body.charts).toHaveProperty('revenueVsProfit');
      expect(response.body.charts).toHaveProperty('topProducts');
    });
  });
});
```

#### Products API Tests
```typescript
// server/src/tests/products.test.ts
describe('Products API', () => {
  describe('GET /products', () => {
    it('should return all products', async () => {
      const response = await request(app)
        .get('/products')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('productId');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('category');
    });

    it('should filter products by search term', async () => {
      const response = await request(app)
        .get('/products?search=T-Shirt')
        .expect(200);

      expect(response.body.every(p => p.name.includes('T-Shirt'))).toBe(true);
    });

    it('should filter products by category', async () => {
      const response = await request(app)
        .get('/products?category=T-Shirts')
        .expect(200);

      expect(response.body.every(p => p.category === 'T-Shirts')).toBe(true);
    });
  });

  describe('POST /products', () => {
    it('should create a new product', async () => {
      const newProduct = {
        name: 'Test Product',
        category: 'Test Category'
      };

      const response = await request(app)
        .post('/products')
        .send(newProduct)
        .expect(201);

      expect(response.body).toHaveProperty('productId');
      expect(response.body.name).toBe(newProduct.name);
      expect(response.body.category).toBe(newProduct.category);
    });

    it('should return 400 for invalid data', async () => {
      const invalidProduct = { name: '' }; // Missing category

      await request(app)
        .post('/products')
        .send(invalidProduct)
        .expect(400);
    });
  });

  describe('Variants API', () => {
    it('should create a variant', async () => {
      const variant = {
        sku: 'TEST001',
        productId: 'existing-product-id',
        size: 'M',
        color: 'Blue',
        costPrice: 25.50,
        standardSellingPrice: 45.00,
        stockOnHand: 100
      };

      const response = await request(app)
        .post('/products/variants')
        .send(variant)
        .expect(201);

      expect(response.body.sku).toBe(variant.sku);
      
      // Check stock history was created
      const stockHistory = await prisma.stockHistory.findFirst({
        where: { sku: variant.sku }
      });
      expect(stockHistory).toBeTruthy();
    });
  });
});
```

#### Orders API Tests
```typescript
// server/src/tests/orders.test.ts
describe('Orders API', () => {
  describe('POST /orders', () => {
    it('should create a new order with stock commitment', async () => {
      const order = {
        customerName: 'Test Customer',
        phoneNumber: '0551234567',
        address: 'Test Address',
        wilaya: 'Algiers',
        shippingMethod: 'DOMICILE',
        orderLineItems: [
          {
            sku: 'TEST001',
            quantity: 2,
            actualSalePrice: 45.00
          }
        ]
      };

      const initialStock = await prisma.variants.findUnique({
        where: { sku: 'TEST001' }
      });

      const response = await request(app)
        .post('/orders')
        .send(order)
        .expect(201);

      expect(response.body).toHaveProperty('orderId');
      expect(response.body.status).toBe('NEW');

      // Check stock was decremented
      const updatedStock = await prisma.variants.findUnique({
        where: { sku: 'TEST001' }
      });
      expect(updatedStock.stockOnHand).toBe(initialStock.stockOnHand - 2);
    });

    it('should return 400 for insufficient stock', async () => {
      const order = {
        customerName: 'Test Customer',
        phoneNumber: '0551234567',
        address: 'Test Address',
        wilaya: 'Algiers',
        shippingMethod: 'DOMICILE',
        orderLineItems: [
          {
            sku: 'TEST001',
            quantity: 1000, // More than available stock
            actualSalePrice: 45.00
          }
        ]
      };

      await request(app)
        .post('/orders')
        .send(order)
        .expect(400);
    });
  });

  describe('PATCH /orders/:orderId/status', () => {
    it('should update order status to DELIVERED and create financial transactions', async () => {
      const order = await createTestOrder();

      const response = await request(app)
        .patch(`/orders/${order.orderId}/status`)
        .send({ status: 'DELIVERED' })
        .expect(200);

      expect(response.body.status).toBe('DELIVERED');

      // Check financial transactions were created
      const transactions = await prisma.financesLedger.findMany({
        where: { orderId: order.orderId }
      });

      expect(transactions.length).toBeGreaterThan(0);
      expect(transactions.some(t => t.type === 'REVENUE')).toBe(true);
      expect(transactions.some(t => t.type === 'COGS')).toBe(true);
    });

    it('should handle order returns correctly', async () => {
      const order = await createTestOrder({ status: 'DELIVERED' });

      await request(app)
        .patch(`/orders/${order.orderId}/status`)
        .send({ status: 'RETURNED' })
        .expect(200);

      // Check return fee transaction was created
      const returnFee = await prisma.financesLedger.findFirst({
        where: { orderId: order.orderId, type: 'RETURN_FEE' }
      });
      expect(returnFee).toBeTruthy();
    });
  });
});
```

#### Marketing API Tests
```typescript
// server/src/tests/marketing.test.ts
describe('Marketing API', () => {
  describe('POST /marketing/campaigns', () => {
    it('should create a marketing campaign', async () => {
      const campaign = {
        campaignName: 'Test Campaign',
        productId: 'existing-product-id',
        budgetAllocated: 1000,
        startDate: '2024-06-01T00:00:00Z',
        endDate: '2024-08-31T23:59:59Z'
      };

      const response = await request(app)
        .post('/marketing/campaigns')
        .send(campaign)
        .expect(201);

      expect(response.body.campaignName).toBe(campaign.campaignName);
      expect(response.body.status).toBe('PENDING'); // Future start date
    });

    it('should set status to ACTIVE for current campaigns', async () => {
      const now = new Date();
      const campaign = {
        campaignName: 'Active Campaign',
        productId: 'existing-product-id',
        budgetAllocated: 1000,
        startDate: new Date(now.getTime() - 86400000), // Yesterday
        endDate: new Date(now.getTime() + 86400000)   // Tomorrow
      };

      const response = await request(app)
        .post('/marketing/campaigns')
        .send(campaign)
        .expect(201);

      expect(response.body.status).toBe('ACTIVE');
    });
  });
});
```

#### Finances API Tests
```typescript
// server/src/tests/finances.test.ts
describe('Finances API', () => {
  describe('GET /finances/ledger', () => {
    it('should return paginated transactions', async () => {
      const response = await request(app)
        .get('/finances/ledger?page=1&limit=10')
        .expect(200);

      expect(response.body).toHaveProperty('transactions');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should filter transactions by type', async () => {
      const response = await request(app)
        .get('/finances/ledger?type=REVENUE')
        .expect(200);

      expect(response.body.transactions.every(t => t.type === 'REVENUE')).toBe(true);
    });
  });

  describe('POST /finances/ledger', () => {
    it('should create a manual transaction', async () => {
      const transaction = {
        transactionName: 'Test Expense',
        type: 'OTHER_EXPENSE',
        moneyOut: 500
      };

      const response = await request(app)
        .post('/finances/ledger')
        .send(transaction)
        .expect(201);

      expect(response.body.transactionName).toBe(transaction.transactionName);
      expect(response.body.type).toBe(transaction.type);
      expect(response.body.moneyOut).toBe(transaction.moneyOut);
    });

    it('should prevent creating transactions with both money in and out', async () => {
      const invalidTransaction = {
        transactionName: 'Invalid Transaction',
        type: 'OTHER_EXPENSE',
        moneyIn: 100,
        moneyOut: 200
      };

      await request(app)
        .post('/finances/ledger')
        .send(invalidTransaction)
        .expect(400);
    });
  });
});
```

### Test Data Helpers
```typescript
// server/src/tests/helpers.ts
export async function seedTestData() {
  // Create test products
  const product = await prisma.products.create({
    data: {
      productId: 'test-product-1',
      name: 'Test Product',
      category: 'Test Category'
    }
  });

  // Create test variants
  await prisma.variants.create({
    data: {
      sku: 'TEST001',
      productId: product.productId,
      size: 'M',
      color: 'Blue',
      costPrice: 25.50,
      standardSellingPrice: 45.00,
      stockOnHand: 100
    }
  });

  // Create shipping zone
  await prisma.shippingZones.create({
    data: {
      wilaya: 'Algiers',
      stopdeskPrice: 400,
      domicilePrice: 600
    }
  });
}

export async function createTestOrder(overrides = {}) {
  return await prisma.orders.create({
    data: {
      customerName: 'Test Customer',
      phoneNumber: '0551234567',
      address: 'Test Address',
      wilaya: 'Algiers',
      shippingMethod: 'DOMICILE',
      status: 'NEW',
      subtotal: 90,
      shippingPrice: 600,
      finalPrice: 690,
      ...overrides
    }
  });
}
```

## Frontend Testing (React Native + Expo)

### Setup Frontend Testing
```bash
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native
```

### Component Tests
```typescript
// __tests__/components/Dashboard.test.tsx
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { store } from '../src/store';
import Dashboard from '../src/screens/Dashboard';

const renderWithRedux = (component) => {
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('Dashboard Component', () => {
  it('should render KPI cards', async () => {
    const { getByText } = renderWithRedux(<Dashboard />);
    
    await waitFor(() => {
      expect(getByText('Current Capital')).toBeTruthy();
      expect(getByText('Net Profit')).toBeTruthy();
      expect(getByText('Gross Profit')).toBeTruthy();
    });
  });

  it('should display loading state initially', () => {
    const { getByTestId } = renderWithRedux(<Dashboard />);
    expect(getByTestId('loading-spinner')).toBeTruthy();
  });
});
```

## End-to-End Testing Scenarios

### Scenario 1: Complete Order Lifecycle
```typescript
// e2e/order-lifecycle.test.ts
describe('Order Lifecycle E2E', () => {
  it('should handle complete order process', async () => {
    // 1. Create product and variant
    const product = await createProduct({
      name: 'E2E Test Product',
      category: 'Test'
    });
    
    const variant = await createVariant({
      sku: 'E2E001',
      productId: product.productId,
      stockOnHand: 50
    });

    // 2. Create order
    const order = await createOrder({
      orderLineItems: [{ sku: 'E2E001', quantity: 2 }]
    });

    // 3. Verify stock was decremented
    const stockAfterOrder = await getVariantStock('E2E001');
    expect(stockAfterOrder).toBe(48);

    // 4. Ship order
    await updateOrderStatus(order.orderId, 'SHIPPED');

    // 5. Deliver order
    await updateOrderStatus(order.orderId, 'DELIVERED');

    // 6. Verify financial transactions were created
    const transactions = await getOrderTransactions(order.orderId);
    expect(transactions.some(t => t.type === 'REVENUE')).toBe(true);
    expect(transactions.some(t => t.type === 'COGS')).toBe(true);

    // 7. Return order
    await updateOrderStatus(order.orderId, 'RETURNED');

    // 8. Verify stock was restored
    const stockAfterReturn = await getVariantStock('E2E001');
    expect(stockAfterReturn).toBe(50);

    // 9. Verify return fee was charged
    const returnFee = await getReturnFeeTransaction(order.orderId);
    expect(returnFee).toBeTruthy();
  });
});
```

### Scenario 2: Marketing Campaign ROI Calculation
```typescript
describe('Marketing Campaign ROI E2E', () => {
  it('should correctly calculate campaign ROI', async () => {
    // 1. Create product and campaign
    const product = await createProduct({ name: 'Campaign Product' });
    const campaign = await createCampaign({
      productId: product.productId,
      budgetAllocated: 1000
    });

    // 2. Create and deliver orders during campaign period
    const orders = await Promise.all([
      createAndDeliverOrder(product.productId, 500),
      createAndDeliverOrder(product.productId, 750),
      createAndDeliverOrder(product.productId, 300)
    ]);

    // 3. Check campaign performance
    const performance = await getCampaignPerformance(campaign.campaignId);
    expect(performance.totalSales).toBe(1550);
    expect(performance.roi).toBeGreaterThan(0);
  });
});
```

## Performance Testing

### Load Testing with Artillery
```yaml
# artillery-config.yml
config:
  target: 'http://localhost:8000'
  phases:
    - duration: 60
      arrivalRate: 10
  defaults:
    headers:
      Content-Type: 'application/json'

scenarios:
  - name: "Dashboard Load Test"
    requests:
      - get:
          url: "/dashboard"
  
  - name: "Products API Load Test"
    requests:
      - get:
          url: "/products"
      - get:
          url: "/products/variants/all"
  
  - name: "Orders API Load Test"
    requests:
      - get:
          url: "/orders"
      - post:
          url: "/orders"
          json:
            customerName: "Load Test Customer"
            phoneNumber: "0551234567"
            address: "Test Address"
            wilaya: "Algiers"
            shippingMethod: "DOMICILE"
            orderLineItems:
              - sku: "TEST001"
                quantity: 1
                actualSalePrice: 45.00
```

Run performance tests:
```bash
npm install -g artillery
artillery run artillery-config.yml
```

## Testing Checklist

### Functional Testing
- [ ] Dashboard displays all required KPIs
- [ ] Dashboard filters work correctly with date ranges
- [ ] Product CRUD operations work correctly
- [ ] Variant management with stock tracking
- [ ] Order creation with stock commitment
- [ ] Order status updates with automation
- [ ] Marketing campaign management
- [ ] Currency purchase tracking
- [ ] Financial ledger with filtering
- [ ] Automated financial calculations
- [ ] Stock history tracking
- [ ] Low stock alerts

### Business Logic Testing
- [ ] Stock levels update correctly on order creation
- [ ] Stock restored on order cancellation/return
- [ ] Financial transactions auto-generated on delivery
- [ ] Marketing cost attribution calculation
- [ ] Shipping price calculation
- [ ] Order total calculation with discounts
- [ ] Return fee processing
- [ ] Campaign ROI calculation

### Data Integrity Testing
- [ ] Foreign key constraints enforced
- [ ] Required fields validation
- [ ] Data type validation
- [ ] Unique constraint validation
- [ ] Cascade deletes work correctly
- [ ] Transaction atomicity maintained

### Performance Testing
- [ ] Dashboard loads in < 3 seconds
- [ ] API responses under load
- [ ] Database query optimization
- [ ] Memory usage under load
- [ ] Concurrent user handling

### Security Testing
- [ ] Input sanitization
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CORS configuration
- [ ] Rate limiting (when implemented)

### Integration Testing
- [ ] Database connection handling
- [ ] API endpoint integration
- [ ] Frontend-backend integration
- [ ] Third-party service integration (if any)

## Continuous Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: we_brand_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd server
          npm install
          
      - name: Run database migrations
        run: |
          cd server
          npx prisma migrate deploy
          
      - name: Run tests
        run: |
          cd server
          npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/we_brand_test
          
      - name: Run coverage
        run: |
          cd server
          npm run test:coverage
```

## Test Execution Commands

```bash
# Backend tests
cd server
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run with coverage report

# Frontend tests
cd client
npm test                   # Run React Native tests
npm run test:e2e          # Run E2E tests

# Performance tests
artillery run artillery-config.yml

# Full test suite
npm run test:all          # Run all tests across the project
```

## Test Reporting

### Coverage Reports
- Aim for >80% code coverage
- Focus on critical business logic
- Generate HTML coverage reports

### Test Results Dashboard
- Integrate with CI/CD pipeline
- Track test trends over time
- Alert on test failures

This comprehensive testing plan ensures that the WE Brand OS implementation meets all SRS requirements and maintains high quality standards throughout development and deployment.