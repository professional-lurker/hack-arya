import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  const user = session?.user ?? {
    name: "Admin",
    email: "admin@aisandbox.dev",
    role: "SUPER_ADMIN",
  };

  return (
    <div className="flex min-h-screen bg-[hsl(var(--background))]">
      <Sidebar user={user} />
      <main className="flex-1 ml-60 p-8 min-h-screen">
        {children}
      </main>
    </div>
  );
}

