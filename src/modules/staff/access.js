export function staffHome(role) {
  return role === "admin" ? "/staff/admin" : role === "delivery" ? "/staff/delivery" : "/staff";
}

export function canAccessStaff(role, pathname) {
  if (pathname === "/staff") return true;
  if (role === "admin") return pathname === "/staff/admin" || pathname.startsWith("/staff/admin/");
  if (role === "delivery") return pathname === "/staff/delivery" || /^\/staff\/delivery\/[^/]+$/.test(pathname);
  return false;
}
