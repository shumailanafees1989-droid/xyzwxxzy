-- ============================================================================
-- Karachi Mart - Supabase Shared Database Schema
-- Shared Source of Truth for Customer Website and Karachi Mart CRM
-- ============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. Categories Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY, -- e.g. 'grocery-staples'
    name TEXT NOT NULL,
    icon TEXT DEFAULT '🛍️',
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. Products Table (Shared with CRM for pricing & inventory control)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT UNIQUE NOT NULL, -- e.g. 'KM-GRO-001'
    name TEXT NOT NULL,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    selling_price NUMERIC(10, 2) NOT NULL CHECK (selling_price >= 0),
    compare_at_price NUMERIC(10, 2) CHECK (compare_at_price IS NULL OR compare_at_price >= selling_price),
    unit TEXT NOT NULL DEFAULT '1 Unit',
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_best_seller BOOLEAN NOT NULL DEFAULT FALSE,
    rating NUMERIC(3, 2) DEFAULT 4.8,
    reviews_count INT DEFAULT 12,
    description TEXT,
    image_url TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup and filtering
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);

-- ============================================================================
-- 4. Orders Table (Shared with CRM online orders queue)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT UNIQUE NOT NULL, -- e.g. 'KM-20261015-8492'
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    delivery_address TEXT NOT NULL,
    area TEXT NOT NULL, -- e.g. 'Gulshan-e-Iqbal', 'PECHS'
    landmark TEXT,
    delivery_slot TEXT DEFAULT 'Standard Delivery (2-3 Hours)',
    order_notes TEXT,
    payment_method TEXT NOT NULL DEFAULT 'Cash on Delivery (COD)',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled')),
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    discount NUMERIC(10, 2) DEFAULT 0,
    delivery_fee NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- ============================================================================
-- 5. Order Items Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    total_price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- ============================================================================
-- 6. Inventory Transactions Audit Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_sku TEXT NOT NULL,
    change_quantity INT NOT NULL,
    reason TEXT NOT NULL, -- 'online_order', 'crm_restock', 'spoilage_adjustment'
    reference_order_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. Row Level Security (RLS) Policies
-- Protects customer records while allowing public product queries
-- ============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

-- Categories: Public read-only
CREATE POLICY "Public can view categories" 
ON public.categories FOR SELECT 
TO anon, authenticated 
USING (true);

-- Products: Public can only view active items
CREATE POLICY "Public can view active products" 
ON public.products FOR SELECT 
TO anon, authenticated 
USING (is_active = true);

