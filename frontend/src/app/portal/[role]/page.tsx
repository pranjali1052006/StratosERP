import Link from "next/link";
import { notFound } from "next/navigation";
import RoleWorkspace from "@/components/role-workspace";
import { roleBlueprints, roleBySlug, type RoleSlug } from "@/lib/role-blueprints";

type PageProps = {
  params: Promise<{
    role: RoleSlug;
  }>;
};

export function generateStaticParams() {
  return roleBlueprints.map((role) => ({ role: role.slug }));
}

export default async function PortalRolePage({ params }: PageProps) {
  const { role } = await params;
  const roleData = roleBySlug[role];

  if (!roleData) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100"
        >
          Back to launcher
        </Link>
      </div>
      <RoleWorkspace role={roleData} />
    </main>
  );
}
