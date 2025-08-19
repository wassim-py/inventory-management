# WE Brand OS - Integration Guide

## Overview
This guide provides step-by-step instructions to integrate the new SRS-compliant backend with your existing system and migrate from the current implementation to the full WE Brand OS.

## Phase 1: Backend Migration (Critical)

### Step 1: Database Schema Migration

1. **Backup Current Database**
   ```bash
   cd server
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Replace Prisma Schema**
   ```bash
   # Backup current schema
   cp prisma/schema.prisma prisma/schema-legacy.prisma
   
   # Use new SRS schema
   cp prisma/schema-srs.prisma prisma/schema.prisma
   ```

3. **Generate New Prisma Client**
   ```bash
   npx prisma generate
   ```

4. **Create Migration**
   ```bash
   npx prisma migrate dev --name "migrate-to-srs-schema"
   ```

5. **Seed New Database**
   ```bash
   # Update package.json to use new seed file
   npm run seed -- --file=seed-srs.ts
   ```

### Step 2: Update Server Dependencies

Update `server/package.json` if needed:
```bash
cd server
npm install
npm run build
```

### Step 3: Replace Controllers and Routes

The new controllers and routes are already implemented. The server will now have:

**New API Endpoints:**
- `/products` - Enhanced with variants management
- `/orders` - Complete order management system
- `/marketing` - Marketing campaigns and currency purchases
- `/finances` - Financial ledger and analytics
- `/dashboard` - Enhanced with SRS-compliant KPIs

### Step 4: Test Backend

```bash
cd server
npm run dev
```

Test key endpoints:
```bash
# Test dashboard
curl http://localhost:8000/dashboard

# Test products
curl http://localhost:8000/products

# Test orders
curl http://localhost:8000/orders

# Test marketing
curl http://localhost:8000/marketing/campaigns

