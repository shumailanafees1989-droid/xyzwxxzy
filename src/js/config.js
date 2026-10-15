/**
 * Karachi Mart - Global Application Configuration
 * Contains brand settings, Karachi delivery parameters, promo codes,
 * and Supabase connection discovery with automated Demo Mode fallback.
 */

export const APP_CONFIG = {
  brandName: 'Karachi Mart',
  tagline: "Karachi's Fresh & Friendly Supermarket",
  currency: 'Rs.',
  currencyCode: 'PKR',
  
  // Delivery rules
  freeDeliveryThreshold: 2000, // Free delivery on orders over Rs. 2,000
  standardDeliveryFee: 150,    // Standard flat delivery fee in PKR
  
  // Demo Mode status
  isDemo: true, // Clearly marked as fictional portfolio supermarket
  demoDisclaimer: 'Fictional demo supermarket for portfolio evaluation. No real transactions or physical deliveries will occur.',
  
  // Store contact information
  storeAddress: 'Plot 42-C, Main Rashid Minhas Road, Block 5, Gulshan-e-Iqbal, Karachi, Pakistan',
  storeUan: '+92 (21) 111-MART-99 (Demo)',
  storeWhatsapp: '+92 300 0000000',
  storeEmail: 'support@karachimart.demo',
  supportHours: '8:00 AM – 11:30 PM PST (7 Days a week)',

  // Promo Codes for testing checkout
  promoCodes: {
    'WELCOME100': { type: 'fixed', value: 100, minOrder: 1000, description: 'Rs. 100 OFF on orders above Rs. 1,000' },
    'KARACHI10': { type: 'percentage', value: 10, minOrder: 1500, description: '10% OFF on orders above Rs. 1,500' },
    'FREEDELIVERY': { type: 'free_delivery', value: 0, minOrder: 0, description: 'Free Express Delivery across Karachi' },
    'SUPERMARKET': { type: 'fixed', value: 250, minOrder: 3000, description: 'Rs. 250 OFF on orders above Rs. 3,000' }
  },

  // Supabase Connection Settings
  // These can be supplied via window.KARACHI_MART_SUPABASE or localStorage for runtime customization
  supabase: {
    url: window?.KARACHI_MART_SUPABASE?.url || localStorage.getItem('km_supabase_url') || '',
    anonKey: window?.KARACHI_MART_SUPABASE?.anonKey || localStorage.getItem('km_supabase_anon_key') || ''
  }
};

/**
 * Checks if Supabase credentials have been configured
 */
export function isSupabaseConfigured() {
  const cfg = APP_CONFIG.supabase;
  return Boolean(cfg.url && cfg.anonKey && cfg.url.startsWith('https://'));
}

/**
 * Sets Supabase configuration at runtime and persists to localStorage
 */
export function setSupabaseConfig(url, anonKey) {
  if (url && anonKey) {
    localStorage.setItem('km_supabase_url', url.trim());
    localStorage.setItem('km_supabase_anon_key', anonKey.trim());
    APP_CONFIG.supabase.url = url.trim();
    APP_CONFIG.supabase.anonKey = anonKey.trim();
    return true;
  }
  return false;
}

/**
 * Clears Supabase configuration to revert to local Demo Mode
 */
export function clearSupabaseConfig() {
  localStorage.removeItem('km_supabase_url');
  localStorage.removeItem('km_supabase_anon_key');
  APP_CONFIG.supabase.url = '';
  APP_CONFIG.supabase.anonKey = '';
}
