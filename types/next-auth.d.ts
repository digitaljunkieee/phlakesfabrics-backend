import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";
import type { AppRole } from "../lib/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      branch?: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: AppRole;
    branch?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: AppRole;
    branch?: string | null;
  }
}