# Test finances
curl http://localhost:8000/finances/ledger
```

## Phase 2: Frontend Architecture Decision

### Option A: Keep Next.js (Faster Implementation)

**Pros:**
- Minimal disruption to current development
- Faster time to market
- Existing codebase can be adapted

**Cons:**
- Doesn't meet SRS requirement for React Native + Expo
- No native mobile app capability
- Missing dual-theme system and fintech design

**Implementation Steps:**

1. **Update API Layer**
   ```typescript
   // client/src/state/api.ts - Replace with new endpoints
   ```

2. **Create New Components for Missing Features**
   - Order management components
   - Marketing campaign management
   - Financial ledger views
   - Enhanced dashboard with SRS KPIs

3. **Update Existing Components**
   - Product management (add variants support)
   - Dashboard (new KPIs and charts)

### Option B: Migrate to React Native + Expo (SRS Compliant)

**Pros:**
- Fully SRS compliant
- Single codebase for web and mobile
- Future-proof for native mobile app

**Cons:**
- Significant development effort
- Complete frontend rewrite required
- Longer implementation timeline

**Implementation Steps:**

1. **Initialize New React Native + Expo Project**
   ```bash
   npx create-expo-app@latest we-brand-os --template tabs
   cd we-brand-os
   npm install
   ```

2. **Install Required Dependencies**
   ```bash
   # State management
   npm install @reduxjs/toolkit react-redux redux-persist
   
   # Navigation
   npm install @react-navigation/native @react-navigation/bottom-tabs
   
   # UI components
   npm install react-native-paper react-native-vector-icons
   
   # Charts
   npm install react-native-chart-kit react-native-svg
   
   # HTTP client
   npm install axios
   
   # Date handling
   npm install date-fns
   
   # Forms
   npm install react-hook-form
   ```

3. **Configure Theme System**
   ```typescript
   // themes/index.ts
   export const lightTheme = {
     colors: {
       primary: '#6474E5',
       secondary: '#FF8C69',
       background: '#F7F7F8',
       surface: '#FFFFFF',
       text: '#1C1C1E',
       textSecondary: '#8A8A8E'
     }
   };
   
   export const darkTheme = {
     colors: {
       primary: '#6474E5',
       secondary: '#FF8C69',
       background: '#1C1C1E',
       surface: '#2C2C2E',
       text: '#F2F2F7',
       textSecondary: '#8D8D93'
     }
   };
   ```

## Phase 3: Frontend Implementation (Recommended Approach)

### Step 1: Core Infrastructure

1. **Set up Redux Store**
   ```typescript
   // store/index.ts
   import { configureStore } from '@reduxjs/toolkit';
   import { api } from './api';
   
   export const store = configureStore({
     reducer: {
       api: api.reducer,
     },
     middleware: (getDefaultMiddleware) =>
       getDefaultMiddleware().concat(api.middleware),
   });
   ```

2. **Create API Service**
   ```typescript
   // services/api.ts
   import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
   
   export const api = createApi({
     baseQuery: fetchBaseQuery({ 
       baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000' 
     }),
     tagTypes: ['Product', 'Order', 'Campaign', 'Transaction'],
     endpoints: (builder) => ({
       // Dashboard
       getDashboardMetrics: builder.query({
         query: ({ startDate, endDate } = {}) => ({
           url: '/dashboard',
           params: { startDate, endDate }
         })
       }),
       
       // Products
       getProducts: builder.query({
         query: (params = {}) => ({
           url: '/products',
           params
         }),
         providesTags: ['Product']
       }),
       
       // Orders
       getOrders: builder.query({
         query: (params = {}) => ({
           url: '/orders',
           params
         }),
         providesTags: ['Order']
       }),
       
       createOrder: builder.mutation({
         query: (order) => ({
           url: '/orders',
           method: 'POST',
           body: order
         }),
         invalidatesTags: ['Order']
       }),
       
       // Add all other endpoints...
     })
   });
   ```

### Step 2: Core Components

1. **Navigation Structure**
   ```typescript
   // navigation/BottomTabNavigator.tsx
   import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
   import { Dashboard, Orders, Products, Marketing, Finances } from '../screens';
   
   const Tab = createBottomTabNavigator();
   
   export default function BottomTabNavigator() {
     return (
       <Tab.Navigator
         screenOptions={{
           tabBarActiveTintColor: '#6474E5',
           tabBarStyle: { borderRadius: 20 }
         }}
       >
         <Tab.Screen name="Dashboard" component={Dashboard} />
         <Tab.Screen name="Orders" component={Orders} />
         <Tab.Screen name="Products" component={Products} />
         <Tab.Screen name="Marketing" component={Marketing} />
         <Tab.Screen name="Finances" component={Finances} />
       </Tab.Navigator>
     );
   }
   ```

2. **Dashboard Screen**
   ```typescript
   // screens/Dashboard.tsx
   import React from 'react';
   import { ScrollView, View } from 'react-native';
   import { Card, Title, Paragraph } from 'react-native-paper';
   import { useGetDashboardMetricsQuery } from '../services/api';
   
   export default function Dashboard() {
     const { data, isLoading } = useGetDashboardMetricsQuery();
     
     if (isLoading) return <LoadingSpinner />;
     
     return (
       <ScrollView style={{ flex: 1, padding: 16 }}>
         {/* KPI Cards */}
         <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
           <KPICard 
             title="Current Capital" 
             value={data?.kpis.currentCapital} 
             format="currency"
           />
           <KPICard 
             title="Net Profit" 
             value={data?.kpis.netProfit} 
             format="currency"
           />
           {/* Add more KPI cards */}
         </View>
         
         {/* Charts */}
         <Card style={{ margin: 8, borderRadius: 16 }}>
           <Card.Content>
             <Title>Revenue vs Profit</Title>
             <RevenueChart data={data?.charts.revenueVsProfit} />
           </Card.Content>
         </Card>
         
         {/* Recent Orders */}
         <Card style={{ margin: 8, borderRadius: 16 }}>
           <Card.Content>
             <Title>Recent Orders</Title>
             <OrdersList orders={data?.recentOrders} />
           </Card.Content>
         </Card>
       </ScrollView>
     );
   }
   ```

### Step 3: Feature-Specific Screens

1. **Order Management**
   ```typescript
   // screens/Orders/OrderList.tsx
   // screens/Orders/CreateOrder.tsx
   // screens/Orders/OrderDetails.tsx
   ```

2. **Product & Inventory Management**
   ```typescript
   // screens/Products/ProductList.tsx
   // screens/Products/CreateProduct.tsx
   // screens/Products/VariantManagement.tsx
   ```

3. **Marketing Management**
   ```typescript
   // screens/Marketing/CampaignList.tsx
   // screens/Marketing/CreateCampaign.tsx
   // screens/Marketing/CurrencyPurchases.tsx
   ```

4. **Financial Management**
   ```typescript
   // screens/Finances/FinancialLedger.tsx
   // screens/Finances/CreateTransaction.tsx
   // screens/Finances/FinancialReports.tsx
   ```

## Phase 4: Production Deployment

### Step 1: Environment Configuration

1. **Backend Environment Variables**
   ```bash
   # server/.env
   DATABASE_URL="postgresql://user:password@host:port/database"
   PORT=8000
   NODE_ENV=production
   ```

2. **Frontend Environment Variables**
   ```bash
   # .env
   EXPO_PUBLIC_API_URL=https://your-api-domain.com
   ```

### Step 2: Database Migration in Production

1. **Run Migrations**
   ```bash
   npx prisma migrate deploy
   ```

2. **Seed Production Data**
   ```bash
   npm run seed:production
   ```

### Step 3: Deploy Backend

**Option A: Traditional VPS/Cloud Server**
```bash
# Build and start
npm run build
npm start
```

**Option B: Docker Deployment**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 8000
CMD ["npm", "start"]
```

