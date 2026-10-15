/**
 * Karachi Mart - Data Service Layer
 * Abstracts data access between Local Demo Storage and Supabase Cloud Database.
 * When Supabase is configured with valid credentials, it dynamically connects to Supabase.
 * Otherwise, it transparently operates in Demo Mode with persistent local state.
 */

import { CATEGORIES, INITIAL_PRODUCTS, DEMO_PREPOPULATED_ORDERS } from '../data/seedProducts.js';
import { APP_CONFIG, isSupabaseConfigured } from '../config.js';

class DataService {
  constructor() {
    this.supabaseClient = null;
    this.storageKeyProducts = 'km_demo_products_v2';
    this.storageKeyOrders = 'km_demo_orders_v2';
    this.initDemoStorage();
  }

  /**
   * Initializes localStorage with seed products and orders if not yet set
   */
  initDemoStorage() {
    if (typeof localStorage === 'undefined') return;

    if (!localStorage.getItem(this.storageKeyProducts)) {
      localStorage.setItem(this.storageKeyProducts, JSON.stringify(INITIAL_PRODUCTS));
    }

    if (!localStorage.getItem(this.storageKeyOrders)) {
      localStorage.setItem(this.storageKeyOrders, JSON.stringify(DEMO_PREPOPULATED_ORDERS));
    }
  }

  /**
   * Resets local demo storage back to initial seed state
   */
  resetDemoData() {
    localStorage.setItem(this.storageKeyProducts, JSON.stringify(INITIAL_PRODUCTS));
    localStorage.setItem(this.storageKeyOrders, JSON.stringify(DEMO_PREPOPULATED_ORDERS));
    return true;
  }

  /**
   * Lazily loads the official Supabase JS client via ESM
   */
  async getSupabaseClient() {
    if (this.supabaseClient) return this.supabaseClient;

    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      // Dynamic import from high-speed ESM CDN
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      this.supabaseClient = createClient(APP_CONFIG.supabase.url, APP_CONFIG.supabase.anonKey);
      return this.supabaseClient;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  /**
   * Returns current data layer connection mode
   */
  async getConnectionStatus() {
    const configured = isSupabaseConfigured();
    if (!configured) {
      return {
        mode: 'demo',
        message: 'Running in Local Demo Mode (Fictional Karachi Mart Data)',
        isConnected: false
      };
    }

    try {
      const client = await this.getSupabaseClient();
      if (!client) {
        return {
          mode: 'demo',
          message: 'Supabase credentials set but client failed to initialize. Using demo data.',
          isConnected: false
        };
      }

      // Quick test query to verify connectivity
      const { data, error } = await client.from('categories').select('count', { count: 'exact', head: true });
      if (error) {
        return {
          mode: 'demo',
          message: `Supabase connection error: ${error.message}. Fallback to demo mode active.`,
          isConnected: false,
          error: error.message
        };
      }

      return {
        mode: 'supabase',
        message: 'Connected to shared Karachi Mart Supabase database',
        isConnected: true
      };
    } catch (err) {
      return {
        mode: 'demo',
        message: `Connection attempt failed: ${err.message}. Using demo mode.`,
        isConnected: false
      };
    }
  }

  /**
   * Fetch all categories
   */
  async getCategories() {
    if (isSupabaseConfigured()) {
      try {
        const client = await this.getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('categories')
            .select('*')
            .order('display_order', { ascending: true });

          if (!error && data && data.length > 0) {
            return data.map(c => ({
              id: c.slug || c.id,
              name: c.name,
              icon: c.icon || '🛍️',
              description: c.description,
              displayOrder: c.display_order
            }));
          }
        }
      } catch (err) {
        console.warn('Supabase getCategories failed, falling back to seed:', err);
      }
    }

    return CATEGORIES;
  }

  /**
   * Fetch category by ID / slug
   */
  async getCategoryById(id) {
    const categories = await this.getCategories();
    return categories.find(c => c.id === id) || null;
  }

