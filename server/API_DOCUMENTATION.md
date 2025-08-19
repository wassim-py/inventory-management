# WE Brand OS - API Documentation

## Overview
This document provides comprehensive API documentation for the WE Brand OS (E-commerce Operating System) backend. The API is built with Node.js, Express, and Prisma, following RESTful principles.

**Base URL:** `http://localhost:8000` (development)

## Authentication
Currently, the API does not implement authentication. In production, implement JWT-based authentication for all endpoints.

## Common Response Formats

### Success Response
```json
{
  "data": {...},
  "message": "Success message"
}
```

### Error Response
```json
{
  "message": "Error description",
  "error": "Detailed error information"
}
```

### Paginated Response
```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

## API Endpoints

### Dashboard
Get comprehensive dashboard metrics with KPIs and charts.

#### GET /dashboard
Returns dashboard metrics including KPIs, charts, recent orders, and low stock items.

**Query Parameters:**
- `startDate` (optional): Filter start date (ISO string)
- `endDate` (optional): Filter end date (ISO string)

**Response:**
```json
{
  "kpis": {
    "currentCapital": 50000,
    "netProfit": 15000,
    "grossProfit": 25000,
    "averageOrderValue": 1250,
    "returnRate": 5.2
  },
  "charts": {
    "revenueVsProfit": [...],
    "topProducts": [...]
  },
  "recentOrders": [...],
  "lowStockItems": [...]
}
```

#### GET /dashboard/financial-overview
Returns financial overview with breakdown by transaction type.

**Query Parameters:**
- `startDate` (optional): Filter start date
- `endDate` (optional): Filter end date

---

### Products & Variants

#### GET /products
Get all products with optional filtering.

**Query Parameters:**
- `search` (optional): Search by product name
- `category` (optional): Filter by category

**Response:**
```json
[
  {
    "productId": "prod1",
    "name": "Classic T-Shirt",
    "category": "T-Shirts",
    "variants": [...],
    "_count": { "variants": 5 }
  }
]
```

#### GET /products/:productId
Get a specific product with all variants and stock history.

#### POST /products
Create a new product.

**Request Body:**
```json
{
  "name": "Product Name",
  "category": "Category"
}
```

#### PUT /products/:productId
Update a product.

#### DELETE /products/:productId
Delete a product (only if no variants have stock).

#### GET /products/variants/all
Get all variants with optional filtering.

**Query Parameters:**
- `productId` (optional): Filter by product
- `search` (optional): Search by SKU, size, or color

#### POST /products/variants
Create a new variant.

**Request Body:**
```json
{
  "sku": "SKU0001",
  "productId": "prod1",
  "size": "M",
  "color": "Blue",
  "costPrice": 25.50,
  "standardSellingPrice": 45.00,
  "stockOnHand": 100
}
```

#### PUT /products/variants/:sku
Update a variant (automatically creates stock history if stock changes).

#### GET /products/variants/:sku/stock-history
Get stock history for a specific variant.

**Query Parameters:**
- `limit` (optional): Limit number of records (default: 50)

#### GET /products/low-stock
Get variants with low stock.

**Query Parameters:**
- `threshold` (optional): Stock threshold (default: 10)

---

### Orders

#### GET /orders
Get all orders with filtering and pagination.

**Query Parameters:**
- `search` (optional): Search by customer name, phone, or order ID
- `status` (optional): Filter by order status
- `wilaya` (optional): Filter by shipping wilaya
- `startDate` (optional): Filter by order date
- `endDate` (optional): Filter by order date
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

#### GET /orders/:orderId
Get a specific order with all details.

#### POST /orders
Create a new order with automatic stock commitment and price calculation.

**Request Body:**
```json
{
  "customerName": "Ahmed Benali",
  "phoneNumber": "0551234567",
  "address": "123 Main St, Algiers",
  "wilaya": "Algiers",
  "shippingMethod": "DOMICILE",
  "discount": 0,
  "note": "Special instructions",
  "orderLineItems": [
    {
      "sku": "SKU0001",
      "quantity": 2,
      "actualSalePrice": 45.00
    }
  ]
}
```

#### PUT /orders/:orderId
Update order details (cannot update status through this endpoint).

#### PATCH /orders/:orderId/status
Update order status with automatic stock and financial transaction handling.

**Request Body:**
```json
{
  "status": "DELIVERED"
}
```

**Status Flow:**
- `NEW` → `SHIPPED` → `DELIVERED`
- `NEW` → `CANCELLED`
- `DELIVERED` → `RETURNED`

#### GET /orders/recent
Get recent orders for dashboard.

**Query Parameters:**
- `limit` (optional): Number of orders (default: 10)

#### GET /orders/statistics
Get order statistics for analytics.

**Query Parameters:**
- `startDate` (optional): Filter start date
- `endDate` (optional): Filter end date

---

### Marketing

#### GET /marketing/campaigns
Get all marketing campaigns with performance metrics.

**Query Parameters:**
- `status` (optional): Filter by campaign status
- `productId` (optional): Filter by product
- `startDate` (optional): Filter by start date
- `endDate` (optional): Filter by end date

#### GET /marketing/campaigns/:campaignId
Get detailed campaign information with daily performance breakdown.

#### POST /marketing/campaigns
Create a new marketing campaign.

**Request Body:**
```json
{
  "campaignName": "Summer Sale",
  "productId": "prod1",
  "budgetAllocated": 5000,
  "startDate": "2024-06-01T00:00:00Z",
  "endDate": "2024-08-31T23:59:59Z"
}
```

#### PUT /marketing/campaigns/:campaignId
Update campaign details.

#### PATCH /marketing/campaigns/:campaignId/status
Update campaign status.

**Request Body:**
```json
{
  "status": "ACTIVE"
}
```

**Valid Statuses:**
- `PENDING`: Not yet started
- `ACTIVE`: Currently running
- `PAUSED`: Temporarily stopped
- `ENDED`: Completed or manually ended

#### DELETE /marketing/campaigns/:campaignId
Delete a marketing campaign.

#### GET /marketing/currency-purchases
Get all currency purchases with summary statistics.

**Query Parameters:**
- `currency` (optional): Filter by currency type
- `startDate` (optional): Filter by purchase date
- `endDate` (optional): Filter by purchase date

#### POST /marketing/currency-purchases
Create a new currency purchase (automatically creates financial transaction).

**Request Body:**
```json
{
  "purchaseDate": "2024-01-15T00:00:00Z",
  "currency": "USD",
  "amountBought": 10000,
  "exchangeRatePaid": 135.50
}
```

#### GET /marketing/analytics
Get comprehensive marketing analytics including ROI by category.

**Query Parameters:**
- `startDate` (optional): Analysis start date
- `endDate` (optional): Analysis end date

---

### Finances

#### GET /finances/ledger
Get financial transactions with filtering and pagination.

**Query Parameters:**
- `search` (optional): Search by transaction name or order ID
- `type` (optional): Filter by transaction type
- `startDate` (optional): Filter by date
- `endDate` (optional): Filter by date
- `page` (optional): Page number
- `limit` (optional): Items per page (default: 50)

#### GET /finances/ledger/:transactionId
Get a specific transaction with full details.

#### POST /finances/ledger
Create a manual financial transaction.

**Request Body:**
```json
{
  "transactionName": "Office Rent",
  "type": "OTHER_EXPENSE",
  "moneyOut": 25000,
  "orderId": null
}
```

**Transaction Types:**
- `REVENUE`: Order revenue (auto-generated)
- `COGS`: Cost of goods sold (auto-generated)
- `MARKETING`: Marketing cost allocation (auto-generated)
- `RETURN_FEE`: Return processing fee (auto-generated)
- `CURRENCY_PURCHASE`: Currency exchange (auto-generated)
- `OTHER_INCOME`: Manual income entry
- `OTHER_EXPENSE`: Manual expense entry

#### PUT /finances/ledger/:transactionId
Update a manual transaction (cannot modify auto-generated transactions).

#### DELETE /finances/ledger/:transactionId
Delete a manual transaction (cannot delete auto-generated transactions).

#### GET /finances/summary
Get comprehensive financial summary with time-based analysis.

**Query Parameters:**
- `startDate` (optional): Analysis start date
- `endDate` (optional): Analysis end date
- `groupBy` (optional): Time grouping (day/month/year, default: month)

#### GET /finances/cash-flow
Get cash flow analysis with running balance.

**Query Parameters:**
- `period` (optional): Number of days to analyze (default: 30)

#### GET /finances/shipping-zones
Get all shipping zones with order counts.

#### POST /finances/shipping-zones
Create a new shipping zone.

**Request Body:**
```json
{
  "wilaya": "Algiers",
  "stopdeskPrice": 400,
  "domicilePrice": 600
}
```

#### PUT /finances/shipping-zones/:wilaya
Update shipping zone prices.

---

### Users

#### GET /users
Get all users.

#### POST /users
Create a new user.

#### PUT /users/:userId
Update user information.

#### DELETE /users/:userId
Delete a user.

---

## Data Models

### Order Status Flow
```
NEW → SHIPPED → DELIVERED
NEW → CANCELLED
DELIVERED → RETURNED
```

### Campaign Status Flow
```
PENDING → ACTIVE → ENDED
ACTIVE → PAUSED → ACTIVE
ACTIVE → ENDED
```

### Stock Management
- Stock is automatically decremented when orders are created (status: NEW)
- Stock is restored when orders are cancelled or returned
- All stock changes are logged in stock history

### Financial Transaction Automation
- **Order Delivered**: Creates REVENUE, COGS, and MARKETING transactions
- **Order Returned**: Creates RETURN_FEE transaction and restores stock
- **Currency Purchase**: Creates CURRENCY_PURCHASE transaction

## Error Codes

- `400`: Bad Request - Invalid input data
- `404`: Not Found - Resource doesn't exist
- `500`: Internal Server Error - Server error

## Rate Limiting
Currently not implemented. Consider adding rate limiting in production.

## API Versioning
Currently using v1 (implicit). Consider adding explicit versioning for future updates.

## Webhooks
Not currently implemented. Consider adding webhooks for real-time notifications of order status changes, low stock alerts, etc.

## Testing
Use tools like Postman or Insomnia to test the API endpoints. A Postman collection can be created for easier testing.