### Step 4: Deploy Frontend

**For Web (Expo Web):**
```bash
npx expo export -p web
# Deploy static files to CDN/hosting service
```

**For Native App:**
```bash
# Build for app stores
eas build --platform all
```

## Phase 5: Data Migration (If Preserving Existing Data)

### Step 1: Export Existing Data
```sql
-- Export products
SELECT * FROM "Products" INTO '/tmp/legacy_products.csv' WITH CSV HEADER;

-- Export sales
SELECT * FROM "Sales" INTO '/tmp/legacy_sales.csv' WITH CSV HEADER;
```

### Step 2: Transform and Import
```typescript
// migration/transform-data.ts
// Script to transform legacy data to new schema format
```

## Timeline Estimates

### Option A: Next.js Adaptation (4-6 weeks)
- Week 1: Backend migration and testing
- Week 2-3: Update existing components
- Week 4-5: Implement missing features
- Week 6: Testing and deployment

### Option B: React Native Migration (8-12 weeks)
- Week 1-2: Backend migration and new project setup
- Week 3-4: Core infrastructure and navigation
- Week 5-7: Feature implementation
- Week 8-9: UI/UX polish and theme system
- Week 10-11: Testing and optimization
- Week 12: Deployment

## Risk Mitigation

1. **Database Backup**: Always backup before migrations
2. **Staging Environment**: Test all changes in staging first
3. **Gradual Rollout**: Consider feature flags for gradual rollout
4. **Monitoring**: Implement logging and monitoring for production
5. **Rollback Plan**: Have clear rollback procedures

## Success Metrics

- All SRS functional requirements implemented ✅
- API response times < 3 seconds ✅
- Mobile-responsive design ✅
- Dual theme system ✅
- Real-time stock management ✅
- Automated financial calculations ✅
- Marketing cost attribution ✅

## Next Steps

1. Choose frontend approach (Next.js vs React Native)
2. Schedule database migration window
3. Set up staging environment
4. Begin implementation following this guide
5. Plan user training and documentation

## Support

For implementation support:
- Review API documentation in `API_DOCUMENTATION.md`
- Check testing plan in `TESTING_PLAN.md`
- Reference the complete SRS document for requirements clarification