-- Orders: Public can INSERT orders during checkout
CREATE POLICY "Public can create orders" 
ON public.orders FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- Order Items: Public can INSERT order items
CREATE POLICY "Public can create order items" 
ON public.order_items FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- ============================================================================
-- 8. Privacy-Conscious Order Tracking Function (RPC)
-- Secure lookup: Returns order details ONLY if both Order # and Phone match!
-- ============================================================================
CREATE OR REPLACE FUNCTION public.track_order_secure(
    p_order_number TEXT,
    p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated rights to safely return matching order without exposing all orders
AS $$
DECLARE
    v_order RECORD;
    v_items JSONB;
    v_clean_phone TEXT;
    v_clean_order_phone TEXT;
BEGIN
    -- Strip non-numeric characters for flexible comparison
    v_clean_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');

    SELECT * INTO v_order
    FROM public.orders
    WHERE UPPER(order_number) = UPPER(TRIM(p_order_number))
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Verify customer phone number matches
    v_clean_order_phone := regexp_replace(v_order.customer_phone, '[^0-9]', '', 'g');
    IF v_clean_order_phone NOT LIKE '%' || v_clean_phone || '%' AND v_clean_phone NOT LIKE '%' || v_clean_order_phone || '%' THEN
        RETURN NULL; -- Privacy guard: phone does not match
    END IF;

    -- Fetch order items
    SELECT jsonb_agg(
        jsonb_build_object(
            'sku', product_sku,
            'name', product_name,
            'price', unit_price,
            'quantity', quantity,
            'total', total_price
        )
    ) INTO v_items
    FROM public.order_items
    WHERE order_id = v_order.id;

    RETURN jsonb_build_object(
        'orderNumber', v_order.order_number,
        'customerName', v_order.customer_name,
        'customerPhone', v_order.customer_phone,
        'area', v_order.area,
        'deliveryAddress', v_order.delivery_address,
        'deliverySlot', v_order.delivery_slot,
        'paymentMethod', v_order.payment_method,
        'status', v_order.status,
        'subtotal', v_order.subtotal,
        'discount', v_order.discount,
        'deliveryFee', v_order.delivery_fee,
        'totalAmount', v_order.total_amount,
        'createdAt', v_order.created_at,
        'items', COALESCE(v_items, '[]'::jsonb)
    );
END;
$$;

-- Grant execution to public anon role
GRANT EXECUTE ON FUNCTION public.track_order_secure(TEXT, TEXT) TO anon, authenticated;

-- ============================================================================
-- 9. Atomic Stock Deduction Function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.deduct_stock(
    p_sku TEXT,
    p_qty INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.products
    SET stock_quantity = stock_quantity - p_qty,
        updated_at = NOW()
    WHERE sku = p_sku AND stock_quantity >= p_qty;

    IF FOUND THEN
        INSERT INTO public.inventory_logs (product_sku, change_quantity, reason)
        VALUES (p_sku, -p_qty, 'online_order');
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_stock(TEXT, INT) TO anon, authenticated;

-- ============================================================================
-- 10. Seed Initial Categories
-- ============================================================================
INSERT INTO public.categories (id, name, icon, description, display_order)
VALUES
('grocery-staples', 'Grocery & Staples', '🌾', 'Flour, rice, cooking oils, and everyday Pakistani kitchen essentials', 1),
('fruits-vegetables', 'Fruits & Vegetables', '🥦', 'Farm-fresh vegetables and seasonal Pakistani fruits delivered daily', 2),
('dairy-eggs', 'Dairy & Eggs', '🥛', 'Fresh milk, farm eggs, desi butter, yogurt, and artisanal cheese', 3),
('beverages', 'Beverages', '🧃', 'Chai tea leaves, Rooh Afza, juices, mineral water, and cold drinks', 4),
('snacks-biscuits', 'Snacks & Biscuits', '🍪', 'Crisps, traditional nimco, bakery rusks, and tea-time biscuits', 5),
('household-cleaning', 'Household & Cleaning', '🧼', 'Laundry detergents, surface cleaners, dishwashing bars, and disinfectants', 6),
('personal-care', 'Personal Care', '🧴', 'Soaps, shampoos, oral hygiene, and everyday personal grooming', 7),
('frozen-food', 'Frozen Food', '❄️', 'Ready-to-fry samosas, parathas, chicken nuggets, and frozen peas', 8),
('bakery', 'Bakery', '🍞', 'Freshly baked sandwich bread, burger buns, tea cakes, and sweet buns', 9)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, icon = EXCLUDED.icon, description = EXCLUDED.description;

-- ============================================================================
-- 11. Seed Initial Karachi Mart Products (36 Items)
-- ============================================================================
INSERT INTO public.products (sku, name, category_id, selling_price, compare_at_price, unit, stock_quantity, is_featured, is_best_seller, rating, reviews_count, description, image_url)
VALUES
('KM-GRO-001', 'Sunridge Chakki Atta 100% Whole Wheat', 'grocery-staples', 1380, 1520, '10 kg Bag', 45, true, true, 4.8, 142, 'Pure whole wheat chakki atta stone-ground to perfection. High fiber, nutritious, and ideal for soft rotis.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80'),
('KM-GRO-002', 'Guard Supreme Super Basmati Rice (Aged)', 'grocery-staples', 1850, 2050, '5 kg Bag', 38, true, true, 4.9, 96, 'Extra-long grain naturally aged aromatic Basmati rice. Perfect for Karachi Biryani and Pulao.', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80'),
('KM-GRO-003', 'Dalda Premium Cooking Oil Pouch', 'grocery-staples', 2750, 2900, '5 Litres (5x1L Pouch Pack)', 22, false, true, 4.7, 88, 'Fortified with Vitamins A, D, and E. Double refined healthy cooking oil made for traditional curries.', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80'),
('KM-GRO-004', 'Shan Special Bombay Biryani Masala', 'grocery-staples', 140, NULL, '50g Box', 120, false, true, 4.9, 215, 'Authentic blend of royal aromatic spices with dried plums for Karachi-style Bombay Biryani.', 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&auto=format&fit=crop&q=80'),
('KM-GRO-005', 'Washed Daal Chana (Split Bengal Gram)', 'grocery-staples', 360, 390, '1 kg Pack', 50, false, false, 4.6, 34, 'Triple-cleaned, premium quality Daal Chana. Rich in plant protein, cooks evenly for hearty daal.', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80'),
('KM-GRO-006', 'National Refined Iodized Pink Rock Salt', 'grocery-staples', 85, NULL, '800g Pack', 95, false, false, 4.8, 52, 'Pure Himalayan mineral salt enriched with essential iodine for health and flavor.', 'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=600&auto=format&fit=crop&q=80'),
('KM-FRU-001', 'Farm Fresh Red Tomatoes (Sindh Farm)', 'fruits-vegetables', 160, 200, '1 kg', 65, true, true, 4.7, 64, 'Plump, ripe, juicy red tomatoes sourced directly from farms in interior Sindh.', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80'),
('KM-FRU-002', 'Fresh Golden Onions (Pyaz)', 'fruits-vegetables', 190, 230, '2 kg Bag', 55, false, true, 4.5, 47, 'Crisp dry golden onions essential for Pakistani handis and karahis.', 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80'),
('KM-FRU-003', 'New Crop Russet Potatoes (Aloo)', 'fruits-vegetables', 140, 170, '2 kg Bag', 70, false, false, 4.6, 39, 'Firm and starchy all-purpose potatoes. Ideal for french fries, curries, and aloo samosas.', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80'),
('KM-FRU-004', 'Sindhri Sweet Mangoes (Grade A Box)', 'fruits-vegetables', 950, 1150, '3 kg Gift Crate', 18, true, true, 5.0, 110, 'The King of Mangoes from Mirpurkhas, Sindh. Honey aroma, silky fiber-free flesh.', 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&auto=format&fit=crop&q=80'),
('KM-FRU-005', 'Fresh Cavendish Bananas (Kela)', 'fruits-vegetables', 180, 210, '1 Dozen', 40, false, false, 4.4, 29, 'Naturally sweet yellow bananas packed with energy and potassium.', 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&auto=format&fit=crop&q=80'),
('KM-DAI-001', 'Olper''s All-Purpose Full Cream Milk', 'dairy-eggs', 330, 350, '1 Litre UHT Pack', 80, true, true, 4.8, 178, 'Rich, creamy full cream milk processed through UHT technology. Perfect for karak chai.', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80'),
('KM-DAI-002', 'Farm Fresh Brown Eggs (Poultry Safe)', 'dairy-eggs', 390, 440, 'Pack of 12 (1 Dozen)', 50, false, true, 4.7, 89, 'Cleaned, high-protein farm fresh eggs with rich golden yolks.', 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?w=600&auto=format&fit=crop&q=80'),
('KM-DAI-003', 'Nurpur Pure Creamery Butter (Salted)', 'dairy-eggs', 490, 530, '200g Block', 25, false, false, 4.8, 41, 'Churned from 100% pure cow and buffalo milk with sea salt. Glides over warm parathas.', 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=600&auto=format&fit=crop&q=80'),
('KM-DAI-004', 'Adams Mature Cheddar Cheese Block', 'dairy-eggs', 880, 960, '400g Block', 16, false, false, 4.9, 38, 'Rich aged cheddar with an authentic sharp tang. Melts beautifully into omelettes.', 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=600&auto=format&fit=crop&q=80'),
('KM-BEV-001', 'Tapal Danedar Black Tea (Chai Leaves)', 'beverages', 640, 690, '450g Pouch', 65, true, true, 4.9, 230, 'Pakistan''s beloved danedar tea blend. Rich aroma, deep amber color, and signature strong taste.', 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80'),
('KM-BEV-002', 'Hamdard Rooh Afza Herbal Syrup', 'beverages', 460, 500, '800ml Bottle', 45, true, true, 4.9, 165, 'The refreshing Summer Drink of the East. Distilled from herbal essences and rose petals.', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80'),
('KM-BEV-003', 'Nestle Pure Life Mineral Water (Case)', 'beverages', 660, 720, 'Pack of 6 x 1.5 Litres', 40, false, true, 4.8, 92, 'Multi-stage purified water enhanced with balanced essential minerals.', 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80'),
('KM-BEV-004', 'Pakola Ice Cream Soda (Can Pack)', 'beverages', 450, 480, 'Pack of 6 x 250ml Cans', 35, false, false, 4.7, 74, 'The patriotic green soda of Pakistan! Velvet vanilla ice cream flavor with crisp fizz.', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80'),
('KM-SNA-001', 'Peek Freans Sooper Egg & Milk Biscuits', 'snacks-biscuits', 360, 400, 'Family Half-Roll Pack', 60, false, true, 4.8, 140, 'Pakistan''s number one biscuit. Sweet, crumbly, and melt-in-mouth egg and milk flavor.', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&auto=format&fit=crop&q=80'),
('KM-SNA-002', 'Lays Pakistan Masala Flavored Chips', 'snacks-biscuits', 130, 150, 'Large Party Pack (75g)', 55, false, true, 4.6, 88, 'Crispy potato wafers dusted with the zesty, chatpata Pakistani masala spice blend.', 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600&auto=format&fit=crop&q=80'),
('KM-SNA-003', 'Karachi Famous Burns Road Mixed Nimco', 'snacks-biscuits', 320, 370, '400g Seal Pack', 30, true, false, 4.9, 63, 'Traditional savory mix with crispy sev, roasted daal, spiced peanuts, and mild green chili.', 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=600&auto=format&fit=crop&q=80'),
('KM-HOU-001', 'Surf Excel Quick Wash Washing Powder', 'household-cleaning', 1150, 1280, '1 kg Pouch', 45, true, true, 4.8, 112, 'Advanced stain-lifting enzymes remove tough grease, oil, and mud stains in one wash cycle.', 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=600&auto=format&fit=crop&q=80'),
('KM-HOU-002', 'Harpic Power Plus Toilet Cleaner Liquid', 'household-cleaning', 490, 540, '750ml Nozzle Bottle', 50, false, true, 4.7, 76, 'Kills 99.9% of germs, removes yellow limescale, and leaves behind a sparkling bathroom.', 'https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?w=600&auto=format&fit=crop&q=80'),
('KM-HOU-003', 'Lemon Max Ultra Dishwashing Liquid Gel', 'household-cleaning', 340, 380, '475ml Bottle', 65, false, false, 4.6, 58, 'Real lime juice power cuts through heavy ghee and oily masala residues.', 'https://images.unsplash.com/photo-1585670270608-b404fb88484f?w=600&auto=format&fit=crop&q=80'),
('KM-HOU-004', 'Dettol Multi-Surface Disinfectant Floor Cleaner', 'household-cleaning', 680, 750, '1 Litre Pine Bottle', 28, false, false, 4.9, 45, 'Hospital-grade disinfectant formula safe for marble and tiled floors in Karachi homes.', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80'),
('KM-PER-001', 'Sunsilk Black Shine Shampoo (Amla & Pearl)', 'personal-care', 690, 770, '370ml Bottle', 35, false, true, 4.7, 84, 'Enriched with Amla and Pearl complex for nourished, silky, lustrous black hair.', 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=600&auto=format&fit=crop&q=80'),
('KM-PER-002', 'Dettol Original Germ Protection Soap Bar', 'personal-care', 480, 540, 'Pack of 3 x 135g Bars', 55, false, true, 4.8, 118, 'Trusted daily germ protection soap with soothing pine fragrance for family hygiene.', 'https://images.unsplash.com/photo-1607006314115-46543b591b92?w=600&auto=format&fit=crop&q=80'),
('KM-PER-003', 'Colgate Total 12 Pro Gum Health Toothpaste', 'personal-care', 380, 420, '140g Tube', 48, false, false, 4.6, 52, '12-hour antibacterial defense against plaque, cavities, tartar, and bad breath.', 'https://images.unsplash.com/photo-1559591937-e1032c253242?w=600&auto=format&fit=crop&q=80'),
('KM-FRO-001', 'K&N''s Tender Chicken Nuggets (Jumbo Box)', 'frozen-food', 1450, 1600, '1000g Family Pack', 24, true, true, 4.9, 156, 'Safe and healthy hand-deboned poultry meat in golden seasoned breadcrumbs.', 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80'),
('KM-FRO-002', 'Dawn Crispy Plain Frozen Parathas', 'frozen-food', 520, 580, 'Pack of 20 Parathas', 35, false, true, 4.8, 104, 'Flaky, multi-layered Karachi breakfast parathas. Ready in under 3 minutes with zero oil.', 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80'),
('KM-FRO-003', 'Mon Salwa Premium Beef Shami Kababs', 'frozen-food', 890, 990, 'Pack of 12 Kababs', 19, false, false, 4.7, 44, 'Minced beef, split chickpeas, mint, and spices. Crispy on outside, tender inside.', 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80'),
('KM-FRO-004', 'Farm Fresh Sweet Green Peas (Matar)', 'frozen-food', 360, NULL, '800g Frozen Bag', 4, false, false, 4.5, 31, 'Quick-frozen within hours of harvest to lock in sweetness and vitamins.', 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=600&auto=format&fit=crop&q=80'),
('KM-BAK-001', 'Dawn Large Milky Sandwich Bread', 'bakery', 190, 210, 'Large Loaf (750g)', 40, false, true, 4.7, 82, 'Freshly baked daily with wholesome milk and enriched flour. Soft, pillowy slices.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80'),
('KM-BAK-002', 'Sohny Bakers Traditional Crispy Plain Rusk', 'bakery', 260, 290, '500g Box', 35, false, false, 4.6, 49, 'Twice-baked Karachi bakery rusks with cardamom and fennel hints for evening chai.', 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600&auto=format&fit=crop&q=80'),
('KM-BAK-003', 'Freshly Baked Jumbo Sesame Burger Buns', 'bakery', 170, NULL, 'Pack of 4 Buns', 0, false, false, 4.5, 27, 'Soft glazed hamburger buns topped with toasted white sesame seeds.', 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80')
ON CONFLICT (sku) DO UPDATE 
SET selling_price = EXCLUDED.selling_price, 
    stock_quantity = EXCLUDED.stock_quantity,
    compare_at_price = EXCLUDED.compare_at_price;
