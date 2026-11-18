import AppError from '../utils/AppError';
import { verifyGuestToken } from '../modules/customer/guest.service';

export const authorizeRequest = (req, res, next) => {
  // If the route doesn't have openapi spec, or doesn't have x-authz, skip
  if (!req.openapi || !req.openapi.schema || !req.openapi.schema['x-authz']) {
    return next();
  }

  const authz = req.openapi.schema['x-authz'];

  // If it's public, allow anyone (authenticated or guest)
  if (
    authz.scope === 'public' ||
    (authz.roles && (authz.roles.includes('public') || authz.roles.includes('guest(public)')))
  ) {
    return next();
  }

  const roles = Array.isArray(authz.roles) ? authz.roles : [];
  const allowsGuestLookup =
    roles.some((r) => typeof r === 'string' && r.startsWith('guest(') && (r.includes('lookup') || r.includes('verified'))) ||
    authz.auth === 'lookup token' ||
    (typeof authz.auth === 'string' && authz.auth.includes('guest lookup token'));
  const allowsGuestCart =
    roles.some((r) => typeof r === 'string' && (r === 'guest(token)' || r === 'guest(cart token)'));

  // If route allows guest lookup token and header is present
  const guestLookupHeader = req.headers['x-guest-lookup-token'];
  if (!req.actor && guestLookupHeader && allowsGuestLookup) {
    try {
      if (!req.guest) {
        req.guest = verifyGuestToken(String(guestLookupHeader).trim());
      }
      return next();
    } catch (err) {
      return next(err);
    }
  }

  // If route allows guest cart token (e.g., /checkout, /checkout/quote, /cart/*)
  const guestCartHeader = req.headers['x-guest-cart-token'];
  if (!req.actor && typeof guestCartHeader === 'string' && guestCartHeader.trim().length > 0 && allowsGuestCart) {
    return next();
  }

  // If requires authentication, verify the actor exists
  if (!req.actor) {
    return next(new AppError(401, 'Unauthenticated', 'AUTHENTICATION_ERROR', 'You must be logged in to access this resource'));
  }

  // If route allows any authenticated user, allow immediately
  if (authz.roles && authz.roles.includes('any authenticated')) {
    return next();
  }

  const actorRole = req.actor.systemRole;
  const actorSubRole = req.actor.staffSubRole;

  // Check if actor's role is in the allowed roles
  // We handle specific role strings like 'ADMIN', 'MANAGER', 'CUSTOMER', 'RECEPTIONIST' (which is a staffSubRole)
  let hasRole = false;
  if (authz.roles && Array.isArray(authz.roles)) {
    for (const allowed of authz.roles) {
      if ((allowed === 'ADMIN' || allowed.startsWith('ADMIN(')) && actorRole === 'ADMIN') hasRole = true;
      if ((allowed === 'MANAGER' || allowed.startsWith('MANAGER(')) && actorRole === 'MANAGER') hasRole = true;
      if ((allowed === 'CUSTOMER' || allowed.startsWith('CUSTOMER(')) && actorRole === 'CUSTOMER') hasRole = true;
      if ((allowed === 'STAFF' || allowed.startsWith('STAFF(')) && actorRole === 'STAFF') hasRole = true;
      
      // staffSubRoles checking
      if (actorRole === 'STAFF') {
        if ((allowed === 'RECEPTIONIST' || allowed.startsWith('RECEPTIONIST(')) && actorSubRole === 'RECEPTIONIST') hasRole = true;
        if ((allowed === 'VETERINARIAN' || allowed.startsWith('VETERINARIAN(')) && actorSubRole === 'VETERINARIAN') hasRole = true;
        if ((allowed === 'NURSE' || allowed.startsWith('NURSE(')) && actorSubRole === 'NURSE') hasRole = true;
        if ((allowed === 'CARE_STAFF_GROOMER' || allowed.startsWith('CARE_STAFF_GROOMER(')) && actorSubRole === 'CARE_STAFF_GROOMER') hasRole = true;
      }
    }
  }

  if (!hasRole) {
    return next(new AppError(403, 'Forbidden', 'AUTHORIZATION_ERROR', 'You do not have the required role to access this resource'));
  }

  // Pass to controller/service which will implement the Resource Scope Resolver (Branch/Ownership/Assignment)
  next();
};
