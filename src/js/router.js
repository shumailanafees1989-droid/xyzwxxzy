/**
 * Karachi Mart - Client-Side SPA Router
 * Handles hash-based routing with deep-linking, browser history, and scroll restoration.
 */

class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.beforeNavigateCallbacks = [];
    this.afterNavigateCallbacks = [];

    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
  }

  /**
   * Register a route handler
   * e.g., registerRoute('shop', (params) => renderShop(params))
   */
  register(path, handler) {
    this.routes[path] = handler;
  }

  /**
   * Programmatic navigation
   */
  navigate(routePath) {
    window.location.hash = routePath.startsWith('#') ? routePath : `#${routePath}`;
  }

  onBeforeNavigate(cb) {
    this.beforeNavigateCallbacks.push(cb);
  }

  onAfterNavigate(cb) {
    this.afterNavigateCallbacks.push(cb);
  }

  parseHash() {
    const rawHash = window.location.hash.slice(1).trim() || 'home';
    const [pathPart, queryPart] = rawHash.split('?');
    const segments = pathPart.split('/').filter(Boolean);
    const mainRoute = segments[0] || 'home';
    const param = segments[1] || null;

    const queryParams = {};
    if (queryPart) {
      const searchParams = new URLSearchParams(queryPart);
      for (const [key, value] of searchParams.entries()) {
        queryParams[key] = value;
      }
    }

    return {
      rawHash,
      mainRoute,
      param,
      queryParams,
      fullRoute: pathPart
    };
  }

  handleRoute() {
    const routeInfo = this.parseHash();
    this.currentRoute = routeInfo;

    // Run before hooks
    this.beforeNavigateCallbacks.forEach(cb => cb(routeInfo));

    // Match registered route or fallback to home
    const handler = this.routes[routeInfo.mainRoute] || this.routes['home'];

    if (handler) {
      handler(routeInfo);
    } else {
      console.warn('No route handler found for', routeInfo.mainRoute);
    }

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Run after hooks
    this.afterNavigateCallbacks.forEach(cb => cb(routeInfo));
  }
}

export const router = new Router();
