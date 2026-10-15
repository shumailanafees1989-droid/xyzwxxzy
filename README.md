# 🛒 Karachi Mart — Supermarket Website

A modern, responsive e-commerce web application for **Karachi Mart**, a fictional supermarket serving customers in Karachi, Sindh, Pakistan.

This is the customer-facing online storefront for your portfolio. It functions immediately in **Demo Mode** with persistent local storage and 36 authentic Pakistani supermarket items, and is pre-architected to seamlessly connect to a separate **Karachi Mart CRM** using a shared Supabase database.

---

## 🌟 Key Features

- **Karachi-Tailored Shopping Experience**:
  - Currency displayed in Pakistani Rupees (`PKR / Rs.`).
  - Realistic Karachi fulfillment areas: *Gulshan-e-Iqbal, North Nazimabad, PECHS, Federal B Area, Bahadurabad, DHA Karachi, Clifton, Gulistan-e-Johar, Malir, Saddar, etc.*
  - Local brand staples: Sunridge Chakki Atta, Guard Basmati Rice, Dalda Cooking Oil, Olper's Milk, Tapal Danedar Tea, Hamdard Rooh Afza, K&N's Nuggets, Dawn Bread, and Sindhri Mangoes.
- **Complete Product Catalogue (9 Categories & 36+ Products)**:
  1. Grocery & Staples
  2. Fruits & Vegetables
  3. Dairy & Eggs
  4. Beverages & Chai
  5. Snacks & Biscuits
  6. Household Cleaning
  7. Personal Care
  8. Frozen Food
  9. Bakery
- **Full E-Commerce Journey**:
  - Live search with instant filtering and clear results counts.
  - Category filters, stock filters, sale filters, and 6 sorting modes (Price, Name, Discount, Best Sellers).
  - Product Quick View modal and dedicated Product Detail pages (`#product/:id`).
  - Slide-out Cart Drawer and full Shopping Cart page (`#cart`).
  - Stock availability validation (prevents ordering quantities greater than available inventory).
  - Promotional discount codes:
    - `WELCOME100`: Rs. 100 OFF on orders above Rs. 1,000
    - `KARACHI10`: 10% OFF on orders above Rs. 1,500
    - `FREEDELIVERY`: Free express delivery on any order
    - `SUPERMARKET`: Rs. 250 OFF on orders above Rs. 3,000
  - Free delivery threshold progress bar (Free delivery in Karachi on orders over Rs. 2,000; otherwise flat Rs. 150).
- **Express Checkout**:
  - Pakistani phone validation (`03XX-XXXXXXX`).
  - Karachi area selector, landmark, and delivery time slot selection.
  - Cash on Delivery (COD) demo payment method with zero sensitive card data collection.
  - Atomic stock deduction upon order completion.
- **Privacy-Conscious Order Tracking**:
  - Lookups require **both** Order Reference Number (e.g. `KM-20261015-8492`) **and** the customer's phone number, protecting customer privacy and preventing unauthorized order snooping.
  - Multi-step status timeline: *Order Placed → Confirmed → Packed at Hub → Out for Delivery (Rider Assigned) → Delivered*.
- **Shared Database Architecture (Supabase & CRM Ready)**:
  - Ready to share the exact same PostgreSQL database with Karachi Mart CRM.
  - Complete SQL migration script (`supabase_schema.sql`) with Row Level Security (RLS) policies, secure tracking RPC, and atomic stock deduction functions.

---

## 🚀 Quick Start (Running Locally)

### Option 1: Using the Built-In Local Server (Recommended for Windows)

Zero external dependencies or Node installations required! Run this command in PowerShell from the project folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1
```

Then open your browser at:
```
http://localhost:3000/#home
```

*(If port 3000 is occupied, it automatically falls back to port 8080).*

---

### Option 2: Using Node / NPM (If Node.js is Installed)

```bash
# Start local server
npm run dev

# Or using npx serve
npx -y serve .
```

---

### Option 3: Direct File Open

Because Karachi Mart is built using standard HTML5 and modern ES Modules, you can also host the folder with VS Code Live Server, Python HTTP server (`python -m http.server 3000`), or any static web host.

---

## 🗄️ Connecting to Supabase & Karachi Mart CRM

Karachi Mart is engineered to operate in **dual mode**:
1. **Demo Mode (Active by default)**: Runs locally using localStorage with 36 initial Pakistani supermarket items, persistent order creation, and stock reservation.
2. **Supabase Mode**: Connects live to your cloud Supabase database, sharing real-time products, pricing, stock levels, and online orders with the Karachi Mart CRM.

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Choose your preferred region and database password.

### Step 2: Run the Database Schema

1. Open your Supabase Dashboard and click on the **SQL Editor** tab on the left menu.
2. Click **New Query**.
3. Open the file [`supabase_schema.sql`](./supabase_schema.sql) in this repository, copy its entire contents, paste it into the Supabase SQL Editor, and click **Run**.
4. This will create:
   - `categories` table with default categories.
   - `products` table with all 36 initial items.
   - `orders` & `order_items` tables for customer checkout.
   - `inventory_logs` audit log table.
   - Row Level Security (RLS) policies ensuring safe public access to products while securing orders.
   - `track_order_secure` RPC function for privacy-safe order lookups.
   - `deduct_stock` function for atomic inventory reduction.

### Step 3: Connect the Website to Supabase

You can connect in two easy ways:

#### Method A: Directly from the Website UI (No Code Changes Needed!)
1. Open the website in your browser.
2. Scroll to the footer and click the **Database Status button** (`Database: Demo Mode ⚙️`).
3. Enter your **Supabase Project URL** (e.g. `https://xyzcompany.supabase.co`) and **Supabase Anon / Public Key**.
4. Click **Save & Connect**. The website will test the connection and switch to live database mode!

