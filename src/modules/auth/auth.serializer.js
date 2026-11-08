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

  const uid = user._id ? user._id.toString() : (user.id ? user.id.toString() : '');
  return {
    id: uid,
    user_id: uid,
    userId: uid,
    fullName: user.fullName || '',
    full_name: user.fullName || '',
    name: user.fullName || '',
    email: user.email || null,
    phone: user.phone || null,
    avatarUrl: user.avatarUrl || null,
    avatar_url: user.avatarUrl || null,
    systemRole: user.systemRole || 'CUSTOMER',
    staffSubRole: user.staffSubRole || null,
    accountStatus,
    activationStatus,
    lastLogin,
    branchScope,
    addresses: (user.addresses || []).map((addr) => {
      const aid = addr._id ? addr._id.toString() : (addr.id ? addr.id.toString() : undefined);
      const addrLine = addr.addressDetail || addr.fullAddress || '';
      const prov = addr.province || 'Thành phố Hồ Chí Minh';
      return {
        _id: aid,
        id: aid,
        address_id: aid,
        fullName: addr.fullName,
        recipient_name: addr.fullName,
        name: addr.fullName,
        phone: addr.phone,
        recipient_phone: addr.phone,
        email: addr.email || null,
        recipient_email: addr.email || null,
        country: addr.country || 'Việt Nam',
        province: prov,
        city: prov,
        provinceCode: addr.provinceCode || null,
        district: addr.district || null,
        districtCode: addr.districtCode || null,
        ward: addr.ward || null,
        wardCode: addr.wardCode || null,
        addressDetail: addr.addressDetail || '',
        address_line: addrLine,
        address: addrLine,
        fullAddress: addr.fullAddress || [addr.addressDetail, addr.ward, addr.district, prov].filter(Boolean).join(', '),
        isDefault: Boolean(addr.isDefault),
        is_default: Boolean(addr.isDefault),
      };
    }),
  };
};

export const formatAuthTokens = ({ accessToken, refreshToken, expiresIn = 900, user }) => {
  const result = {
    accessToken,
    access_token: accessToken,
    token: accessToken,
    refreshToken: refreshToken || '',
    refresh_token: refreshToken || '',
    expiresIn,
    expires_in: expiresIn,
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
