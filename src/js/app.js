/**
 * Karachi Mart - Main Application Logic
 * Coordinates rendering of all views, cart actions, modals, filters,
 * checkout validation, order confirmation, and privacy-conscious tracking.
 */

import { APP_CONFIG, isSupabaseConfigured, setSupabaseConfig, clearSupabaseConfig } from './config.js';
import { CATEGORIES, KARACHI_AREAS } from './data/seedProducts.js';
import { dataService } from './services/dataService.js';
import { cartService } from './services/cartService.js';
import { toast } from './services/toastService.js';
import { router } from './router.js';

class App {
  constructor() {
    this.selectedArea = localStorage.getItem('km_selected_area') || 'Gulshan-e-Iqbal';
    this.appContent = null;
    this.cartDrawer = null;
    this.quickViewModal = null;
    this.locationModal = null;
    this.dbStatusModal = null;
  }

  async init() {
    this.appContent = document.getElementById('app-content');
    this.cartDrawer = document.getElementById('cart-drawer');
    this.quickViewModal = document.getElementById('quick-view-modal');
    this.locationModal = document.getElementById('location-modal');
    this.dbStatusModal = document.getElementById('db-status-modal');

    this.setupGlobalListeners();
    this.setupCartSubscription();
    this.setupRouting();
    this.updateHeaderLocationDisplay();
    this.updateFooterDbStatus();
  }