#### Method B: Via Environment File
Copy `.env.example` to `.env` and fill in your keys:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_public_anon_key_here
```

### Step 4: Shared CRM Integration Workflow

- **Shared Products & Prices**: When the Karachi Mart CRM updates a product's price or restocks inventory in the `products` table, the customer website immediately displays the updated price and stock level upon refresh.
- **Online Orders in CRM**: When a customer places an order on this website, a new row is created in `orders` and `order_items`. This order instantly appears in the CRM's order fulfillment queue.
- **Stock Synchronization**: Placing an order atomically decrements `stock_quantity` in the database, preventing double deductions or overselling.

---

## 🧪 Testing the Website (Checklist)

1. **Browse Catalogue**: Navigate between categories (Groceries, Dairy, Beverages, etc.) and test the search bar (e.g., search `"atta"`, `"milk"`, or `"biryani"`).
2. **Stock & Out-of-Stock**: Observe the `"Freshly Baked Jumbo Sesame Burger Buns"` (marked Out of Stock with disabled add button) vs low-stock items (`"Matar"`).
3. **Cart & Promo Codes**:
   - Add items to your cart.
   - Test adding more than the available stock to verify the inventory cap.
   - Open `#cart` and apply promo code `WELCOME100` or `KARACHI10`.
4. **Checkout**:
   - Go to `#checkout`.
   - Enter your name, Pakistani phone number (`0300-1234567`), address, and choose a Karachi delivery area.
   - Click **Confirm & Place Order**.
5. **Confirmation & Receipt**:
   - View your generated Order Reference (e.g. `KM-20261015-XXXX`).
   - Click **Print Receipt** to view the printable invoice layout.
6. **Order Tracking**:
   - Navigate to `#tracking`.
   - Click one of the pre-populated sample test order buttons or enter your new order reference + phone number.
   - Observe the interactive 5-stage progress timeline and delivery slot.

---

## 📦 Project Structure

```
karachi art website/
├── index.html                 # Main entry point with SPA layout & modals
├── supabase_schema.sql        # Full Supabase DDL, RLS, functions & seed data
├── vercel.json                # Vercel deployment & SPA routing rewrites
├── .env.example               # Environment variables template
├── .gitignore                 # Excludes .env, build output, and archives
├── package.json               # NPM scripts & project metadata
├── server.ps1                 # Lightweight local development server
├── README.md                  # This documentation file
└── src/
    ├── css/
    │   ├── variables.css      # Design tokens (green palette, shadows, typography)
    │   ├── base.css           # Resets, typography, and toast notifications
    │   ├── components.css     # Buttons, product cards, badges, stepper, modals
    │   ├── layout.css         # Header, navbar, announcement bar, footer
    │   ├── pages.css          # Hero banner, shop filters, checkout, tracking timeline
    │   └── style.css          # Main stylesheet combining all CSS modules
    └── js/
        ├── config.js          # App settings, brand info, promo codes & Supabase config
        ├── router.js          # Client-side hash/SPA router with deep-link support
        ├── app.js             # Main application controller & page view renderers
        ├── data/
        │   └── seedProducts.js# 36 authentic Pakistani grocery items & Karachi areas
        └── services/
            ├── dataService.js # Unified data layer (Demo Mode <-> Supabase live)
            ├── cartService.js # Shopping cart state, stock validation & discount logic
            └── toastService.js# Floating user notifications
```

---

## 🚀 Deployment to Vercel

This repository is pre-configured with `vercel.json` for instant deployment:

1. Push your repository to **GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Karachi Mart Supermarket website"
   git branch -M main
   git remote add origin https://github.com/your-username/karachi-mart-supermarket.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
3. Import your GitHub repository.
4. (Optional) Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Environment Variables.
5. Click **Deploy**. Vercel will deploy the site globally in seconds with all routes functioning seamlessly!

---

## 📄 License & Attribution

Created for portfolio demonstration purposes. All brand names (e.g., Dalda, Olper's, Shan, Tapal, Sunridge, Dawn) are trademarks of their respective owners and used solely for authentic local portfolio realism.
