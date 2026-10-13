/**
 * Serializers to enforce strict OpenAPI v7 contract compliance (additionalProperties: false)
 * Strips all internal Mongoose fields (_id, __v, passwordHash, etc.)
 */

export const formatMe = (user) => {
  if (!user) return null;

  const isActivated = user.accountStatus === 'ACTIVE' || Boolean(user.activatedAt);
  const activationStatus = user.accountStatus === 'PENDING_ACTIVATION'
    ? 'PENDING_ACTIVATION'
    : (isActivated ? 'ACTIVATED' : 'NO_ACCOUNT');

  const accountStatus = (user.accountStatus === 'BLOCKED' || user.accountStatus === 'DEACTIVATED')
    ? 'BLOCKED'
    : 'ACTIVE';

  const lastLogin = (user.lastLoginAt || user.lastLogin)
    ? new Date(user.lastLoginAt || user.lastLogin).toISOString()
    : null;

  const branchScope = (user.assignedBranchIds || []).map((b) => {
    if (!b) return null;
    return b._id ? b._id.toString() : b.toString();
  }).filter(Boolean);

  return {
    id: user._id ? user._id.toString() : (user.id ? user.id.toString() : ''),
    fullName: user.fullName || '',
    email: user.email || null,
    phone: user.phone || null,
    systemRole: user.systemRole || 'CUSTOMER',
    staffSubRole: user.staffSubRole || null,
    accountStatus,
    activationStatus,
    lastLogin,
    branchScope,
  };
};

export const formatAuthTokens = ({ accessToken, refreshToken, expiresIn = 900, user }) => {
  const result = {
    accessToken,
    refreshToken: refreshToken || '',
    expiresIn,
  };

  if (user) {
    result.user = formatMe(user);
  }

  return result;
};

export default {
  formatMe,
  formatAuthTokens,
};
