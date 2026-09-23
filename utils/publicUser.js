module.exports = function publicUser(user) {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : user;
  return {
    _id: u._id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    notifications: u.notifications,
  };
};
