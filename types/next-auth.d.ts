import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id?: string;
    role?: string;
    profileCompleted?: boolean;
  }

  interface Session {
    user: User;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    profileCompleted?: boolean;
    role?: string;
  }
}