  // ==========================================================================
  // Global Event Listeners & Modals
  // ==========================================================================
  setupGlobalListeners() {
    // Cart drawer toggle
    const cartTriggerBtns = document.querySelectorAll('[data-action="open-cart"]');
    cartTriggerBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openCartDrawer();
      });
    });

    const closeCartBtn = document.getElementById('close-cart-btn');
    const drawerOverlay = document.getElementById('drawer-overlay');
    if (closeCartBtn) closeCartBtn.addEventListener('click', () => this.closeCartDrawer());
    if (drawerOverlay) drawerOverlay.addEventListener('click', () => this.closeCartDrawer());

    // Location selector toggle
    const locationTrigger = document.getElementById('header-location-btn');
    if (locationTrigger) {
      locationTrigger.addEventListener('click', () => this.openLocationModal());
    }

    const closeLocationBtn = document.getElementById('close-location-btn');
    const locationOverlay = document.getElementById('location-modal-overlay');
    if (closeLocationBtn) closeLocationBtn.addEventListener('click', () => this.closeLocationModal());
    if (locationOverlay) locationOverlay.addEventListener('click', (e) => {
      if (e.target === locationOverlay) this.closeLocationModal();
    });

    // Quick view close
    const closeQuickViewBtn = document.getElementById('close-quickview-btn');
    const quickViewOverlay = document.getElementById('quickview-overlay');
    if (closeQuickViewBtn) closeQuickViewBtn.addEventListener('click', () => this.closeQuickViewModal());
    if (quickViewOverlay) quickViewOverlay.addEventListener('click', (e) => {
      if (e.target === quickViewOverlay) this.closeQuickViewModal();
    });

    // DB Status modal toggle
    const dbStatusTrigger = document.getElementById('footer-db-btn');
    if (dbStatusTrigger) {
      dbStatusTrigger.addEventListener('click', () => this.openDbStatusModal());
    }
    const closeDbStatusBtn = document.getElementById('close-db-status-btn');
    const dbStatusOverlay = document.getElementById('db-status-overlay');
    if (closeDbStatusBtn) closeDbStatusBtn.addEventListener('click', () => this.closeDbStatusModal());
    if (dbStatusOverlay) dbStatusOverlay.addEventListener('click', (e) => {
      if (e.target === dbStatusOverlay) this.closeDbStatusModal();
    });

    // Header search form
    const headerSearchForm = document.getElementById('header-search-form');
    if (headerSearchForm) {
      headerSearchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('header-search-input');
        const query = input?.value?.trim() || '';
        router.navigate(`shop?search=${encodeURIComponent(query)}`);
      });
    }

    // Escape key closes modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeCartDrawer();
        this.closeQuickViewModal();
        this.closeLocationModal();
        this.closeDbStatusModal();
      }
    });
  }

  setupCartSubscription() {
    cartService.subscribe((summary) => {
      // Update badge counts
      const badges = document.querySelectorAll('.cart-badge-count');
      badges.forEach(b => {
        b.textContent = summary.totalItemsCount;
        b.style.display = summary.totalItemsCount > 0 ? 'inline-flex' : 'none';
      });

      // Update cart drawer body
      this.renderCartDrawerContent(summary);
    });
  }

  // ==========================================================================
  // Modals & Drawers Controls
  // ==========================================================================
  openCartDrawer() {
    if (this.cartDrawer) {
      this.cartDrawer.classList.add('active');
      document.getElementById('drawer-overlay')?.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  closeCartDrawer() {
    if (this.cartDrawer) {
      this.cartDrawer.classList.remove('active');
      document.getElementById('drawer-overlay')?.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  openLocationModal() {
    if (this.locationModal) {
      this.renderLocationOptions();
      this.locationModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  closeLocationModal() {
    if (this.locationModal) {
      this.locationModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  async openQuickView(productId) {
    const product = await dataService.getProductById(productId);
    if (!product) {
      toast.error('Product details unavailable.');
      return;
    }

    const modalBody = document.getElementById('quick-view-body');
    if (!modalBody) return;

    const discountPercent = product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : null;

    modalBody.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; align-items: center;">
        <div style="position: relative; border-radius: var(--radius-lg); overflow: hidden; background: #f8fafc; border: 1px solid var(--color-border);">
          <img src="${product.image}" alt="${product.name}" style="width: 100%; height: 320px; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80'">
          ${discountPercent ? `<span class="badge badge-sale" style="position: absolute; top: 1rem; left: 1rem;">-${discountPercent}% OFF</span>` : ''}
        </div>
        <div>
          <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 0.35rem; display: flex; gap: 0.5rem; align-items: center;">
            <span class="product-card-sku">${product.sku}</span>
            <span>•</span>
            <span style="text-transform: capitalize;">${product.category.replace('-', ' ')}</span>
          </div>
          <h2 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem; line-height: 1.3;">${product.name}</h2>
          <div style="font-size: 0.9rem; color: var(--color-text-muted); margin-bottom: 1rem;">Weight / Unit: <strong>${product.unit}</strong></div>
          <div style="display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 1.25rem;">
            <span style="font-size: 1.75rem; font-weight: 800; color: var(--color-primary-800);">Rs. ${product.price.toLocaleString()}</span>
            ${product.compareAtPrice ? `<span style="font-size: 1.1rem; color: var(--color-text-light); text-decoration: line-through;">Rs. ${product.compareAtPrice.toLocaleString()}</span>` : ''}
          </div>
          <p style="font-size: 0.95rem; color: var(--color-text-body); line-height: 1.6; margin-bottom: 1.5rem;">${product.description}</p>
          <div style="margin-bottom: 1.5rem;">
            <span class="badge ${product.stock > 5 ? 'badge-instock' : product.stock > 0 ? 'badge-lowstock' : 'badge-outofstock'}">
              ${product.stock > 5 ? '✓ In Stock' : product.stock > 0 ? `⚠ Only ${product.stock} Left` : '✕ Out of Stock'}
            </span>
          </div>
          <div style="display: flex; gap: 1rem; align-items: center;">
            <div class="quantity-stepper">
              <button class="quantity-btn" id="modal-qty-minus" ${product.stock <= 0 ? 'disabled' : ''}>-</button>
              <input type="number" class="quantity-input" id="modal-qty-val" value="1" min="1" max="${product.stock}" readonly>
              <button class="quantity-btn" id="modal-qty-plus" ${product.stock <= 0 ? 'disabled' : ''}>+</button>
            </div>
            <button class="btn btn-primary" id="modal-add-btn" style="flex: 1;" ${product.stock <= 0 ? 'disabled' : ''}>
              ${product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
            </button>
          </div>
        </div>
      </div>
    `;

    // Quantity buttons
    const qtyInput = modalBody.querySelector('#modal-qty-val');
    const minusBtn = modalBody.querySelector('#modal-qty-minus');
    const plusBtn = modalBody.querySelector('#modal-qty-plus');
    const addBtn = modalBody.querySelector('#modal-add-btn');

    if (minusBtn && plusBtn && qtyInput && addBtn) {
      minusBtn.addEventListener('click', () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val > 1) qtyInput.value = val - 1;
      });
      plusBtn.addEventListener('click', () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val < product.stock) qtyInput.value = val + 1;
        else toast.warning(`Only ${product.stock} units available in stock.`);
      });
      addBtn.addEventListener('click', async () => {
        const qty = parseInt(qtyInput.value) || 1;
        const success = await cartService.addItem(product, qty);
        if (success) {
          this.closeQuickViewModal();
        }
      });
    }

    this.quickViewModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeQuickViewModal() {
    if (this.quickViewModal) {
      this.quickViewModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  renderLocationOptions() {
    const listContainer = document.getElementById('location-areas-list');
    if (!listContainer) return;

    listContainer.innerHTML = KARACHI_AREAS.map(area => `
      <button class="filter-item-btn ${this.selectedArea === area.name ? 'active' : ''}" style="width: 100%; justify-content: space-between; padding: 0.75rem 1rem; border: 1px solid var(--color-border); border-radius: var(--radius-md);" data-area-name="${area.name}">
        <div>
          <div style="font-weight: 700; color: var(--color-text-main);">${area.name}</div>
          <div style="font-size: 0.78rem; color: var(--color-text-muted);">Est. Delivery: ${area.deliveryTimeEst} • Zone: ${area.deliveryZone}</div>
        </div>
        ${this.selectedArea === area.name ? '<span style="color: var(--color-primary-600); font-weight: bold;">✓ Selected</span>' : ''}
      </button>
    `).join('');

    listContainer.querySelectorAll('[data-area-name]').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-area-name');
        this.selectedArea = name;
        localStorage.setItem('km_selected_area', name);
        this.updateHeaderLocationDisplay();
        this.closeLocationModal();
        toast.success(`Delivery location set to ${name}, Karachi.`);
      });
    });
  }

  updateHeaderLocationDisplay() {
    const el = document.getElementById('selected-location-text');
    if (el) {
      el.textContent = this.selectedArea;
    }
  }

  openDbStatusModal() {
    if (this.dbStatusModal) {
      this.renderDbStatusModalContent();
      this.dbStatusModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  closeDbStatusModal() {
    if (this.dbStatusModal) {
      this.dbStatusModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  async renderDbStatusModalContent() {
    const body = document.getElementById('db-status-body');
    if (!body) return;

    const status = await dataService.getConnectionStatus();
    const isConnected = status.isConnected;

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="width: 60px; height: 60px; border-radius: 50%; background: ${isConnected ? 'var(--color-primary-100)' : 'var(--color-accent-100)'}; color: ${isConnected ? 'var(--color-primary-700)' : 'var(--color-accent-700)'}; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin: 0 auto 1rem;">
          ${isConnected ? '⚡' : '💾'}
        </div>
        <h3 style="font-size: 1.35rem; margin-bottom: 0.35rem;">
          ${isConnected ? 'Supabase Database Connected' : 'Local Demo Mode Active'}
        </h3>
        <p style="font-size: 0.9rem; color: var(--color-text-muted);">
          ${status.message}
        </p>
      </div>

      <div style="background: var(--color-surface-bg); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem; font-size: 0.88rem;">
        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; font-weight: 700;">How Karachi Mart Shared Database Works:</h4>
        <ul style="list-style: disc; margin-left: 1.25rem; color: var(--color-text-body); line-height: 1.6;">
          <li>In <strong>Demo Mode</strong>, 36 authentic Pakistani supermarket items are stored in persistent local memory. Orders decrement stock, and order tracking is fully functional.</li>
          <li>In <strong>Supabase Mode</strong>, products, prices, stock levels, and online orders share the exact same PostgreSQL database with the Karachi Mart CRM.</li>
          <li>When CRM updates a product price or inventory, this customer website reflects changes immediately upon refresh.</li>
        </ul>
      </div>

      <form id="supabase-config-form" style="margin-bottom: 1.5rem;">
        <div class="form-group">
          <label class="form-label" for="cfg-sb-url">Supabase Project URL</label>
          <input type="url" id="cfg-sb-url" class="form-control" placeholder="https://your-project.supabase.co" value="${APP_CONFIG.supabase.url || ''}">
        </div>
        <div class="form-group">
          <label class="form-label" for="cfg-sb-key">Supabase Public Anon Key</label>
          <input type="text" id="cfg-sb-key" class="form-control" placeholder="eyJhbGciOi..." value="${APP_CONFIG.supabase.anonKey || ''}">
          <div class="form-hint">Only use the safe public anon/publishable key. Never expose your service-role key.</div>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button type="submit" class="btn btn-primary" style="flex: 1;">Save & Connect</button>
          ${APP_CONFIG.supabase.url ? `<button type="button" id="cfg-sb-disconnect" class="btn btn-secondary">Disconnect</button>` : ''}
        </div>
      </form>

      <div style="border-top: 1px solid var(--color-border); padding-top: 1.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.85rem; color: var(--color-text-muted);">Reset Demo Stock & Orders</span>
        <button type="button" id="cfg-reset-demo-btn" class="btn btn-secondary btn-sm">Reset Demo Data</button>
      </div>
    `;

    // Form handlers
    const form = body.querySelector('#supabase-config-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = body.querySelector('#cfg-sb-url')?.value?.trim();
        const key = body.querySelector('#cfg-sb-key')?.value?.trim();
        if (url && key) {
          setSupabaseConfig(url, key);
          toast.success('Supabase configuration saved! Testing connection...');
          await this.updateFooterDbStatus();
          this.closeDbStatusModal();
          router.handleRoute(); // Refresh current view
        } else {
          toast.error('Please enter both Supabase URL and Anon Key.');
        }
      });
    }

    const disconnectBtn = body.querySelector('#cfg-sb-disconnect');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => {
        clearSupabaseConfig();
        toast.info('Disconnected from Supabase. Reverted to Local Demo Mode.');
        this.updateFooterDbStatus();
        this.closeDbStatusModal();
        router.handleRoute();
      });
    }

    const resetBtn = body.querySelector('#cfg-reset-demo-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        dataService.resetDemoData();
        cartService.clearCart();
        toast.success('Local demo products, stock, and sample orders reset to original state.');
        this.closeDbStatusModal();
        router.handleRoute();
      });
    }
  }

  async updateFooterDbStatus() {
    const dot = document.getElementById('footer-db-dot');
    const text = document.getElementById('footer-db-text');
    if (!dot || !text) return;

    const status = await dataService.getConnectionStatus();
    if (status.isConnected) {
      dot.className = 'footer-db-dot connected';
      text.textContent = 'Database: Supabase Live';
    } else {
      dot.className = 'footer-db-dot';
      text.textContent = 'Database: Demo Mode (Seed Data)';
    }
  }

  // ==========================================================================
  // Cart Drawer Rendering
  // ==========================================================================
  renderCartDrawerContent(summary) {
    const body = document.getElementById('drawer-cart-body');
    const footer = document.getElementById('drawer-cart-footer');
    if (!body || !footer) return;

    if (summary.isEmpty) {
      body.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🛒</div>
          <h4 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem;">Your Cart is Empty</h4>
          <p style="font-size: 0.9rem; color: var(--color-text-muted); margin-bottom: 1.5rem;">
            Explore our fresh Karachi grocery catalogue and stock up on everyday essentials.
          </p>
          <a href="#shop" class="btn btn-primary" onclick="document.getElementById('close-cart-btn').click();">Start Shopping</a>
        </div>
      `;
      footer.style.display = 'none';
      return;
    }

    footer.style.display = 'block';

    // Free delivery progress calculation
    const progressPercent = Math.min(100, Math.round((summary.subtotal / summary.freeDeliveryThreshold) * 100));

    body.innerHTML = `
      <div style="background: var(--color-primary-50); border: 1px solid var(--color-primary-200); border-radius: var(--radius-md); padding: 0.85rem; margin-bottom: 1.25rem;">
        <div style="font-size: 0.82rem; font-weight: 700; color: var(--color-primary-900); margin-bottom: 0.35rem; display: flex; justify-content: space-between;">
          <span>${summary.isFreeDeliveryEligible ? '🎉 You qualify for FREE Delivery in Karachi!' : `Add Rs. ${summary.freeDeliveryDifference.toLocaleString()} more for FREE delivery`}</span>
          <span>${progressPercent}%</span>
        </div>
        <div style="width: 100%; height: 6px; background: rgba(22, 163, 74, 0.2); border-radius: 999px; overflow: hidden;">
          <div style="width: ${progressPercent}%; height: 100%; background: var(--color-primary-600); border-radius: 999px; transition: width 0.3s ease;"></div>
        </div>
      </div>

      <div class="cart-items-list">
        ${summary.items.map(item => `
          <div class="cart-item">
            <img src="${item.image}" alt="${item.name}" class="cart-item-img" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80'">
            <div class="cart-item-info">
              <h5 class="cart-item-title">${item.name}</h5>
              <div class="cart-item-unit">${item.unit} • <span class="product-card-sku">${item.sku}</span></div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.4rem;">
                <span class="cart-item-price">Rs. ${(item.price * item.quantity).toLocaleString()}</span>
                <div class="quantity-stepper" style="transform: scale(0.85); transform-origin: right center;">
                  <button class="quantity-btn" data-action="cart-minus" data-id="${item.id}">-</button>
                  <input type="text" class="quantity-input" value="${item.quantity}" readonly>
                  <button class="quantity-btn" data-action="cart-plus" data-id="${item.id}">+</button>
                </div>
              </div>
            </div>
            <button class="cart-item-remove" data-action="cart-remove" data-id="${item.id}" title="Remove item">&times;</button>
          </div>
        `).join('')}
      </div>
    `;

    footer.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--color-text-body);">
        <span>Subtotal (${summary.totalItemsCount} items)</span>
        <span style="font-weight: 700;">Rs. ${summary.subtotal.toLocaleString()}</span>
      </div>
      ${summary.discount > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--color-primary-700);">
          <span>Promo Discount (${summary.appliedPromo.code})</span>
          <span style="font-weight: 700;">- Rs. ${summary.discount.toLocaleString()}</span>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.9rem; color: var(--color-text-body);">
        <span>Karachi Delivery</span>
        <span style="font-weight: 700;">${summary.deliveryFee === 0 ? '<span style="color: var(--color-primary-600);">FREE</span>' : `Rs. ${summary.deliveryFee}`}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 1.25rem; font-size: 1.15rem; font-weight: 800; color: var(--color-primary-900); border-top: 1px dashed var(--color-border); padding-top: 0.75rem;">
        <span>Total Amount</span>
        <span>Rs. ${summary.totalAmount.toLocaleString()}</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.65rem;">
        <a href="#checkout" class="btn btn-primary btn-block" onclick="document.getElementById('close-cart-btn').click();">
          Proceed to Checkout →
        </a>
        <a href="#cart" class="btn btn-secondary btn-block" onclick="document.getElementById('close-cart-btn').click();">
          View Shopping Cart Page
        </a>
      </div>
    `;

    // Attach cart item events
    body.querySelectorAll('[data-action="cart-minus"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = summary.items.find(i => i.id === id);
        if (item) cartService.updateQuantity(id, item.quantity - 1);
      });
    });

    body.querySelectorAll('[data-action="cart-plus"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = summary.items.find(i => i.id === id);
        if (item) cartService.updateQuantity(id, item.quantity + 1);
      });
    });

    body.querySelectorAll('[data-action="cart-remove"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        cartService.removeItem(id);
      });
    });
  }

  // ==========================================================================
  // Router Registration
  // ==========================================================================
  setupRouting() {
    router.register('home', () => this.renderHome());
    router.register('shop', (params) => this.renderShop(params));
    router.register('category', (params) => this.renderCategory(params));
    router.register('product', (params) => this.renderProductPage(params));
    router.register('cart', () => this.renderCartPage());
    router.register('checkout', () => this.renderCheckoutPage());
    router.register('order-confirmation', (params) => this.renderOrderConfirmationPage(params));
    router.register('tracking', (params) => this.renderOrderTrackingPage(params));
    router.register('about', () => this.renderAboutPage());
    router.register('contact', () => this.renderContactPage());
    router.register('privacy', () => this.renderPolicyPage('privacy'));
    router.register('terms', () => this.renderPolicyPage('terms'));

    router.onAfterNavigate((routeInfo) => {
      // Update active state in secondary navbar
      document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href')?.replace('#', '');
        if (href === routeInfo.mainRoute || (routeInfo.mainRoute === 'home' && href === '')) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    });
  }

  // ==========================================================================
  // View 1: Homepage
  // ==========================================================================
  async renderHome() {
    this.appContent.innerHTML = `
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="container hero-content">
          <div>
            <div class="hero-badge-tag">
              <span>🇵🇰</span> Delivering Fresh Across Karachi in 2 Hours
            </div>
            <h1 class="hero-title">
              Your Neighborhood Supermarket, <span class="highlight">Delivered Fresh</span> to Your Doorstep.
            </h1>
            <p class="hero-desc">
              From fresh chakki atta, Sindh farm tomatoes, and Olper's milk to everyday household essentials. Enjoy authentic prices in PKR and reliable Cash on Delivery.
            </p>
            <div class="hero-cta-group">
              <a href="#shop" class="btn btn-primary btn-lg">Shop Fresh Groceries →</a>
              <a href="#shop?sale=true" class="btn btn-secondary btn-lg">Today's Deals (-15% OFF)</a>
            </div>
            <div class="hero-features">
              <div class="hero-feature-item">
                <div class="hero-feature-icon">🚚</div>
                <div>
                  <div style="font-weight: 700;">Free Delivery</div>
                  <div style="font-size: 0.78rem; color: var(--color-text-muted);">On orders over Rs. 2,000</div>
                </div>
              </div>
              <div class="hero-feature-item">
                <div class="hero-feature-icon">💵</div>
                <div>
                  <div style="font-weight: 700;">Cash on Delivery</div>
                  <div style="font-size: 0.78rem; color: var(--color-text-muted);">Pay upon arrival at home</div>
                </div>
              </div>
              <div class="hero-feature-item">
                <div class="hero-feature-icon">🛡️</div>
                <div>
                  <div style="font-weight: 700;">100% Genuine Brands</div>
                  <div style="font-size: 0.78rem; color: var(--color-text-muted);">Quality guaranteed products</div>
                </div>
              </div>
            </div>
          </div>
          <div class="hero-visual">
            <div class="hero-image-card">
              <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80" alt="Karachi Mart Supermarket Aisles">
            </div>
            <div class="hero-floating-badge">
              <div class="hero-floating-icon">🥦</div>
              <div>
                <div class="hero-floating-title">100% Farm Fresh</div>
                <div class="hero-floating-sub">Sourced Daily from Sindh</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Popular Categories -->
      <section class="section section-alt">
        <div class="container">
          <div class="section-header">
            <div class="section-title-wrap">
              <span class="section-subtitle">Explore Department</span>
              <h2 class="section-title">Popular Categories</h2>
            </div>
            <a href="#shop" class="btn btn-secondary btn-sm">View All Categories →</a>
          </div>
          <div class="category-card-grid" id="home-category-grid">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </section>

      <!-- Deals of the Day (Featured & Discounted) -->
      <section class="section">
        <div class="container">
          <div class="section-header">
            <div class="section-title-wrap">
              <span class="section-subtitle">Save Big Today</span>
              <h2 class="section-title">Featured & Discounted Specials</h2>
            </div>
            <a href="#shop?sale=true" class="btn btn-secondary btn-sm">See All Deals →</a>
          </div>
          <div class="product-grid" id="home-featured-grid">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </section>

      <!-- Best Sellers in Karachi -->
      <section class="section section-alt">
        <div class="container">
          <div class="section-header">
            <div class="section-title-wrap">
              <span class="section-subtitle">Karachi's Favorites</span>
              <h2 class="section-title">Best Selling Household Staples</h2>
            </div>
            <a href="#shop?sort=bestseller" class="btn btn-secondary btn-sm">View Best Sellers →</a>
          </div>
          <div class="product-grid" id="home-bestseller-grid">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </section>

      <!-- Karachi Delivery Information Banner -->
      <section class="container">
        <div class="delivery-coverage-banner">
          <div class="delivery-coverage-content">
            <span class="badge" style="background: rgba(255,255,255,0.25); color: #fff; margin-bottom: 0.75rem;">Fast Local Delivery</span>
            <h3 class="delivery-coverage-title">Delivering Daily Across Karachi</h3>
            <p class="delivery-coverage-desc">
              Whether you are in Gulshan-e-Iqbal, North Nazimabad, PECHS, F.B Area, Bahadurabad, or DHA, our chilled delivery vans ensure your fresh groceries arrive in prime condition.
            </p>
            <div class="area-pill-list">
              ${KARACHI_AREAS.slice(0, 8).map(a => `<span class="area-pill">📍 ${a.name}</span>`).join('')}
              <span class="area-pill">+ More Areas</span>
            </div>
            <a href="#tracking" class="btn btn-primary" style="background: #ffffff; color: var(--color-primary-800);">Track an Existing Order →</a>
          </div>
        </div>
      </section>

      <!-- Why Shop with Karachi Mart -->
      <section class="section">
        <div class="container">
          <div class="section-header text-center" style="display: block; margin-bottom: 2.5rem;">
            <span class="section-subtitle">The Karachi Mart Difference</span>
            <h2 class="section-title">Why Karachi Chooses Karachi Mart</h2>
          </div>
          <div class="benefits-grid">
            <div class="benefit-card">
              <div class="benefit-icon">🌾</div>
              <h4 class="benefit-title">Guaranteed Freshness</h4>
              <p class="benefit-desc">We hand-select all fruits, vegetables, and daily staples so you always receive top-tier kitchen quality.</p>
            </div>
            <div class="benefit-card">
              <div class="benefit-icon">⏱️</div>
              <h4 class="benefit-title">Prompt 2-Hour Delivery</h4>
              <p class="benefit-desc">Our neighborhood dispatch hubs located across Karachi ensure your basket reaches you without delay.</p>
            </div>
            <div class="benefit-card">
              <div class="benefit-icon">🏷️</div>
              <h4 class="benefit-title">Honest Market Prices</h4>
              <p class="benefit-desc">Fair, transparent prices in PKR with real promotions and no hidden markups on everyday staples.</p>
            </div>
            <div class="benefit-card">
              <div class="benefit-icon">🤝</div>
              <h4 class="benefit-title">Cash on Delivery</h4>
              <p class="benefit-desc">Inspect your order right at your doorstep before handing over cash. Complete peace of mind guaranteed.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Customer Testimonials (Clearly marked as Fictional Demo Testimonials) -->
      <section class="section section-alt">
        <div class="container">
          <div class="section-header">
            <div class="section-title-wrap">
              <span class="section-subtitle">Customer Feedback</span>
              <h2 class="section-title">What Our Customers Say</h2>
            </div>
            <span class="badge" style="background: var(--color-surface-bg); border: 1px solid var(--color-border); color: var(--color-text-muted);">
              Fictional Demo Reviews
            </span>
          </div>
          <div class="testimonials-grid">
            <div class="testimonial-card">
              <p class="testimonial-text">
                "Getting fresh Chakki Atta and Dalda cooking oil delivered right to my apartment in Gulshan-e-Iqbal within 90 minutes made my weekend grocery shopping completely hassle-free."
              </p>
              <div class="testimonial-author">
                <div class="testimonial-avatar">SA</div>
                <div>
                  <div class="testimonial-name">Sana Alvi</div>
                  <div class="testimonial-area">Gulshan-e-Iqbal, Block 13-D</div>
                </div>
              </div>
            </div>
            <div class="testimonial-card">
              <p class="testimonial-text">
                "The Sindhri mangoes were exceptionally sweet and the Olper's milk was completely fresh. Paying Cash on Delivery gave our family total confidence in ordering."
              </p>
              <div class="testimonial-author">
                <div class="testimonial-avatar">MK</div>
                <div>
                  <div class="testimonial-name">Mohammad Kamran</div>
                  <div class="testimonial-area">PECHS Block 2, Karachi</div>
                </div>
              </div>
            </div>
            <div class="testimonial-card">
              <p class="testimonial-text">
                "I ordered K&N's nuggets, Dawn bread, and tea late in the evening to North Nazimabad. The rider arrived promptly with exact change. Outstanding service!"
              </p>
              <div class="testimonial-author">
                <div class="testimonial-avatar">ZB</div>
                <div>
                  <div class="testimonial-name">Zainab Bilal</div>
                  <div class="testimonial-area">North Nazimabad, Block H</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Store Location & Contact Information -->
      <section class="section">
        <div class="container">
          <div style="background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 2.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; align-items: center;">
            <div>
              <span class="section-subtitle">Store & Dispatch Center</span>
              <h3 style="font-size: 1.6rem; font-weight: 800; margin: 0.5rem 0 1rem; color: var(--color-text-main);">Visit or Contact Karachi Mart</h3>
              <p style="color: var(--color-text-body); margin-bottom: 1.25rem; font-size: 0.95rem;">
                Our primary fulfillment hub operates on Main Rashid Minhas Road, serving customers across Karachi 7 days a week.
              </p>
              <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.92rem;">
                <div>📍 <strong>Address:</strong> ${APP_CONFIG.storeAddress}</div>
                <div>📞 <strong>UAN Phone:</strong> ${APP_CONFIG.storeUan}</div>
                <div>💬 <strong>WhatsApp Helpline:</strong> ${APP_CONFIG.storeWhatsapp}</div>
                <div>⏰ <strong>Order & Support Hours:</strong> ${APP_CONFIG.supportHours}</div>
              </div>
            </div>
            <div style="background: var(--color-surface-bg); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.5rem; text-align: center;">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🏬</div>
              <h4 style="font-weight: 700; margin-bottom: 0.35rem;">Karachi Mart Main Hub</h4>
              <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 1rem;">Centrally located for rapid Karachi delivery.</p>
              <div style="display: flex; gap: 0.75rem; justify-content: center;">
                <a href="#contact" class="btn btn-secondary btn-sm">Send a Message</a>
                <a href="#shop" class="btn btn-primary btn-sm">Order Online Now</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    // Populate categories
    const categories = await dataService.getCategories();
    const catContainer = document.getElementById('home-category-grid');
    if (catContainer) {
      catContainer.innerHTML = categories.map(c => `
        <a href="#shop?category=${c.id}" class="category-card">
          <div class="category-icon-box">${c.icon}</div>
          <div class="category-name">${c.name}</div>
        </a>
      `).join('');
    }

    // Populate Featured/Sale
    const allProducts = await dataService.getProducts();
    const featuredProds = allProducts.filter(p => p.compareAtPrice && p.compareAtPrice > p.price).slice(0, 4);
    const featContainer = document.getElementById('home-featured-grid');
    if (featContainer) {
      featContainer.innerHTML = featuredProds.map(p => this.renderProductCardHtml(p)).join('');
      this.attachProductCardEvents(featContainer);
    }

    // Populate Best Sellers
    const bestSellers = allProducts.filter(p => p.isBestSeller).slice(0, 4);
    const bsContainer = document.getElementById('home-bestseller-grid');
    if (bsContainer) {
      bsContainer.innerHTML = bestSellers.map(p => this.renderProductCardHtml(p)).join('');
      this.attachProductCardEvents(bsContainer);
    }
  }

  // ==========================================================================
  // View 2: Shop Catalogue Page
  // ==========================================================================
  async renderShop(routeParams = {}) {
    const query = routeParams.queryParams || {};
    const selectedCat = query.category || 'all';
    const searchQuery = query.search || '';
    const sortBy = query.sort || 'featured';
    const saleOnly = query.sale === 'true';

    const categories = await dataService.getCategories();

    this.appContent.innerHTML = `
      <div class="container section">
        <div style="margin-bottom: 2rem;">
          <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 0.35rem;">
            <a href="#home">Home</a> / <strong>Shop Supermarket Catalogue</strong>
          </div>
          <h1 style="font-size: 2.2rem; font-weight: 800;">
            ${selectedCat !== 'all' ? (categories.find(c => c.id === selectedCat)?.name || 'Category') : 'All Supermarket Groceries'}
          </h1>
          <p style="color: var(--color-text-body); font-size: 1rem;">
            Fresh groceries, staples, pantry goods, and household supplies with delivery across Karachi.
          </p>
        </div>

        <div class="shop-layout">
          <!-- Sidebar Filters -->
          <aside class="shop-sidebar">
            <div class="filter-group">
              <h4 class="filter-title">
                <span>Categories</span>
                ${selectedCat !== 'all' ? `<a href="#shop" style="font-size: 0.75rem; color: var(--color-primary-600);">Clear</a>` : ''}
              </h4>
              <div class="filter-list">
                <a href="#shop${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}" class="filter-item-btn ${selectedCat === 'all' ? 'active' : ''}">
                  <span>All Categories</span>
                </a>
                ${categories.map(c => `
                  <a href="#shop?category=${c.id}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}" class="filter-item-btn ${selectedCat === c.id ? 'active' : ''}">
                    <span>${c.icon} ${c.name}</span>
                  </a>
                `).join('')}
              </div>
            </div>

            <div class="filter-group">
              <h4 class="filter-title">Quick Filters</h4>
              <div class="filter-list">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer;">
                  <input type="checkbox" id="filter-instock" style="accent-color: var(--color-primary-600);">
                  <span>In Stock Only</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer; margin-top: 0.4rem;">
                  <input type="checkbox" id="filter-onsale" ${saleOnly ? 'checked' : ''} style="accent-color: var(--color-primary-600);">
                  <span>Discounted Deals Only</span>
                </label>
              </div>
            </div>

            <div class="filter-group">
              <h4 class="filter-title">Active Delivery Area</h4>
              <p style="font-size: 0.85rem; color: var(--color-text-body); margin-bottom: 0.75rem;">
                Currently delivering to: <strong>${this.selectedArea}</strong>
              </p>
              <button class="btn btn-secondary btn-sm btn-block" id="change-area-filter-btn">Change Karachi Area</button>
            </div>
          </aside>

          <!-- Main Products Section -->
          <div>
            <!-- Toolbar -->
            <div class="shop-toolbar">
              <div class="shop-results-count" id="shop-results-text">
                Loading products...
              </div>
              <div class="shop-sort-wrap">
                <label for="shop-sort-select" class="shop-sort-label">Sort by:</label>
                <select id="shop-sort-select" class="shop-sort-select">
                  <option value="featured" ${sortBy === 'featured' ? 'selected' : ''}>Featured Items</option>
                  <option value="bestseller" ${sortBy === 'bestseller' ? 'selected' : ''}>Best Sellers</option>
                  <option value="price-low" ${sortBy === 'price-low' ? 'selected' : ''}>Price: Low to High</option>
                  <option value="price-high" ${sortBy === 'price-high' ? 'selected' : ''}>Price: High to Low</option>
                  <option value="discount" ${sortBy === 'discount' ? 'selected' : ''}>Biggest Discount</option>
                  <option value="name-asc" ${sortBy === 'name-asc' ? 'selected' : ''}>Name: A to Z</option>
                </select>
              </div>
            </div>

            <!-- Product Grid -->
            <div class="product-grid" id="shop-product-grid">
              <!-- Rendered dynamically -->
            </div>
          </div>
        </div>
      </div>
    `;

    // Setup filter listeners
    const sortSelect = document.getElementById('shop-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        urlParams.set('sort', val);
        router.navigate(`shop?${urlParams.toString()}`);
      });
    }

    const inStockCheck = document.getElementById('filter-instock');
    const onSaleCheck = document.getElementById('filter-onsale');

    const updateFilterCheckboxes = async () => {
      await this.loadShopProducts({
        category: selectedCat,
        search: searchQuery,
        sort: sortSelect?.value || sortBy,
        inStockOnly: inStockCheck?.checked || false,
        onSaleOnly: onSaleCheck?.checked || false
      });
    };

    if (inStockCheck) inStockCheck.addEventListener('change', updateFilterCheckboxes);
    if (onSaleCheck) onSaleCheck.addEventListener('change', updateFilterCheckboxes);

    const changeAreaBtn = document.getElementById('change-area-filter-btn');
    if (changeAreaBtn) {
      changeAreaBtn.addEventListener('click', () => this.openLocationModal());
    }

    // Initial load
    await this.loadShopProducts({
      category: selectedCat,
      search: searchQuery,
      sort: sortBy,
      inStockOnly: false,
      onSaleOnly: saleOnly
    });
  }

  async loadShopProducts(filters) {
    const grid = document.getElementById('shop-product-grid');
    const countText = document.getElementById('shop-results-text');
    if (!grid) return;

    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">Loading groceries...</div>`;

    const products = await dataService.getProducts(filters);

    if (countText) {
      countText.textContent = `Showing ${products.length} products ${filters.search ? `for "${filters.search}"` : ''}`;
    }

    if (products.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 3rem; text-align: center;">
          <div style="font-size: 2.5rem; margin-bottom: 1rem;">🔍</div>
          <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">No Products Found</h3>
          <p style="font-size: 0.95rem; color: var(--color-text-muted); margin-bottom: 1.5rem;">
            We couldn't find any items matching your selected criteria. Try adjusting your search or category filter.
          </p>
          <a href="#shop" class="btn btn-secondary">Clear All Filters</a>
        </div>
      `;
      return;
    }

    grid.innerHTML = products.map(p => this.renderProductCardHtml(p)).join('');
    this.attachProductCardEvents(grid);
  }

  // ==========================================================================
  // View 3: Dedicated Category Page (Wrapper to Shop)
  // ==========================================================================
  async renderCategory(routeParams) {
    const categoryId = routeParams.param || 'all';
    router.navigate(`shop?category=${categoryId}`);
  }

  // ==========================================================================
  // View 4: Product Details Page
  // ==========================================================================
  async renderProductPage(routeParams) {
    const productId = routeParams.param;
    const product = await dataService.getProductById(productId);

    if (!product) {
      this.appContent.innerHTML = `
        <div class="container section text-center">
          <h2>Product Not Found</h2>
          <p style="margin: 1rem 0 1.5rem; color: var(--color-text-muted);">The product you are looking for is no longer available.</p>
          <a href="#shop" class="btn btn-primary">Browse Catalogue</a>
        </div>
      `;
      return;
    }

    const discountPercent = product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : null;

    const allProducts = await dataService.getProducts({ category: product.category });
    const relatedProducts = allProducts.filter(p => p.id !== product.id).slice(0, 4);

    this.appContent.innerHTML = `
      <div class="container section">
        <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 1.5rem;">
          <a href="#home">Home</a> / <a href="#shop">Shop</a> / <a href="#shop?category=${product.category}" style="text-transform: capitalize;">${product.category.replace('-', ' ')}</a> / <strong>${product.name}</strong>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 3rem; background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 2.5rem; margin-bottom: 3rem;">
          <!-- Product Image -->
          <div style="position: relative; border-radius: var(--radius-lg); overflow: hidden; background: #f8fafc; border: 1px solid var(--color-border);">
            <img src="${product.image}" alt="${product.name}" style="width: 100%; height: 420px; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80'">
            ${discountPercent ? `<span class="badge badge-sale" style="position: absolute; top: 1.25rem; left: 1.25rem; font-size: 0.85rem;">-${discountPercent}% OFF SALE</span>` : ''}
          </div>

          <!-- Product Details -->
          <div>
            <div style="display: flex; gap: 0.65rem; align-items: center; margin-bottom: 0.5rem;">
              <span class="product-card-sku">${product.sku}</span>
              <span class="badge ${product.stock > 5 ? 'badge-instock' : product.stock > 0 ? 'badge-lowstock' : 'badge-outofstock'}">
                ${product.stock > 5 ? '✓ In Stock' : product.stock > 0 ? `⚠ Only ${product.stock} Left` : '✕ Out of Stock'}
              </span>
            </div>

            <h1 style="font-size: 2rem; font-weight: 800; line-height: 1.2; margin-bottom: 0.65rem;">${product.name}</h1>
            
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; font-size: 0.9rem; color: var(--color-text-muted);">
              <span style="color: var(--color-accent-600); font-weight: bold;">★ ${product.rating}</span>
              <span>(${product.reviewsCount} verified reviews)</span>
              <span>•</span>
              <span>Unit: <strong>${product.unit}</strong></span>
            </div>

            <div style="display: flex; align-items: baseline; gap: 0.85rem; margin-bottom: 1.5rem; border-top: 1px solid var(--color-border-subtle); border-bottom: 1px solid var(--color-border-subtle); padding: 1rem 0;">
              <span style="font-size: 2.2rem; font-weight: 800; color: var(--color-primary-800);">Rs. ${product.price.toLocaleString()}</span>
              ${product.compareAtPrice ? `
                <span style="font-size: 1.25rem; color: var(--color-text-light); text-decoration: line-through;">Rs. ${product.compareAtPrice.toLocaleString()}</span>
                <span style="font-size: 0.9rem; font-weight: 700; color: var(--color-accent-600); background: var(--color-accent-50); padding: 0.2rem 0.5rem; border-radius: var(--radius-sm);">
                  Save Rs. ${(product.compareAtPrice - product.price).toLocaleString()}
                </span>
              ` : ''}
            </div>

            <p style="font-size: 1.05rem; color: var(--color-text-body); line-height: 1.7; margin-bottom: 2rem;">
              ${product.description}
            </p>

            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 2rem;">
              <div class="quantity-stepper">
                <button class="quantity-btn" id="pdp-qty-minus" ${product.stock <= 0 ? 'disabled' : ''}>-</button>
                <input type="number" class="quantity-input" id="pdp-qty-val" value="1" min="1" max="${product.stock}" readonly>
                <button class="quantity-btn" id="pdp-qty-plus" ${product.stock <= 0 ? 'disabled' : ''}>+</button>
              </div>
              <button class="btn btn-primary btn-lg" id="pdp-add-btn" style="flex: 1;" ${product.stock <= 0 ? 'disabled' : ''}>
                ${product.stock > 0 ? 'Add to Cart' : 'Currently Out of Stock'}
              </button>
            </div>

            <div style="background: var(--color-surface-bg); border-radius: var(--radius-md); padding: 1rem; font-size: 0.85rem; color: var(--color-text-body); display: flex; flex-direction: column; gap: 0.5rem;">
              <div>📍 <strong>Delivering to:</strong> ${this.selectedArea}, Karachi (2-3 hours)</div>
              <div>💵 <strong>Payment:</strong> Cash on Delivery upon inspection</div>
              <div>🔄 <strong>Return Policy:</strong> Easy doorstep returns if quality does not meet satisfaction</div>
            </div>
          </div>
        </div>

        <!-- Related Products -->
        ${relatedProducts.length > 0 ? `
          <div style="margin-top: 3.5rem;">
            <div class="section-header">
              <h3 class="section-title">Related Items You May Like</h3>
            </div>
            <div class="product-grid" id="related-product-grid">
              ${relatedProducts.map(p => this.renderProductCardHtml(p)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Event handlers
    const qtyInput = document.getElementById('pdp-qty-val');
    const minusBtn = document.getElementById('pdp-qty-minus');
    const plusBtn = document.getElementById('pdp-qty-plus');
    const addBtn = document.getElementById('pdp-add-btn');

    if (minusBtn && plusBtn && qtyInput && addBtn) {
      minusBtn.addEventListener('click', () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val > 1) qtyInput.value = val - 1;
      });
      plusBtn.addEventListener('click', () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val < product.stock) qtyInput.value = val + 1;
        else toast.warning(`Only ${product.stock} units available in stock.`);
      });
      addBtn.addEventListener('click', async () => {
        const qty = parseInt(qtyInput.value) || 1;
        await cartService.addItem(product, qty);
      });
    }

    const relatedGrid = document.getElementById('related-product-grid');
    if (relatedGrid) {
      this.attachProductCardEvents(relatedGrid);
    }
  }

  // ==========================================================================
  // View 5: Dedicated Shopping Cart Page
  // ==========================================================================
  renderCartPage() {
    const summary = cartService.getCartSummary();

    if (summary.isEmpty) {
      this.appContent.innerHTML = `
        <div class="container section text-center">
          <div style="background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 4rem 2rem; max-width: 600px; margin: 0 auto;">
            <div style="font-size: 3.5rem; margin-bottom: 1rem;">🛒</div>
            <h2 style="font-size: 1.75rem; font-weight: 800; margin-bottom: 0.5rem;">Your Shopping Cart is Empty</h2>
            <p style="color: var(--color-text-muted); margin-bottom: 1.75rem;">
              You have not added any groceries yet. Start filling your basket with fresh ingredients!
            </p>
            <a href="#shop" class="btn btn-primary btn-lg">Browse Karachi Mart Catalogue →</a>
          </div>
        </div>
      `;
      return;
    }

    this.appContent.innerHTML = `
      <div class="container section">
        <h1 style="font-size: 2.2rem; font-weight: 800; margin-bottom: 1.5rem;">Your Shopping Cart (${summary.totalItemsCount} items)</h1>

        <div style="display: grid; grid-template-columns: 1.5fr 0.9fr; gap: 2.5rem; align-items: start;">
          <!-- Items Table -->
          <div style="background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 1rem; border-bottom: 1px solid var(--color-border-subtle); margin-bottom: 1rem;">
              <span style="font-weight: 700; font-size: 1.1rem;">Cart Items</span>
              <button class="btn btn-secondary btn-sm" id="cart-page-clear-btn">Clear Cart</button>
            </div>

            <div class="cart-items-list">
              ${summary.items.map(item => `
                <div class="cart-item" style="padding: 1.25rem 0;">
                  <img src="${item.image}" alt="${item.name}" class="cart-item-img" style="width: 80px; height: 80px;" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80'">
                  <div class="cart-item-info">
                    <h4 class="cart-item-title" style="font-size: 1.05rem;">
                      <a href="#product/${item.id}">${item.name}</a>
                    </h4>
                    <div class="cart-item-unit">${item.unit} • <span class="product-card-sku">${item.sku}</span></div>
                    <div style="font-size: 0.85rem; color: var(--color-text-muted);">
                      Unit Price: <strong>Rs. ${item.price.toLocaleString()}</strong>
                    </div>
                  </div>
                  <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.75rem;">
                    <div class="quantity-stepper">
                      <button class="quantity-btn" data-action="cart-minus" data-id="${item.id}">-</button>
                      <input type="text" class="quantity-input" value="${item.quantity}" readonly>
                      <button class="quantity-btn" data-action="cart-plus" data-id="${item.id}">+</button>
                    </div>
                    <span style="font-size: 1.15rem; font-weight: 800; color: var(--color-primary-800);">
                      Rs. ${(item.price * item.quantity).toLocaleString()}
                    </span>
                    <button class="cart-item-remove" data-action="cart-remove" data-id="${item.id}">Remove</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Order Summary Box -->
          <div class="order-summary-box">
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.25rem;">Order Summary</h3>

            <div class="summary-row">
              <span>Subtotal</span>
              <span class="font-bold">Rs. ${summary.subtotal.toLocaleString()}</span>
            </div>

            ${summary.discount > 0 ? `
              <div class="summary-row" style="color: var(--color-primary-700);">
                <span>Promo Discount (${summary.appliedPromo.code})</span>
                <span class="font-bold">- Rs. ${summary.discount.toLocaleString()}</span>
              </div>
            ` : ''}

            <div class="summary-row">
              <span>Karachi Delivery</span>
              <span class="font-bold">
                ${summary.deliveryFee === 0 ? '<span style="color: var(--color-primary-600);">FREE</span>' : `Rs. ${summary.deliveryFee}`}
              </span>
            </div>

            <!-- Promo code input -->
            <div style="margin: 1.25rem 0; padding: 1rem 0; border-top: 1px solid var(--color-border-subtle); border-bottom: 1px solid var(--color-border-subtle);">
              <label class="form-label" for="promo-input">Promotional Code</label>
              ${summary.appliedPromo ? `
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--color-primary-50); padding: 0.65rem 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--color-primary-200);">
                  <div>
                    <strong style="color: var(--color-primary-800);">${summary.appliedPromo.code}</strong>
                    <div style="font-size: 0.78rem; color: var(--color-primary-700);">${summary.appliedPromo.description}</div>
                  </div>
                  <button type="button" id="cart-page-remove-promo" style="color: var(--color-danger-600); font-size: 0.85rem; font-weight: 600;">Remove</button>
                </div>
              ` : `
                <div class="promo-apply-group">
                  <input type="text" id="cart-page-promo-input" class="form-control" placeholder="e.g. WELCOME100" style="text-transform: uppercase;">
                  <button type="button" id="cart-page-apply-promo" class="btn btn-secondary">Apply</button>
                </div>
                <div class="form-hint">Try: <strong>WELCOME100</strong>, <strong>KARACHI10</strong>, or <strong>FREEDELIVERY</strong></div>
              `}
            </div>

            <div class="summary-row total-row">
              <span>Total</span>
              <span>Rs. ${summary.totalAmount.toLocaleString()}</span>
            </div>

            <a href="#checkout" class="btn btn-primary btn-block btn-lg" style="margin-top: 1.5rem;">
              Proceed to Checkout →
            </a>
          </div>
        </div>
      </div>
    `;

    // Setup action listeners
    const container = this.appContent;
    container.querySelectorAll('[data-action="cart-minus"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const it = summary.items.find(i => i.id === id);
        if (it) {
          cartService.updateQuantity(id, it.quantity - 1);
          this.renderCartPage();
        }
      });
    });

    container.querySelectorAll('[data-action="cart-plus"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const it = summary.items.find(i => i.id === id);
        if (it) {
          cartService.updateQuantity(id, it.quantity + 1);
          this.renderCartPage();
        }
      });
    });

    container.querySelectorAll('[data-action="cart-remove"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        cartService.removeItem(id);
        this.renderCartPage();
      });
    });

    const clearBtn = document.getElementById('cart-page-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your shopping cart?')) {
          cartService.clearCart();
          this.renderCartPage();
        }
      });
    }

    const applyPromoBtn = document.getElementById('cart-page-apply-promo');
    if (applyPromoBtn) {
      applyPromoBtn.addEventListener('click', () => {
        const input = document.getElementById('cart-page-promo-input');
        const res = cartService.applyPromoCode(input?.value);
        if (res.success) {
          toast.success(res.message);
          this.renderCartPage();
        } else {
          toast.error(res.message);
        }
      });
    }

    const removePromoBtn = document.getElementById('cart-page-remove-promo');
    if (removePromoBtn) {
      removePromoBtn.addEventListener('click', () => {
        cartService.removePromoCode();
        toast.info('Promo code removed.');
        this.renderCartPage();
      });
    }
  }

  // ==========================================================================
  // View 6: Checkout Page
  // ==========================================================================
  renderCheckoutPage() {
    const summary = cartService.getCartSummary();

    if (summary.isEmpty) {
      this.appContent.innerHTML = `
        <div class="container section text-center">
          <div style="background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 4rem 2rem; max-width: 550px; margin: 0 auto;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🛒</div>
            <h2>Your Cart is Empty</h2>
            <p style="margin: 1rem 0 1.5rem; color: var(--color-text-muted);">Please add items to your cart before proceeding to checkout.</p>
            <a href="#shop" class="btn btn-primary">Browse Catalogue</a>
          </div>
        </div>
      `;
      return;
    }

    this.appContent.innerHTML = `
      <div class="container section">
        <h1 style="font-size: 2.2rem; font-weight: 800; margin-bottom: 1.5rem;">Express Checkout</h1>

        <div class="checkout-layout">
          <!-- Checkout Form -->
          <form id="checkout-order-form">
            <!-- 1. Customer Information -->
            <div class="checkout-box">
              <h3 class="checkout-section-header">1. Customer Details</h3>
              <div class="form-group">
                <label class="form-label" for="chk-name">Full Name <span class="required">*</span></label>
                <input type="text" id="chk-name" class="form-control" placeholder="e.g. Tariq Mehmood" required>
                <div class="form-error" id="err-chk-name" style="display: none;">Please enter your full name.</div>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
                <div class="form-group">
                  <label class="form-label" for="chk-phone">Pakistani Mobile Phone <span class="required">*</span></label>
                  <input type="tel" id="chk-phone" class="form-control" placeholder="0300-1234567" required>
                  <div class="form-hint">Used for order tracking and delivery rider coordination. Format: 03XX-XXXXXXX</div>
                  <div class="form-error" id="err-chk-phone" style="display: none;">Please enter a valid Pakistani phone number (e.g. 0300-1234567).</div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="chk-email">Email Address (Optional)</label>
                  <input type="email" id="chk-email" class="form-control" placeholder="tariq@example.com">
                </div>
              </div>
            </div>

            <!-- 2. Karachi Delivery Address -->
            <div class="checkout-box">
              <h3 class="checkout-section-header">2. Karachi Delivery Address</h3>
              <div class="form-group">
                <label class="form-label" for="chk-area">Karachi Area / Neighbourhood <span class="required">*</span></label>
                <select id="chk-area" class="form-control" required>
                  ${KARACHI_AREAS.map(a => `
                    <option value="${a.name}" ${this.selectedArea === a.name ? 'selected' : ''}>
                      ${a.name} (Postal: ${a.postalCode} • Zone: ${a.deliveryZone})
                    </option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="chk-address">Complete Street Address <span class="required">*</span></label>
                <textarea id="chk-address" class="form-control" rows="2" placeholder="House / Flat #, Building Name, Street / Lane Number..." required></textarea>
                <div class="form-error" id="err-chk-address" style="display: none;">Please provide your delivery address in Karachi.</div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
                <div class="form-group">
                  <label class="form-label" for="chk-landmark">Nearby Landmark (Optional)</label>
                  <input type="text" id="chk-landmark" class="form-control" placeholder="e.g. Near Disco Bakery, Opposite Dolmen Mall">
                </div>
                <div class="form-group">
                  <label class="form-label" for="chk-slot">Preferred Delivery Time Slot</label>
                  <select id="chk-slot" class="form-control">
                    <option value="Standard Express (Next 90 - 120 mins)">Standard Express (Next 90 - 120 mins)</option>
                    <option value="Morning (10:00 AM - 1:00 PM)">Morning (10:00 AM - 1:00 PM)</option>
                    <option value="Afternoon (2:00 PM - 5:00 PM)">Afternoon (2:00 PM - 5:00 PM)</option>
                    <option value="Evening (6:00 PM - 9:00 PM)">Evening (6:00 PM - 9:00 PM)</option>
                  </select>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="chk-notes">Rider Instructions / Order Notes (Optional)</label>
                <input type="text" id="chk-notes" class="form-control" placeholder="e.g. Call before arrival, leave with security, etc.">
              </div>
            </div>

            <!-- 3. Payment Method -->
            <div class="checkout-box">
              <h3 class="checkout-section-header">3. Payment Method</h3>
              <div class="payment-method-box">
                <div class="payment-method-icon">💵</div>
                <div>
                  <strong style="color: var(--color-primary-900); font-size: 1.05rem;">Cash on Delivery (COD)</strong>
                  <p class="payment-method-desc">
                    Pay in cash directly to our Karachi Mart delivery rider when your package arrives at your home. No online card details collected for customer security in this demo.
                  </p>
                </div>
              </div>
            </div>

            <!-- Submit Button for Mobile / Small Screens -->
            <button type="submit" id="checkout-submit-btn" class="btn btn-primary btn-block btn-lg" style="margin-top: 1rem;">
              Confirm & Place Order (Rs. ${summary.totalAmount.toLocaleString()}) →
            </button>
          </form>

          <!-- Order Summary Sidebar -->
          <div class="order-summary-box">
            <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1.25rem;">Order Review</h3>

            <div style="max-height: 260px; overflow-y: auto; margin-bottom: 1.25rem; border-bottom: 1px solid var(--color-border-subtle); padding-bottom: 0.5rem;">
              ${summary.items.map(it => `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; font-size: 0.88rem;">
                  <div style="flex: 1; padding-right: 0.75rem;">
                    <div style="font-weight: 600; color: var(--color-text-main);">${it.name}</div>
                    <div style="font-size: 0.75rem; color: var(--color-text-muted);">${it.quantity} x Rs. ${it.price.toLocaleString()} (${it.unit})</div>
                  </div>
                  <span style="font-weight: 700;">Rs. ${(it.price * it.quantity).toLocaleString()}</span>
                </div>
              `).join('')}
            </div>

            <div class="summary-row">
              <span>Subtotal</span>
              <span class="font-bold">Rs. ${summary.subtotal.toLocaleString()}</span>
            </div>

            ${summary.discount > 0 ? `
              <div class="summary-row" style="color: var(--color-primary-700);">
                <span>Discount (${summary.appliedPromo.code})</span>
                <span class="font-bold">- Rs. ${summary.discount.toLocaleString()}</span>
              </div>
            ` : ''}

            <div class="summary-row">
              <span>Delivery Fee</span>
              <span class="font-bold">${summary.deliveryFee === 0 ? '<span style="color: var(--color-primary-600);">FREE</span>' : `Rs. ${summary.deliveryFee}`}</span>
            </div>

            <div class="summary-row total-row">
              <span>Total to Pay</span>
              <span>Rs. ${summary.totalAmount.toLocaleString()}</span>
            </div>

            <div style="background: var(--color-surface-bg); border-radius: var(--radius-md); padding: 0.85rem; font-size: 0.8rem; color: var(--color-text-muted); margin-top: 1.25rem;">
              🛡️ <strong>Safe Demo Ordering:</strong> This is a portfolio supermarket demo. Stock will be reserved and an order reference generated for real-time tracking.
            </div>
          </div>
        </div>
      </div>
    `;

    // Checkout Form Submission
    const form = document.getElementById('checkout-order-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('chk-name');
        const phoneInput = document.getElementById('chk-phone');
        const emailInput = document.getElementById('chk-email');
        const areaSelect = document.getElementById('chk-area');
        const addressInput = document.getElementById('chk-address');
        const landmarkInput = document.getElementById('chk-landmark');
        const slotSelect = document.getElementById('chk-slot');
        const notesInput = document.getElementById('chk-notes');
        const submitBtn = document.getElementById('checkout-submit-btn');

        // Reset errors
        document.getElementById('err-chk-name').style.display = 'none';
        document.getElementById('err-chk-phone').style.display = 'none';
        document.getElementById('err-chk-address').style.display = 'none';

        let isValid = true;

        if (!nameInput.value.trim()) {
          document.getElementById('err-chk-name').style.display = 'block';
          nameInput.focus();
          isValid = false;
        }

        // Pakistani phone validation (03XX-XXXXXXX or 03XXXXXXXXX)
        const cleanPhone = phoneInput.value.replace(/[^0-9]/g, '');
        if (!cleanPhone.startsWith('03') || cleanPhone.length < 11) {
          document.getElementById('err-chk-phone').style.display = 'block';
          if (isValid) phoneInput.focus();
          isValid = false;
        }

        if (!addressInput.value.trim()) {
          document.getElementById('err-chk-address').style.display = 'block';
          if (isValid) addressInput.focus();
          isValid = false;
        }

        if (!isValid) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying Stock & Submitting Order...';

        try {
          const payload = {
            customerName: nameInput.value,
            customerPhone: phoneInput.value,
            customerEmail: emailInput.value || null,
            deliveryAddress: addressInput.value,
            area: areaSelect.value,
            landmark: landmarkInput.value || null,
            deliverySlot: slotSelect.value,
            orderNotes: notesInput.value || null,
            items: summary.items,
            subtotal: summary.subtotal,
            discount: summary.discount,
            deliveryFee: summary.deliveryFee,
            totalAmount: summary.totalAmount
          };

          const order = await dataService.submitOrder(payload);

          // Clear cart on success
          cartService.clearCart();
          toast.success(`Order #${order.orderNumber} placed successfully!`);

          // Navigate to order confirmation
          router.navigate(`order-confirmation/${order.orderNumber}`);
        } catch (err) {
          toast.error(err.message || 'Failed to submit order. Please check item availability.');
          submitBtn.disabled = false;
          submitBtn.textContent = `Confirm & Place Order (Rs. ${summary.totalAmount.toLocaleString()}) →`;
        }
      });
    }
  }

  // ==========================================================================
  // View 7: Order Confirmation Page
  // ==========================================================================
  async renderOrderConfirmationPage(routeParams) {
    const orderNumber = routeParams.param;
    const storedOrders = JSON.parse(localStorage.getItem('km_demo_orders_v2') || '[]');
    const order = storedOrders.find(o => o.orderNumber === orderNumber) || storedOrders[0];

    if (!order) {
      this.appContent.innerHTML = `
        <div class="container section text-center">
          <h2>Order Not Found</h2>
          <p style="margin: 1rem 0 1.5rem; color: var(--color-text-muted);">We could not find the requested order reference.</p>
          <a href="#home" class="btn btn-primary">Return to Home</a>
        </div>
      `;
      return;
    }

    this.appContent.innerHTML = `
      <div class="container section">
        <div class="confirmation-container">
          <div class="confirmation-card">
            <div style="text-align: center; margin-bottom: 2rem;">
              <div class="confirmation-icon-circle">✓</div>
              <span class="badge badge-sale" style="margin-bottom: 0.5rem;">Order Placed Successfully</span>
              <h1 style="font-size: 2.2rem; font-weight: 800; color: var(--color-text-main); margin-bottom: 0.35rem;">
                Thank You, ${order.customerName}!
              </h1>
              <p style="color: var(--color-text-muted); font-size: 1rem;">
                Your Karachi Mart grocery order has been received and sent to our packing station.
              </p>
              <div class="order-ref-badge">${order.orderNumber}</div>
              <p style="font-size: 0.85rem; color: var(--color-text-muted);">
                Save this order reference along with your phone number (<strong>${order.customerPhone}</strong>) to track real-time delivery status.
              </p>
            </div>

            <!-- Order Details -->
            <div style="background: var(--color-surface-bg); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 2rem;">
              <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem;">
                Delivery Details
              </h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; font-size: 0.9rem;">
                <div><strong>Recipient:</strong> ${order.customerName}</div>
                <div><strong>Contact Phone:</strong> ${order.customerPhone}</div>
                <div><strong>Karachi Area:</strong> ${order.area}</div>
                <div><strong>Delivery Slot:</strong> ${order.deliverySlot}</div>
                <div style="grid-column: 1 / -1;"><strong>Address:</strong> ${order.deliveryAddress} ${order.landmark ? `(Landmark: ${order.landmark})` : ''}</div>
                ${order.orderNotes ? `<div style="grid-column: 1 / -1; color: var(--color-text-muted);"><strong>Rider Notes:</strong> "${order.orderNotes}"</div>` : ''}
              </div>
            </div>

            <!-- Itemized Receipt -->
            <div style="margin-bottom: 2rem;">
              <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem;">
                Ordered Items
              </h4>
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${order.items.map(it => `
                  <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                    <div>
                      <strong>${it.name}</strong> <span style="color: var(--color-text-muted); font-size: 0.8rem;">(${it.sku})</span>
                      <div style="font-size: 0.8rem; color: var(--color-text-muted);">${it.quantity} x Rs. ${it.price.toLocaleString()}</div>
                    </div>
                    <span style="font-weight: 700;">Rs. ${(it.price * it.quantity).toLocaleString()}</span>
                  </div>
                `).join('')}
              </div>

              <div style="border-top: 1px solid var(--color-border); margin-top: 1rem; padding-top: 1rem;">
                <div class="summary-row"><span>Subtotal:</span> <span>Rs. ${order.subtotal.toLocaleString()}</span></div>
                ${order.discount > 0 ? `<div class="summary-row" style="color: var(--color-primary-700);"><span>Discount:</span> <span>- Rs. ${order.discount.toLocaleString()}</span></div>` : ''}
                <div class="summary-row"><span>Delivery Fee:</span> <span>${order.deliveryFee === 0 ? 'FREE' : `Rs. ${order.deliveryFee}`}</span></div>
                <div class="summary-row total-row" style="font-size: 1.25rem;">
                  <span>Total Amount (COD):</span>
                  <span>Rs. ${order.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <!-- Action buttons -->
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
              <a href="#tracking?ref=${order.orderNumber}&phone=${encodeURIComponent(order.customerPhone)}" class="btn btn-primary" style="flex: 1;">
                Track Live Order Status →
              </a>
              <button onclick="window.print()" class="btn btn-secondary">
                🖨️ Print Receipt
              </button>
              <a href="#shop" class="btn btn-secondary">
                Continue Shopping
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // View 8: Order Tracking (Privacy-Conscious Protection)
  // Requires both Order Reference AND Phone Number as requested!
  // ==========================================================================
  async renderOrderTrackingPage(routeParams = {}) {
    const query = routeParams.queryParams || {};
    const prefillRef = query.ref || '';
    const prefillPhone = query.phone || '';

    this.appContent.innerHTML = `
      <div class="container section">
        <div class="tracking-form-box">
          <div style="text-align: center; margin-bottom: 2rem;">
            <div style="width: 60px; height: 60px; border-radius: 50%; background: var(--color-primary-100); color: var(--color-primary-700); display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin: 0 auto 1rem;">
              📦
            </div>
            <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--color-text-main); margin-bottom: 0.5rem;">
              Track Your Karachi Mart Order
            </h1>
            <p style="font-size: 0.95rem; color: var(--color-text-muted);">
              Enter your Order Reference Number and Contact Phone Number to view live order dispatch status.
            </p>
          </div>

          <!-- Privacy Security Notice as mandated -->
          <div style="background: var(--color-primary-50); border: 1px solid var(--color-primary-200); border-radius: var(--radius-md); padding: 0.85rem 1rem; margin-bottom: 1.5rem; font-size: 0.82rem; color: var(--color-primary-900);">
            🔒 <strong>Customer Privacy Protected:</strong> Order information is strictly protected and requires telephone verification to prevent unauthorized access.
          </div>

          <form id="order-tracking-form">
            <div class="form-group">
              <label class="form-label" for="track-order-ref">Order Reference Number <span class="required">*</span></label>
              <input type="text" id="track-order-ref" class="form-control" placeholder="e.g. KM-20261015-8492" value="${prefillRef}" style="text-transform: uppercase;" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="track-phone">Customer Phone Number <span class="required">*</span></label>
              <input type="tel" id="track-phone" class="form-control" placeholder="0300-1234567" value="${prefillPhone}" required>
              <div class="form-hint">The Pakistani mobile number specified during checkout.</div>
            </div>

            <button type="submit" id="track-submit-btn" class="btn btn-primary btn-block btn-lg" style="margin-top: 1.25rem;">
              Lookup Order Status →
            </button>
          </form>

          <!-- Quick Test Buttons for evaluators -->
          <div style="margin-top: 1.75rem; padding-top: 1.25rem; border-top: 1px solid var(--color-border); font-size: 0.82rem;">
            <div style="font-weight: 700; color: var(--color-text-muted); margin-bottom: 0.5rem;">Sample Orders to Test in Demo Mode:</div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" id="test-order-1">Order #KM-20261015-8492 (Out for Delivery)</button>
              <button class="btn btn-secondary btn-sm" id="test-order-2">Order #KM-20261014-4190 (Delivered)</button>
            </div>
          </div>
        </div>

        <!-- Tracking Results Container -->
        <div id="tracking-results-area" style="max-width: 720px; margin: 2rem auto 0;"></div>
      </div>
    `;

    // Test buttons handlers
    const test1 = document.getElementById('test-order-1');
    const test2 = document.getElementById('test-order-2');
    const refInput = document.getElementById('track-order-ref');
    const phoneInput = document.getElementById('track-phone');

    if (test1 && refInput && phoneInput) {
      test1.addEventListener('click', () => {
        refInput.value = 'KM-20261015-8492';
        phoneInput.value = '0300-1234567';
        document.getElementById('track-submit-btn').click();
      });
    }

    if (test2 && refInput && phoneInput) {
      test2.addEventListener('click', () => {
        refInput.value = 'KM-20261014-4190';
        phoneInput.value = '0321-9876543';
        document.getElementById('track-submit-btn').click();
      });
    }

    // Form submission
    const form = document.getElementById('order-tracking-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const refVal = refInput?.value?.trim();
        const phoneVal = phoneInput?.value?.trim();
        await this.performOrderTracking(refVal, phoneVal);
      });
    }

    // Auto-search if query params were prefilled
    if (prefillRef && prefillPhone) {
      this.performOrderTracking(prefillRef, prefillPhone);
    }
  }

  async performOrderTracking(orderNumber, phone) {
    const resultsArea = document.getElementById('tracking-results-area');
    const btn = document.getElementById('track-submit-btn');
    if (!resultsArea) return;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Searching Records...';
    }

    try {
      const order = await dataService.trackOrder(orderNumber, phone);

      if (!order) {
        resultsArea.innerHTML = `
          <div style="background: #ffffff; border: 1.5px solid var(--color-danger-500); border-radius: var(--radius-lg); padding: 2rem; text-align: center;">
            <div style="font-size: 2rem; color: var(--color-danger-600); margin-bottom: 0.5rem;">✕</div>
            <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--color-danger-600); margin-bottom: 0.5rem;">No Matching Order Found</h3>
            <p style="font-size: 0.95rem; color: var(--color-text-body); max-width: 480px; margin: 0 auto;">
              No order was found matching reference "<strong>${orderNumber}</strong>" with phone number "<strong>${phone}</strong>". Please ensure both credentials correspond to the original order.
            </p>
          </div>
        `;
        return;
      }

      // Render interactive timeline
      const statusMap = {
        'pending': 1,
        'confirmed': 2,
        'packed': 3,
        'out_for_delivery': 4,
        'delivered': 5
      };

      const currentStage = statusMap[order.status] || 1;

      const timelineSteps = [
        { label: 'Order Placed', time: 'Received by Karachi Mart', icon: '📝', stage: 1 },
        { label: 'Confirmed by Karachi Mart', time: 'Stock allocated at hub', icon: '✓', stage: 2 },
        { label: 'Packed at Karachi Hub', time: 'Chilled items prepped', icon: '📦', stage: 3 },
        { label: 'Out for Delivery', time: 'Rider assigned with thermal bag', icon: '🛵', stage: 4 },
        { label: 'Delivered & Paid', time: 'Cash on delivery complete', icon: '🏠', stage: 5 }
      ];

      resultsArea.innerHTML = `
        <div style="background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 2.5rem; box-shadow: var(--shadow-md);">
          <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 1rem; border-bottom: 1px solid var(--color-border-subtle); padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
            <div>
              <span class="badge ${order.status === 'delivered' ? 'badge-instock' : 'badge-sale'}">
                Status: ${order.status.replace(/_/g, ' ').toUpperCase()}
              </span>
              <h2 style="font-size: 1.5rem; font-weight: 800; margin-top: 0.35rem;">Order ${order.orderNumber}</h2>
              <div style="font-size: 0.85rem; color: var(--color-text-muted);">
                Destination: <strong>${order.area}, Karachi</strong> • Total: <strong>Rs. ${order.totalAmount.toLocaleString()}</strong>
              </div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.85rem; color: var(--color-text-muted);">Estimated Window</span>
              <div style="font-weight: 700; color: var(--color-primary-800);">${order.deliverySlot || 'Standard Delivery'}</div>
            </div>
          </div>

          <!-- Timeline -->
          <div class="tracking-timeline">
            ${timelineSteps.map(step => {
              const isDone = currentStage >= step.stage;
              const isActive = currentStage === step.stage;
              return `
                <div class="timeline-step ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''}">
                  <div class="timeline-step-icon">${step.icon}</div>
                  <div class="timeline-step-content">
                    <div class="timeline-step-label">${step.label}</div>
                    <div class="timeline-step-time">${step.time}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Itemized Breakdown -->
          <div style="background: var(--color-surface-bg); border-radius: var(--radius-md); padding: 1.25rem; margin-top: 2rem;">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem;">Order Items Summary</h4>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.88rem;">
              ${order.items.map(it => `
                <div style="display: flex; justify-content: space-between;">
                  <span>${it.name} x ${it.quantity}</span>
                  <span style="font-weight: 700;">Rs. ${(it.price * it.quantity).toLocaleString()}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      resultsArea.innerHTML = `<div class="toast toast-error">${err.message}</div>`;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Lookup Order Status →';
      }
    }
  }

  // ==========================================================================
  // View 9: About Us Page
  // ==========================================================================
  renderAboutPage() {
    this.appContent.innerHTML = `
      <div class="container section">
        <div class="policy-card">
          <div style="text-align: center; margin-bottom: 2.5rem;">
            <span class="section-subtitle">Our Karachi Story</span>
            <h1 style="font-size: 2.4rem; font-weight: 800; margin-top: 0.5rem;">About Karachi Mart</h1>
            <p style="color: var(--color-text-muted); font-size: 1.1rem; max-width: 620px; margin: 0.5rem auto 0;">
              Fresh groceries, local trust, and friendly service across the City of Lights.
            </p>
          </div>

          <div style="background: var(--color-primary-50); border: 1px solid var(--color-primary-200); border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 2rem; font-size: 0.95rem; color: var(--color-primary-900);">
            💡 <strong>Portfolio Demonstration:</strong> Karachi Mart is a fictional supermarket concept developed for an advanced e-commerce & CRM architecture portfolio.
          </div>

          <h2>Serving Karachi with Pride</h2>
          <p>
            Karachi Mart was envisioned to solve the daily grocery challenge faced by millions of families across Karachi. From early morning breakfast chai to late-night emergency kitchen staples, our mission is to deliver farm-fresh quality at honest prices.
          </p>

          <h2>Direct Farm-to-Kitchen Sourcing</h2>
          <p>
            We partner directly with growers across interior Sindh for plump tomatoes, crisp onions, and world-renowned Sindhri mangoes. By cutting out middleman layers, we ensure maximum freshness for your family and fair earnings for regional growers.
          </p>

          <h2>Neighborhood Express Dispatch Hubs</h2>
          <p>
            Rather than fulfilling all orders from a distant warehouse, Karachi Mart operates localized fulfillment nodes in Gulshan-e-Iqbal, PECHS, North Nazimabad, and DHA. This localized cold-chain network enables temperature-controlled deliveries in under 2 hours.
          </p>

          <h2>Our Core Values</h2>
          <ul>
            <li><strong>Authentic Brands:</strong> We never stock counterfeit or substandard food products. Every item from Dalda to Surf Excel is 100% genuine.</li>
            <li><strong>Fair Pricing in PKR:</strong> Clear, competitive supermarket prices without unexpected checkout surcharges.</li>
            <li><strong>Customer Satisfaction:</strong> If any fruit, vegetable, or dairy item does not meet your high standards upon doorstep delivery, hand it right back to our rider without questions.</li>
          </ul>

          <div style="text-align: center; margin-top: 3rem;">
            <a href="#shop" class="btn btn-primary btn-lg">Explore Our Fresh Catalogue →</a>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // View 10: Contact Us Page
  // ==========================================================================
  renderContactPage() {
    this.appContent.innerHTML = `
      <div class="container section">
        <div style="max-width: 900px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 3rem;">
            <span class="section-subtitle">Get in Touch</span>
            <h1 style="font-size: 2.4rem; font-weight: 800; margin-top: 0.5rem;">Contact Karachi Mart</h1>
            <p style="color: var(--color-text-muted); font-size: 1.05rem;">
              Have questions about an order or delivery coverage in your Karachi neighbourhood?
            </p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2.5rem; align-items: start;">
            <!-- Contact Form -->
            <div style="background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 2.25rem; box-shadow: var(--shadow-sm);">
              <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.25rem;">Send a Message</h3>
              <form id="contact-inquiry-form">
                <div class="form-group">
                  <label class="form-label" for="cnt-name">Your Full Name <span class="required">*</span></label>
                  <input type="text" id="cnt-name" class="form-control" placeholder="e.g. Asad Siddiqui" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="cnt-phone">Phone Number <span class="required">*</span></label>
                  <input type="tel" id="cnt-phone" class="form-control" placeholder="0300-1234567" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="cnt-area">Karachi Area</label>
                  <select id="cnt-area" class="form-control">
                    ${KARACHI_AREAS.map(a => `<option value="${a.name}">${a.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="cnt-msg">Message / Inquiry <span class="required">*</span></label>
                  <textarea id="cnt-msg" class="form-control" rows="4" placeholder="How can our customer service team help you?" required></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Send Message</button>
              </form>
            </div>

            <!-- Store Details Card -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
              <div style="background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.75rem;">
                <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem;">Karachi Fulfillment Hub</h4>
                <div style="display: flex; flex-direction: column; gap: 0.85rem; font-size: 0.92rem; color: var(--color-text-body);">
                  <div>📍 <strong>Address:</strong><br>${APP_CONFIG.storeAddress}</div>
                  <div>📞 <strong>UAN Phone:</strong><br>${APP_CONFIG.storeUan}</div>
                  <div>💬 <strong>WhatsApp Support:</strong><br>${APP_CONFIG.storeWhatsapp}</div>
                  <div>📧 <strong>Email:</strong><br>${APP_CONFIG.storeEmail}</div>
                  <div>⏰ <strong>Operating Hours:</strong><br>${APP_CONFIG.supportHours}</div>
                </div>
              </div>

              <div style="background: var(--color-primary-50); border: 1px solid var(--color-primary-200); border-radius: var(--radius-lg); padding: 1.5rem;">
                <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--color-primary-900); margin-bottom: 0.5rem;">Need to Track an Order?</h4>
                <p style="font-size: 0.88rem; color: var(--color-primary-800); margin-bottom: 1rem;">
                  If you already placed an order, you can check its live packing and rider dispatch status directly on our tracking portal.
                </p>
                <a href="#tracking" class="btn btn-secondary btn-sm">Go to Order Tracking →</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const contactForm = document.getElementById('contact-inquiry-form');
    if (contactForm) {
      contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        toast.success('Thank you! Your demo inquiry has been received. Our team will contact you shortly.');
        contactForm.reset();
      });
    }
  }

  // ==========================================================================
  // View 11 & 12: Privacy Policy & Terms of Service
  // ==========================================================================
  renderPolicyPage(type) {
    if (type === 'privacy') {
      this.appContent.innerHTML = `
        <div class="container section">
          <div class="policy-card">
            <h1>Privacy Policy</h1>
            <p style="color: var(--color-text-muted); font-size: 0.9rem;">Last Updated: October 2026 • Karachi Mart Fictional Demo</p>

            <div style="background: var(--color-primary-50); border: 1px solid var(--color-primary-200); border-radius: var(--radius-md); padding: 1rem; margin: 1.5rem 0; font-size: 0.9rem;">
              <strong>Demo Disclaimer:</strong> Karachi Mart is a portfolio supermarket demonstration project. No real personal banking details are collected, and simulated customer data is never sold to third parties.
            </div>

            <h2>1. Information We Collect</h2>
            <p>To facilitate grocery delivery across Karachi, we collect:</p>
            <ul>
              <li>Customer Full Name and Pakistani telephone number for delivery coordination.</li>
              <li>Delivery address, Karachi neighbourhood, and optional landmarks.</li>
              <li>Order item quantities and cart contents.</li>
            </ul>

            <h2>2. How Your Information is Protected</h2>
            <p>
              In accordance with secure web standards, order lookups are protected: visitors cannot view order records simply by guessing order numbers. Both the order reference and customer phone number must match before records are displayed.
            </p>

            <h2>3. Payment Security</h2>
            <p>
              Karachi Mart operates solely on Cash on Delivery (COD) for this demo. We do not store, process, or request credit card numbers, debit cards, or bank login credentials.
            </p>

            <h2>4. Contact Us</h2>
            <p>
              For any questions regarding privacy on this demo site, contact <strong>${APP_CONFIG.storeEmail}</strong>.
            </p>
          </div>
        </div>
      `;
    } else {
      this.appContent.innerHTML = `
        <div class="container section">
          <div class="policy-card">
            <h1>Terms and Conditions</h1>
            <p style="color: var(--color-text-muted); font-size: 0.9rem;">Effective: October 2026 • Karachi Mart Supermarket</p>

            <div style="background: var(--color-accent-50); border: 1px solid var(--color-accent-200); border-radius: var(--radius-md); padding: 1rem; margin: 1.5rem 0; font-size: 0.9rem; color: var(--color-accent-800);">
              <strong>Notice:</strong> This website is an educational and portfolio demonstration. Orders placed do not constitute legally binding commercial contracts for physical delivery.
            </div>

            <h2>1. Product Pricing and Availability</h2>
            <p>
              All prices are quoted in Pakistani Rupees (PKR / Rs.). While we strive for absolute accuracy, stock quantities and promotional prices are subject to dynamic database revalidation.
            </p>

            <h2>2. Delivery Across Karachi</h2>
            <p>
              Delivery time estimates (typically 45 to 120 minutes) depend on the customer's specified Karachi delivery zone, traffic conditions, and dispatch hub stock.
            </p>

            <h2>3. Doorstep Returns & Quality Guarantee</h2>
            <p>
              Customers may inspect all grocery items upon arrival. Any damaged or unacceptable produce can be returned to the courier immediately upon delivery without penalty.
            </p>

            <h2>4. Shared Database Integration</h2>
            <p>
              When integrated with the Karachi Mart CRM via Supabase, orders submitted through this website are transmitted directly to the administrative order fulfillment queue.
            </p>
          </div>
        </div>
      `;
    }
  }

  // ==========================================================================
  // Product Card Template & Handlers Helper
  // ==========================================================================
  renderProductCardHtml(product) {
    const discountPercent = product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : null;

    const isOutOfStock = product.stock <= 0;
    const isLowStock = product.stock > 0 && product.stock <= 5;

    return `
      <div class="product-card" data-product-id="${product.id}">
        <div class="product-card-media">
          <img src="${product.image}" alt="${product.name}" class="product-card-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80'">
          
          <div class="product-card-badges">
            ${discountPercent ? `<span class="badge badge-sale">-${discountPercent}%</span>` : ''}
            ${product.isBestSeller ? `<span class="badge badge-bestseller">Top Seller</span>` : ''}
          </div>

          <button class="product-card-quickview" data-action="quickview" data-id="${product.id}" title="Quick View">
            👁
          </button>
        </div>

        <div class="product-card-body">
          <div class="product-card-meta">
            <span class="product-card-sku">${product.sku}</span>
            <span style="text-transform: capitalize;">${product.category.replace('-', ' ')}</span>
          </div>

          <h3 class="product-card-title">
            <a href="#product/${product.id}">${product.name}</a>
          </h3>

          <div class="product-card-unit">${product.unit}</div>

          <div class="product-card-rating">
            <span>★ ${product.rating}</span>
            <span class="rating-count">(${product.reviewsCount})</span>
          </div>

          <div class="product-card-price-wrap">
            <span class="product-card-price">Rs. ${product.price.toLocaleString()}</span>
            ${product.compareAtPrice ? `<span class="product-card-compare">Rs. ${product.compareAtPrice.toLocaleString()}</span>` : ''}
          </div>

          <div class="product-card-stock">
            <span class="stock-dot ${isOutOfStock ? 'out' : isLowStock ? 'low' : ''}"></span>
            <span style="font-size: 0.78rem; font-weight: 600; color: ${isOutOfStock ? 'var(--color-danger-600)' : isLowStock ? 'var(--color-accent-700)' : 'var(--color-primary-700)'}">
              ${isOutOfStock ? 'Out of Stock' : isLowStock ? `Only ${product.stock} left` : 'In Stock'}
            </span>
          </div>

          <div class="product-card-actions">
            <button class="btn btn-primary btn-block btn-sm" data-action="add-to-cart" data-id="${product.id}" ${isOutOfStock ? 'disabled' : ''}>
              ${isOutOfStock ? 'Out of Stock' : '+ Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  attachProductCardEvents(container) {
    if (!container) return;

    // Quick view buttons
    container.querySelectorAll('[data-action="quickview"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        this.openQuickView(id);
      });
    });

    // Add to cart buttons
    container.querySelectorAll('[data-action="add-to-cart"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        btn.disabled = true;
        btn.textContent = 'Adding...';
        const product = await dataService.getProductById(id);
        if (product) {
          await cartService.addItem(product, 1);
        }
        btn.disabled = false;
        btn.textContent = '+ Add to Cart';
      });
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
  window.KarachiMartApp = app;
});
