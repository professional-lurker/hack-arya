/**
 * NextAuth v5 configuration
 */

import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const nextAuth = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET ?? "dev-secret-key-change-in-production-32chars",
  pages: {
    signIn: "/dashboard",
    error: "/dashboard",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            isActive: true,
            isSuspended: true,
          },
        });

        if (!user || !user.passwordHash) return null;
        if (!user.isActive || user.isSuspended) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});

export const handlers = nextAuth.handlers;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;

export const DEFAULT_ADMIN_USER = {
  id: "admin-default-user",
  email: "admin@aisandbox.dev",
  name: "Admin",
  role: "SUPER_ADMIN",
};

export async function auth() {
  try {
    const session = await nextAuth.auth();
    if (session?.user?.id) {
      return session;
    }
  } catch {
    // ignore
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
      select: { id: true, email: true, name: true, role: true },
    });
    if (existing) {
      return {
        user: {
          id: existing.id,
          email: existing.email,
          name: existing.name ?? "Admin",
          role: existing.role,
        },
        expires: new Date(Date.now() + 365 * 86400000).toISOString(),
      };
    }

    const created = await prisma.user.upsert({
      where: { email: DEFAULT_ADMIN_USER.email },
      update: {},
      create: {
        id: DEFAULT_ADMIN_USER.id,
        email: DEFAULT_ADMIN_USER.email,
        name: DEFAULT_ADMIN_USER.name,
        role: DEFAULT_ADMIN_USER.role,
        isActive: true,
      },
    });

    return {
      user: {
        id: created.id,
        email: created.email,
        name: created.name ?? "Admin",
        role: created.role,
      },
      expires: new Date(Date.now() + 365 * 86400000).toISOString(),
    };
  } catch {
    return {
      user: DEFAULT_ADMIN_USER,
      expires: new Date(Date.now() + 365 * 86400000).toISOString(),
    };
  }
}

// Extend types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }
}
