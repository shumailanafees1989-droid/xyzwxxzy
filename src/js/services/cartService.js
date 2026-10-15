/**
 * Karachi Mart - Shopping Cart Service
 * Manages cart state, stock quantity validation, promo discounts,
 * delivery fee calculation, and reactive subscriber updates.
 */

import { APP_CONFIG } from '../config.js';
import { dataService } from './dataService.js';
import { toast } from './toastService.js';

class CartService {
  constructor() {
    this.storageKey = 'km_shopping_cart_v2';
    this.promoStorageKey = 'km_applied_promo_v2';
    this.items = [];
    this.appliedPromo = null;
    this.subscribers = [];
    this.loadCart();
  }

  loadCart() {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.storageKey);
      this.items = stored ? JSON.parse(stored) : [];
      const storedPromo = localStorage.getItem(this.promoStorageKey);
      this.appliedPromo = storedPromo ? JSON.parse(storedPromo) : null;
    } catch (e) {
      this.items = [];
      this.appliedPromo = null;
    }
  }

  saveCart() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    if (this.appliedPromo) {
      localStorage.setItem(this.promoStorageKey, JSON.stringify(this.appliedPromo));
    } else {
      localStorage.removeItem(this.promoStorageKey);
    }
    this.notifySubscribers();
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    callback(this.getCartSummary());
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  notifySubscribers() {
    const summary = this.getCartSummary();
    this.subscribers.forEach(cb => {
      try {
        cb(summary);
      } catch (err) {
        console.error('Cart subscriber error:', err);
      }
    });
  }

  /**
   * Adds an item to the cart with stock verification
   */
  async addItem(product, quantity = 1) {
    if (!product || quantity <= 0) return false;

    // Fetch latest fresh product data from dataService to check real stock
    const freshProduct = await dataService.getProductById(product.id) || product;
    const availableStock = freshProduct.stock ?? 0;

    if (availableStock <= 0) {
      toast.error(`Sorry, "${product.name}" is currently out of stock.`);
      return false;
    }

    const existingIndex = this.items.findIndex(item => item.id === product.id);

    if (existingIndex > -1) {
      const currentQty = this.items[existingIndex].quantity;
      const targetQty = currentQty + quantity;

      if (targetQty > availableStock) {
        toast.warning(`Cannot add more. Only ${availableStock} units of "${product.name}" available in stock.`);
        return false;
      }

      this.items[existingIndex].quantity = targetQty;
      // Keep price updated from fresh product
      this.items[existingIndex].price = freshProduct.price;
    } else {
      if (quantity > availableStock) {
        toast.warning(`Only ${availableStock} units of "${product.name}" available.`);
        return false;
      }

      this.items.push({
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        price: freshProduct.price,
        unit: product.unit,
        image: product.image,
        quantity: quantity,
        maxStock: availableStock
      });
    }

    this.saveCart();
    toast.success(`Added ${product.name} to cart.`);
    return true;
  }

  /**
   * Updates item quantity with stock limit check
   */
  async updateQuantity(productId, newQuantity) {
    const itemIndex = this.items.findIndex(item => item.id === productId);
    if (itemIndex === -1) return false;

    if (newQuantity <= 0) {
      return this.removeItem(productId);
    }

    const freshProduct = await dataService.getProductById(productId);
    const availableStock = freshProduct ? freshProduct.stock : this.items[itemIndex].maxStock;

    if (newQuantity > availableStock) {
      toast.warning(`Cannot order more than ${availableStock} units of this item.`);
      this.items[itemIndex].quantity = availableStock;
      this.saveCart();
      return false;
    }

    this.items[itemIndex].quantity = newQuantity;
    this.saveCart();
    return true;
  }

  /**
   * Removes item from cart
   */
  removeItem(productId) {
    const item = this.items.find(i => i.id === productId);
    this.items = this.items.filter(i => i.id !== productId);
    this.saveCart();
    if (item) {
      toast.info(`Removed ${item.name} from your cart.`);
    }
    return true;
  }

  /**
   * Clears entire cart
   */
  clearCart() {
    this.items = [];
    this.appliedPromo = null;
    this.saveCart();
  }

  /**
   * Applies promotional discount code
   */
  applyPromoCode(code) {
    if (!code || typeof code !== 'string') {
      return { success: false, message: 'Please enter a promo code.' };
    }

    const cleanCode = code.trim().toUpperCase();
    const promoDef = APP_CONFIG.promoCodes[cleanCode];

    if (!promoDef) {
      return { success: false, message: 'Invalid promo code. Try WELCOME100, KARACHI10, or FREEDELIVERY.' };
    }

    const subtotal = this.getSubtotal();
    if (promoDef.minOrder && subtotal < promoDef.minOrder) {
      return {
        success: false,
        message: `Promo code ${cleanCode} requires a minimum order of Rs. ${promoDef.minOrder.toLocaleString()}.`
      };
    }

    this.appliedPromo = {
      code: cleanCode,
      ...promoDef
    };

    this.saveCart();
    return {
      success: true,
      message: `Promo code ${cleanCode} applied successfully! (${promoDef.description})`
    };
  }

  /**
   * Removes currently applied promo code
   */
  removePromoCode() {
    this.appliedPromo = null;
    this.saveCart();
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  getDiscount(subtotal) {
    if (!this.appliedPromo) return 0;

    const promo = this.appliedPromo;
    if (promo.minOrder && subtotal < promo.minOrder) {
      // Invalidate if subtotal dropped below threshold
      return 0;
    }

    if (promo.type === 'fixed') {
      return Math.min(promo.value, subtotal);
    }

    if (promo.type === 'percentage') {
      return Math.round((subtotal * promo.value) / 100);
    }

    return 0;
  }

  getDeliveryFee(subtotal) {
    if (this.items.length === 0) return 0;

    // Check if promo code gives free delivery
    if (this.appliedPromo && this.appliedPromo.type === 'free_delivery') {
      return 0;
    }

    // Karachi Mart Free Delivery threshold check (Rs. 2,000)
    if (subtotal >= APP_CONFIG.freeDeliveryThreshold) {
      return 0;
    }

    return APP_CONFIG.standardDeliveryFee;
  }

  getCartSummary() {
    const subtotal = this.getSubtotal();
    const discount = this.getDiscount(subtotal);
    const deliveryFee = this.getDeliveryFee(subtotal);
    const totalAmount = Math.max(0, subtotal - discount + deliveryFee);
    const totalItemsCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
    const freeDeliveryDifference = Math.max(0, APP_CONFIG.freeDeliveryThreshold - subtotal);

    return {
      items: [...this.items],
      totalItemsCount,
      subtotal,
      discount,
      appliedPromo: this.appliedPromo,
      deliveryFee,
      totalAmount,
      freeDeliveryThreshold: APP_CONFIG.freeDeliveryThreshold,
      freeDeliveryDifference,
      isFreeDeliveryEligible: deliveryFee === 0 && this.items.length > 0,
      isEmpty: this.items.length === 0
    };
  }
}

export const cartService = new CartService();
