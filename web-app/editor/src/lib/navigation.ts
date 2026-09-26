import { routePath, type Route } from './routes';

/** Event name the app root listens to for client-side route changes. */
export const ROUTE_CHANGE_EVENT = 'hpe:routechange';

/**
 * Moves to another prerendered route without a page load, so in-memory state such as a
 * file picked on the home page carries over. The URL is the same one a full load would use.
 */
export function navigate(route: Route): void {
  window.history.pushState(null, '', routePath(route));
  window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT));
  window.scrollTo(0, 0);
}
