import { UserRole } from "./jwt";

export interface RoutePermission {
  pathPrefix: string;
  allowedRoles: UserRole[];
  loginRedirect: string;
  unauthorizedRedirect: string;
}

export const PROTECTED_ROUTES: RoutePermission[] = [
  {
    pathPrefix: "/admin",
    allowedRoles: ["ADMIN"],
    loginRedirect: "/login?redirect=/admin",
    unauthorizedRedirect: "/unauthorized",
  },
  {
    pathPrefix: "/cashier",
    allowedRoles: ["CASHIER"],
    loginRedirect: "/login?redirect=/cashier",
    unauthorizedRedirect: "/unauthorized",
  },
  {
    pathPrefix: "/chef",
    allowedRoles: ["CHEF", "ADMIN"],
    loginRedirect: "/login?redirect=/chef",
    unauthorizedRedirect: "/unauthorized",
  },
  {
    pathPrefix: "/account",
    allowedRoles: ["CUSTOMER", "CASHIER", "CHEF", "ADMIN"],
    loginRedirect: "/login?redirect=/account",
    unauthorizedRedirect: "/login",
  },
];

/**
 * Cek apakah role pengguna memiliki salah satu role yang diizinkan
 */
export function hasRole(currentRole: UserRole | undefined | null, allowedRoles: UserRole[]): boolean {
  if (!currentRole) return false;
  return allowedRoles.includes(currentRole);
}

const CUSTOMER_FACING_PREFIXES = ["/", "/menu", "/lacak", "/checkout", "/orders", "/info"];

export function isCustomerFacingPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return CUSTOMER_FACING_PREFIXES.some(
    (prefix) => prefix !== "/" && (pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );
}

/**
 * Evaluasi izin akses terhadap suatu path URL
 */
export function evaluatePathAccess(
  pathname: string,
  userRole: UserRole | null | undefined
): {
  isProtected: boolean;
  allowed: boolean;
  redirectUrl?: string;
} {
  for (const route of PROTECTED_ROUTES) {
    if (pathname === route.pathPrefix || pathname.startsWith(`${route.pathPrefix}/`)) {
      if (!userRole) {
        // Belum terautentikasi -> arahkan ke login
        return {
          isProtected: true,
          allowed: false,
          redirectUrl: `${route.loginRedirect}`,
        };
      }

      if (!hasRole(userRole, route.allowedRoles)) {
        // Terautentikasi tapi hak akses tidak sesuai -> 403 Forbidden / Unauthorized
        return {
          isProtected: true,
          allowed: false,
          redirectUrl: route.unauthorizedRedirect,
        };
      }

      return { isProtected: true, allowed: true };
    }
  }

  // Admin, Kasir, dan Chef yang masih aktif login dikunci di dashboard masing-masing
  if ((userRole === "ADMIN" || userRole === "CASHIER" || userRole === "CHEF") && isCustomerFacingPath(pathname)) {
    return {
      isProtected: true,
      allowed: false,
      redirectUrl: getDefaultRedirectForRole(userRole),
    };
  }

  // Bukan rute terproteksi (atau guest/customer pada rute user)
  return { isProtected: false, allowed: true };
}

/**
 * Tentukan redirect default berdasarkan role setelah login berhasil
 */
export function getDefaultRedirectForRole(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "CASHIER":
      return "/cashier";
    case "CHEF":
      return "/chef";
    case "CUSTOMER":
    default:
      return "/";
  }
}

