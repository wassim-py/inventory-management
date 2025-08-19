import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Clear existing data (in correct order to handle foreign keys)
  console.log("🧹 Clearing existing data...");
  await prisma.stockHistory.deleteMany();
  await prisma.orderLineItems.deleteMany();
  await prisma.orders.deleteMany();
  await prisma.financesLedger.deleteMany();
  await prisma.marketingCampaigns.deleteMany();
  await prisma.variants.deleteMany();
  await prisma.products.deleteMany();
  await prisma.shippingZones.deleteMany();
  await prisma.currencyPurchases.deleteMany();
  await prisma.users.deleteMany();
  await prisma.appSettings.deleteMany();

  // Create Users
  console.log("👥 Creating users...");
  await prisma.users.createMany({
    data: [
      {
        userId: "user1",
        name: "Admin User",
        email: "admin@webrand.com",
        role: "ADMIN"
      },
      {
        userId: "user2", 
        name: "Manager User",
        email: "manager@webrand.com",
        role: "MANAGER"
      }
    ]
  });

  // Create Shipping Zones (Algeria Wilayas)
  console.log("📦 Creating shipping zones...");
  await prisma.shippingZones.createMany({
    data: [
      { wilaya: "Algiers", stopdeskPrice: 400, domicilePrice: 600 },
      { wilaya: "Oran", stopdeskPrice: 450, domicilePrice: 650 },
      { wilaya: "Constantine", stopdeskPrice: 500, domicilePrice: 700 },
      { wilaya: "Annaba", stopdeskPrice: 550, domicilePrice: 750 },
      { wilaya: "Blida", stopdeskPrice: 400, domicilePrice: 600 },
      { wilaya: "Batna", stopdeskPrice: 500, domicilePrice: 700 },
      { wilaya: "Djelfa", stopdeskPrice: 450, domicilePrice: 650 },
      { wilaya: "Setif", stopdeskPrice: 500, domicilePrice: 700 },
      { wilaya: "Saida", stopdeskPrice: 500, domicilePrice: 700 },
      { wilaya: "Skikda", stopdeskPrice: 550, domicilePrice: 750 }
    ]
  });

  // Create Products
  console.log("👕 Creating products...");
  const products = [
    { productId: "prod1", name: "Classic T-Shirt", category: "T-Shirts" },
    { productId: "prod2", name: "Denim Jeans", category: "Jeans" },
    { productId: "prod3", name: "Cotton Hoodie", category: "Hoodies" },
    { productId: "prod4", name: "Summer Dress", category: "Dresses" },
    { productId: "prod5", name: "Leather Jacket", category: "Jackets" },
    { productId: "prod6", name: "Sport Sneakers", category: "Footwear" },
    { productId: "prod7", name: "Casual Shirt", category: "Shirts" },
    { productId: "prod8", name: "Winter Coat", category: "Coats" }
  ];

  for (const product of products) {
    await prisma.products.create({ data: product });
  }

  // Create Variants
  console.log("🎨 Creating product variants...");
  const colors = ["Black", "White", "Blue", "Red", "Green", "Gray"];
  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

  let skuCounter = 1;
  for (const product of products) {
    // Create 3-5 variants per product
    const variantCount = Math.floor(Math.random() * 3) + 3;
    
    for (let i = 0; i < variantCount; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = sizes[Math.floor(Math.random() * sizes.length)];
      const costPrice = Math.floor(Math.random() * 50) + 20; // 20-70
      const sellingPrice = costPrice * (1.5 + Math.random()); // 50-100% markup
      const stock = Math.floor(Math.random() * 100) + 10; // 10-110 stock

      await prisma.variants.create({
        data: {
          sku: `SKU${skuCounter.toString().padStart(4, '0')}`,
          productId: product.productId,
          size,
          color,
          costPrice,
          standardSellingPrice: Math.round(sellingPrice * 100) / 100,
          stockOnHand: stock
        }
      });

      // Create initial stock history
      await prisma.stockHistory.create({
        data: {
          sku: `SKU${skuCounter.toString().padStart(4, '0')}`,
          changeType: 'IN',
          quantityChange: stock,
          previousStock: 0,
          newStock: stock,
          reason: 'Initial stock'
        }
      });

      skuCounter++;
    }
  }

  // Create Marketing Campaigns
  console.log("📢 Creating marketing campaigns...");
  const campaigns = [
    {
      campaignName: "Summer Collection Launch",
      productId: "prod4", // Summer Dress
      budgetAllocated: 5000,
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-08-31'),
      status: 'ENDED'
    },
    {
      campaignName: "Back to School",
      productId: "prod1", // Classic T-Shirt
      budgetAllocated: 3000,
      startDate: new Date('2024-08-15'),
      endDate: new Date('2024-09-30'),
      status: 'ENDED'
    },
    {
      campaignName: "Winter Warmth Campaign",
      productId: "prod8", // Winter Coat
      budgetAllocated: 4000,
      startDate: new Date('2024-11-01'),
      endDate: new Date('2025-02-28'),
      status: 'ACTIVE'
    },
    {
      campaignName: "Denim Days",
      productId: "prod2", // Denim Jeans
      budgetAllocated: 2500,
      startDate: new Date('2024-10-01'),
      endDate: new Date('2024-12-31'),
      status: 'ACTIVE'
    }
  ];

  for (const campaign of campaigns) {
    await prisma.marketingCampaigns.create({ data: campaign });
  }

  // Create Currency Purchases
  console.log("💱 Creating currency purchases...");
  const currencyPurchases = [
    {
      purchaseDate: new Date('2024-01-15'),
      currency: 'USD',
      amountBought: 10000,
      exchangeRatePaid: 135.50
    },
    {
      purchaseDate: new Date('2024-03-10'),
      currency: 'EUR',
      amountBought: 5000,
      exchangeRatePaid: 145.20
    },
    {
      purchaseDate: new Date('2024-06-05'),
      currency: 'USD',
      amountBought: 15000,
      exchangeRatePaid: 138.75
    },
    {
      purchaseDate: new Date('2024-09-20'),
      currency: 'EUR',
      amountBought: 8000,
      exchangeRatePaid: 148.90
    }
  ];

  for (const purchase of currencyPurchases) {
    await prisma.currencyPurchases.create({ data: purchase });
    
    // Create corresponding financial transaction
    await prisma.financesLedger.create({
      data: {
        transactionName: `Currency Purchase - ${purchase.currency}`,
        type: 'CURRENCY_PURCHASE',
        moneyOut: purchase.amountBought * purchase.exchangeRatePaid
      }
    });
  }

  // Create Sample Orders
  console.log("🛒 Creating sample orders...");
  const customers = [
    { name: "Ahmed Benali", phone: "0551234567" },
    { name: "Fatima Kader", phone: "0661234567" },
    { name: "Mohamed Saidi", phone: "0771234567" },
    { name: "Amina Bouaziz", phone: "0551234568" },
    { name: "Youcef Merah", phone: "0661234568" },
    { name: "Samira Hadj", phone: "0771234568" },
    { name: "Karim Ziani", phone: "0551234569" },
    { name: "Nadia Brahimi", phone: "0661234569" }
  ];

  const addresses = [
    "Cite 1000 Logements, Algiers",
    "Hay El Badr, Oran", 
    "Centre Ville, Constantine",
    "Bab Ezzouar, Algiers",
    "Es Senia, Oran",
    "Nouvelle Ville, Annaba",
    "Ouled Yaich, Blida",
    "Cite Aadl, Batna"
  ];

  const wilayas = ["Algiers", "Oran", "Constantine", "Annaba", "Blida", "Batna", "Djelfa", "Setif"];
  const statuses = ['DELIVERED', 'DELIVERED', 'DELIVERED', 'SHIPPED', 'NEW', 'RETURNED'];

  // Get all variants for order creation
  const allVariants = await prisma.variants.findMany();

  for (let i = 0; i < 50; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const wilaya = wilayas[Math.floor(Math.random() * wilayas.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const shippingMethod = Math.random() > 0.5 ? 'DOMICILE' : 'STOPDESK';
    
    // Random order date in the last 6 months
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 180));

    // Get shipping price
    const shippingZone = await prisma.shippingZones.findUnique({
      where: { wilaya }
    });
    const shippingPrice = shippingMethod === 'DOMICILE' 
      ? shippingZone!.domicilePrice 
      : shippingZone!.stopdeskPrice;

    // Create order line items (1-3 items per order)
    const itemCount = Math.floor(Math.random() * 3) + 1;
    const orderItems = [];
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const variant = allVariants[Math.floor(Math.random() * allVariants.length)];
      const quantity = Math.floor(Math.random() * 3) + 1;
      const salePrice = variant.standardSellingPrice * (0.9 + Math.random() * 0.2); // ±10% price variation
      
      orderItems.push({
        sku: variant.sku,
        quantity,
        actualSalePrice: Math.round(salePrice * 100) / 100
      });
      
      subtotal += salePrice * quantity;
    }

    const discount = Math.random() > 0.8 ? Math.floor(Math.random() * 500) + 100 : 0;
    const finalPrice = subtotal + shippingPrice - discount;

    // Create order
    const order = await prisma.orders.create({
      data: {
        customerName: customer.name,
        phoneNumber: customer.phone,
        address: addresses[Math.floor(Math.random() * addresses.length)],
        orderDate,
        status: status as any,
        discount,
        shippingMethod,
        wilaya,
        note: Math.random() > 0.7 ? "Special delivery instructions" : null,
        subtotal,
        shippingPrice,
        finalPrice
      }
    });

    // Create order line items
    for (const item of orderItems) {
      await prisma.orderLineItems.create({
        data: {
          orderId: order.orderId,
          sku: item.sku,
          quantity: item.quantity,
          actualSalePrice: item.actualSalePrice
        }
      });

      // Update stock and create history (simulate stock commitment)
      const variant = await prisma.variants.findUnique({
        where: { sku: item.sku }
      });

      if (variant) {
        const newStock = variant.stockOnHand - item.quantity;
        await prisma.variants.update({
          where: { sku: item.sku },
          data: { stockOnHand: Math.max(0, newStock) }
        });

        await prisma.stockHistory.create({
          data: {
            sku: item.sku,
            changeType: 'OUT',
            quantityChange: -item.quantity,
            previousStock: variant.stockOnHand,
            newStock: Math.max(0, newStock),
            reason: `Order ${order.orderId}`,
            orderId: order.orderId
          }
        });
      }
    }

    // Create financial transactions for delivered orders
    if (status === 'DELIVERED') {
      // Revenue transaction
      await prisma.financesLedger.create({
        data: {
          transactionName: `Order Revenue - ${order.orderId}`,
          type: 'REVENUE',
          moneyIn: finalPrice,
          orderId: order.orderId
        }
      });

      // COGS transaction
      let totalCOGS = 0;
      for (const item of orderItems) {
        const variant = allVariants.find(v => v.sku === item.sku);
        if (variant) {
          totalCOGS += variant.costPrice * item.quantity;
        }
      }

      await prisma.financesLedger.create({
        data: {
          transactionName: `COGS - ${order.orderId}`,
          type: 'COGS',
          moneyOut: totalCOGS,
          orderId: order.orderId
        }
      });

      // Marketing allocation (simplified)
      const marketingCost = finalPrice * 0.05; // 5% of revenue
      await prisma.financesLedger.create({
        data: {
          transactionName: `Marketing Allocation - ${order.orderId}`,
          type: 'MARKETING',
          moneyOut: marketingCost,
          orderId: order.orderId
        }
      });
    }

    // Handle returned orders
    if (status === 'RETURNED') {
      // Return stock
      for (const item of orderItems) {
        const variant = await prisma.variants.findUnique({
          where: { sku: item.sku }
        });

        if (variant) {
          const newStock = variant.stockOnHand + item.quantity;
          await prisma.variants.update({
            where: { sku: item.sku },
            data: { stockOnHand: newStock }
          });

          await prisma.stockHistory.create({
            data: {
              sku: item.sku,
              changeType: 'IN',
              quantityChange: item.quantity,
              previousStock: variant.stockOnHand,
              newStock,
              reason: `Return from order ${order.orderId}`,
              orderId: order.orderId
            }
          });
        }
      }

      // Return fee
      await prisma.financesLedger.create({
        data: {
          transactionName: `Return Fee - ${order.orderId}`,
          type: 'RETURN_FEE',
          moneyOut: 50,
          orderId: order.orderId
        }
      });
    }
  }

  // Create some manual financial transactions
  console.log("💰 Creating manual financial transactions...");
  const manualTransactions = [
    {
      transactionName: "Office Rent - January",
      type: 'OTHER_EXPENSE',
      moneyOut: 25000
    },
    {
      transactionName: "Utility Bills - January",
      type: 'OTHER_EXPENSE', 
      moneyOut: 3500
    },
    {
      transactionName: "Bank Interest",
      type: 'OTHER_INCOME',
      moneyIn: 1200
    },
    {
      transactionName: "Equipment Purchase",
      type: 'OTHER_EXPENSE',
      moneyOut: 15000
    },
    {
      transactionName: "Freelance Design Work",
      type: 'OTHER_INCOME',
      moneyIn: 8000
    }
  ];

  for (const transaction of manualTransactions) {
    await prisma.financesLedger.create({
      data: transaction as any
    });
  }

  // Create App Settings
  console.log("⚙️ Creating app settings...");
  await prisma.appSettings.createMany({
    data: [
      { key: "default_return_fee", value: "50" },
      { key: "low_stock_threshold", value: "10" },
      { key: "default_currency", value: "DZD" },
      { key: "business_name", value: "WE Brand" },
      { key: "business_email", value: "contact@webrand.com" },
      { key: "business_phone", value: "+213-XXX-XXX-XXX" }
    ]
  });

  console.log("✅ Database seeded successfully!");
  
  // Print summary
  const counts = {
    users: await prisma.users.count(),
    products: await prisma.products.count(),
    variants: await prisma.variants.count(),
    orders: await prisma.orders.count(),
    campaigns: await prisma.marketingCampaigns.count(),
    transactions: await prisma.financesLedger.count(),
    shippingZones: await prisma.shippingZones.count()
  };

  console.log("\n📊 Seed Summary:");
  console.log(`Users: ${counts.users}`);
  console.log(`Products: ${counts.products}`);
  console.log(`Variants: ${counts.variants}`);
  console.log(`Orders: ${counts.orders}`);
  console.log(`Marketing Campaigns: ${counts.campaigns}`);
  console.log(`Financial Transactions: ${counts.transactions}`);
  console.log(`Shipping Zones: ${counts.shippingZones}`);
}

main()
  .catch((e) => {
    console.error("❌ Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });