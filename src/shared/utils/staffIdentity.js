import mongoose from 'mongoose';
import StaffProfile from '../../modules/staff/models/StaffProfile';
import User from '../../models/User';

/**
 * Resolves any ID (which could be a StaffProfile._id or a User._id) into both identities.
 */
export const resolveStaffIdentity = async (idOrDoc) => {
  if (!idOrDoc) return null;

  let idStr = (idOrDoc?._id || idOrDoc?.id || idOrDoc).toString();
  if (!mongoose.Types.ObjectId.isValid(idStr)) return null;

  const objId = new mongoose.Types.ObjectId(idStr);

  // Try finding as StaffProfile first
  let staffProfile = await StaffProfile.findById(objId);
  let user = null;

  if (staffProfile) {
    user = await User.findById(staffProfile.userId);
  } else {
    // Try finding as User
    user = await User.findById(objId);
    if (user) {
      staffProfile = await StaffProfile.findOne({ userId: user._id });
    }
  }

  if (!user && !staffProfile) {
    return null;
  }

  return {
    userId: user ? user._id.toString() : null,
    staffProfileId: staffProfile ? staffProfile._id.toString() : null,
    staffCode: staffProfile?.staffCode || user?.staffCode || null,
    staffSubRole: staffProfile?.staffSubRole || user?.staffSubRole || null,
    fullName: user?.fullName || null,
    phone: user?.phone || null,
    email: user?.email || null,
    authorizedBranchIds: (staffProfile?.authorizedBranchIds || user?.assignedBranchIds || []).map((b) => b.toString()),
    user,
    staffProfile,
  };
};

/**
 * Check if an actor (from req.actor) matches a given staff ID
 * (whether that ID is a User._id or a StaffProfile._id).
 */
export const isActorStaffMatch = async (actor, targetStaffId) => {
  if (!actor || !targetStaffId) return false;
  if (actor.systemRole === 'ADMIN') return true; // Admin overrides

  const target = await resolveStaffIdentity(targetStaffId);
  if (!target) return false;

  const actorUserId = actor.id?.toString();
  return (
    target.userId === actorUserId ||
    target.staffProfileId === actorUserId
  );
};

