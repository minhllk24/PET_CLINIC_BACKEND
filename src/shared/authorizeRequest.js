import AppError from '../utils/AppError';

export const authorizeRequest = (req, res, next) => {
  // If the route doesn't have openapi spec, or doesn't have x-authz, skip
  if (!req.openapi || !req.openapi.schema || !req.openapi.schema['x-authz']) {
    return next();
  }

  const authz = req.openapi.schema['x-authz'];
  
  // If it's public, allow
  if (authz.roles && (authz.roles.includes('public') || authz.roles.includes('any authenticated'))) {
    return next();
  }

  // If requires a specific role, verify the actor
  if (!req.actor) {
    return next(new AppError(401, 'Unauthenticated', 'AUTHENTICATION_ERROR', 'You must be logged in to access this resource'));
  }

  const actorRole = req.actor.systemRole;
  const actorSubRole = req.actor.staffSubRole;

  // Check if actor's role is in the allowed roles
  // We handle specific role strings like 'ADMIN', 'MANAGER', 'CUSTOMER', 'RECEPTIONIST' (which is a staffSubRole)
  let hasRole = false;
  if (authz.roles && Array.isArray(authz.roles)) {
    for (const allowed of authz.roles) {
      if (allowed === 'ADMIN' && actorRole === 'ADMIN') hasRole = true;
      if (allowed === 'MANAGER' && actorRole === 'MANAGER') hasRole = true;
      if (allowed === 'CUSTOMER' && actorRole === 'CUSTOMER') hasRole = true;
      if (allowed === 'STAFF' && actorRole === 'STAFF') hasRole = true;
      
      // staffSubRoles checking
      if (actorRole === 'STAFF') {
        if (allowed === 'RECEPTIONIST' && actorSubRole === 'RECEPTIONIST') hasRole = true;
        if (allowed === 'VETERINARIAN' && actorSubRole === 'VETERINARIAN') hasRole = true;
        if (allowed === 'NURSE' && actorSubRole === 'NURSE') hasRole = true;
        if (allowed === 'CARE_STAFF_GROOMER' && actorSubRole === 'CARE_STAFF_GROOMER') hasRole = true;
        
        // Handle STAFF(assigned appointment) or similar patterns by allowing basic access here,
        // and relying on Resource Scope Resolver logic later in the service layer for actual data access.
        if (allowed.startsWith('STAFF(')) hasRole = true; 
      }
    }
  }

  if (!hasRole) {
    return next(new AppError(403, 'Forbidden', 'AUTHORIZATION_ERROR', 'You do not have the required role to access this resource'));
  }

  // Pass to controller/service which will implement the Resource Scope Resolver (Branch/Ownership/Assignment)
  next();
};