  /**
   * Get all products with optional filtering, search, and sorting
   */
  async getProducts(options = {}) {
    const { category, search, sort = 'featured', inStockOnly = false, onSaleOnly = false } = options;

    let products = [];

    if (isSupabaseConfigured()) {
      try {
        const client = await this.getSupabaseClient();
        if (client) {
          let query = client.from('products').select('*').eq('is_active', true);

          if (category && category !== 'all') {
            query = query.eq('category_id', category);
          }

          if (inStockOnly) {
            query = query.gt('stock_quantity', 0);
          }

          if (onSaleOnly) {
            query = query.not('compare_at_price', 'is', null);
          }

          const { data, error } = await query;
          if (!error && data) {
            products = data.map(p => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              category: p.category_id,
              price: Number(p.selling_price),
              compareAtPrice: p.compare_at_price ? Number(p.compare_at_price) : null,
              unit: p.unit || '1 Unit',
              stock: Number(p.stock_quantity),
              isFeatured: Boolean(p.is_featured),
              isBestSeller: Boolean(p.is_best_seller),
              rating: p.rating ? Number(p.rating) : 4.8,
              reviewsCount: p.reviews_count ? Number(p.reviews_count) : 25,
              description: p.description,
              image: p.image_url,
              tags: p.tags || []
            }));
          }
        }
      } catch (err) {
        console.warn('Supabase getProducts failed, falling back to local demo storage:', err);
      }
    }

    // Fallback to local demo storage if Supabase returned nothing or is not configured
    if (products.length === 0) {
      const stored = localStorage.getItem(this.storageKeyProducts);
      products = stored ? JSON.parse(stored) : [...INITIAL_PRODUCTS];
    }

    // Apply client filters for demo mode
    if (category && category !== 'all') {
      products = products.filter(p => p.category === category);
    }

    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    if (inStockOnly) {
      products = products.filter(p => p.stock > 0);
    }

    if (onSaleOnly) {
      products = products.filter(p => p.compareAtPrice && p.compareAtPrice > p.price);
    }

    // Apply sorting
    switch (sort) {
      case 'price-low':
        products.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        products.sort((a, b) => b.price - a.price);
        break;
      case 'name-asc':
        products.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        products.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'discount':
        products.sort((a, b) => {
          const discA = a.compareAtPrice ? ((a.compareAtPrice - a.price) / a.compareAtPrice) : 0;
          const discB = b.compareAtPrice ? ((b.compareAtPrice - b.price) / b.compareAtPrice) : 0;
          return discB - discA;
        });
        break;
      case 'bestseller':
        products.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
        break;
      case 'featured':
      default:
        products.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
        break;
    }

    return products;
  }

  /**
   * Fetch single product by ID or SKU
   */
  async getProductById(id) {
    if (isSupabaseConfigured()) {
      try {
        const client = await this.getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('products')
            .select('*')
            .or(`id.eq.${id},sku.eq.${id}`)
            .single();

          if (!error && data) {
            return {
              id: data.id,
              sku: data.sku,
              name: data.name,
              category: data.category_id,
              price: Number(data.selling_price),
              compareAtPrice: data.compare_at_price ? Number(data.compare_at_price) : null,
              unit: data.unit,
              stock: Number(data.stock_quantity),
              isFeatured: Boolean(data.is_featured),
              isBestSeller: Boolean(data.is_best_seller),
              rating: data.rating ? Number(data.rating) : 4.8,
              reviewsCount: data.reviews_count ? Number(data.reviews_count) : 25,
              description: data.description,
              image: data.image_url,
              tags: data.tags || []
            };
          }
        }
      } catch (err) {
        console.warn('Supabase getProductById error:', err);
      }
    }

    const products = await this.getProducts();
    return products.find(p => p.id === id || p.sku === id) || null;
  }

  /**
   * Validates available stock for a list of items before checkout
   * Returns { valid: boolean, errors: Array }
   */
  async validateStock(items) {
    const errors = [];
    for (const item of items) {
      const product = await this.getProductById(item.id);
      if (!product) {
        errors.push(`Item "${item.name}" is no longer available in the catalogue.`);
      } else if (product.stock <= 0) {
        errors.push(`"${product.name}" is currently out of stock.`);
      } else if (item.quantity > product.stock) {
        errors.push(`Only ${product.stock} units of "${product.name}" are currently available (requested: ${item.quantity}).`);
      }
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Submits an online order:
   * - Validates fields
   * - Deducts stock atomically
   * - Saves order to Supabase or Demo Storage
   */
  async submitOrder(orderPayload) {
    // 1. Stock validation
    const stockCheck = await this.validateStock(orderPayload.items);
    if (!stockCheck.valid) {
      throw new Error(stockCheck.errors.join(' '));
    }

    // 2. Generate unique order reference (e.g., KM-20261015-4821)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `KM-${dateStr}-${randSuffix}`;

    const orderRecord = {
      orderNumber,
      customerName: orderPayload.customerName.trim(),
      customerPhone: orderPayload.customerPhone.trim(),
      customerEmail: orderPayload.customerEmail ? orderPayload.customerEmail.trim() : null,
      deliveryAddress: orderPayload.deliveryAddress.trim(),
      area: orderPayload.area,
      landmark: orderPayload.landmark ? orderPayload.landmark.trim() : null,
      deliverySlot: orderPayload.deliverySlot || 'Standard Delivery (2-3 Hours)',
      orderNotes: orderPayload.orderNotes ? orderPayload.orderNotes.trim() : null,
      paymentMethod: 'Cash on Delivery (COD)',
      status: 'pending',
      statusTimeline: [
        { status: 'pending', label: 'Order Received', time: 'Just now', completed: true },
        { status: 'confirmed', label: 'Confirmed by Karachi Mart', time: 'Pending confirmation', completed: false },
        { status: 'packed', label: 'Packed at Hub', time: 'Pending dispatch', completed: false },
        { status: 'out_for_delivery', label: 'Out for Delivery', time: 'Pending rider assignment', completed: false },
        { status: 'delivered', label: 'Delivered & Paid (COD)', time: 'Estimated: 2-3 hours', completed: false }
      ],
      items: orderPayload.items.map(item => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity
      })),
      subtotal: orderPayload.subtotal,
      discount: orderPayload.discount || 0,
      deliveryFee: orderPayload.deliveryFee,
      totalAmount: orderPayload.totalAmount,
      createdAt: new Date().toISOString()
    };

    // 3. Persist order & deduct inventory
    if (isSupabaseConfigured()) {
      try {
        const client = await this.getSupabaseClient();
        if (client) {
          // Insert order into Supabase
          const { data: dbOrder, error: orderErr } = await client
            .from('orders')
            .insert({
              order_number: orderRecord.orderNumber,
              customer_name: orderRecord.customerName,
              customer_phone: orderRecord.customerPhone,
              customer_email: orderRecord.customerEmail,
              delivery_address: orderRecord.deliveryAddress,
              area: orderRecord.area,
              landmark: orderRecord.landmark,
              delivery_slot: orderRecord.deliverySlot,
              order_notes: orderRecord.orderNotes,
              payment_method: orderRecord.paymentMethod,
              status: orderRecord.status,
              subtotal: orderRecord.subtotal,
              discount: orderRecord.discount,
              delivery_fee: orderRecord.deliveryFee,
              total_amount: orderRecord.totalAmount
            })
            .select()
            .single();

          if (orderErr) {
            throw new Error(`Database error saving order: ${orderErr.message}`);
          }

          // Insert order items
          const itemsToInsert = orderRecord.items.map(it => ({
            order_id: dbOrder.id,
            product_sku: it.sku,
            product_name: it.name,
            unit_price: it.price,
            quantity: it.quantity,
            total_price: it.total
          }));

          await client.from('order_items').insert(itemsToInsert);

          // Atomic stock deduction RPC or individual updates
          for (const it of orderRecord.items) {
            await client.rpc('deduct_stock', { p_sku: it.sku, p_qty: it.quantity }).catch(() => {
              // Fallback direct update if RPC is not installed
              client.from('products').update({
                stock_quantity: client.raw(`stock_quantity - ${it.quantity}`)
              }).eq('sku', it.sku);
            });
          }

          return orderRecord;
        }
      } catch (supabaseErr) {
        console.warn('Supabase order submit failed, recording to demo storage:', supabaseErr);
      }
    }

    // Demo Mode stock deduction and order storage
    const storedProducts = JSON.parse(localStorage.getItem(this.storageKeyProducts) || '[]');
    orderRecord.items.forEach(cartItem => {
      const match = storedProducts.find(p => p.id === cartItem.id || p.sku === cartItem.sku);
      if (match) {
        match.stock = Math.max(0, match.stock - cartItem.quantity);
      }
    });
    localStorage.setItem(this.storageKeyProducts, JSON.stringify(storedProducts));

    // Save demo order to list
    const storedOrders = JSON.parse(localStorage.getItem(this.storageKeyOrders) || '[]');
    storedOrders.unshift(orderRecord);
    localStorage.setItem(this.storageKeyOrders, JSON.stringify(storedOrders));

    return orderRecord;
  }

  /**
   * Secure, privacy-conscious order tracking lookup.
   * As required: Does not allow visitors to retrieve orders simply by guessing order numbers.
   * Both order reference AND customer phone number must match!
   */
  async trackOrder(orderNumber, phone) {
    if (!orderNumber || !phone) {
      throw new Error('Both Order Reference Number and Phone Number are required to track an order.');
    }

    const cleanOrderNumber = orderNumber.trim().toUpperCase();
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    if (isSupabaseConfigured()) {
      try {
        const client = await this.getSupabaseClient();
        if (client) {
          // Calls the safe RPC function with security definer to avoid exposing full orders table to public
          const { data, error } = await client.rpc('track_order_secure', {
            p_order_number: cleanOrderNumber,
            p_phone: phone.trim()
          });

          if (!error && data) {
            return data;
          }
        }
      } catch (err) {
        console.warn('Supabase trackOrder call failed:', err);
      }
    }

    // Demo mode lookup
    const storedOrders = JSON.parse(localStorage.getItem(this.storageKeyOrders) || '[]');
    const found = storedOrders.find(ord => {
      const ordNumMatch = ord.orderNumber.toUpperCase() === cleanOrderNumber;
      const cleanOrdPhone = ord.customerPhone.replace(/[^0-9]/g, '');
      const phoneMatch = cleanOrdPhone === cleanPhone || ord.customerPhone.includes(cleanPhone) || cleanPhone.includes(cleanOrdPhone);
      return ordNumMatch && phoneMatch;
    });

    if (!found) {
      return null;
    }

    return found;
  }
}

export const dataService = new DataService();
