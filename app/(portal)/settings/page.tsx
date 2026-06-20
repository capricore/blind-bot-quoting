import { PageHeader } from "@/components/ui";
import { BankSettingsForm } from "@/components/BankSettingsForm";
import { requireAdminPage } from "@/lib/auth/user";
import { getBankInfo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdminPage("/settings");
  const bank = await getBankInfo();
  return (
    <>
      <PageHeader eyebrow="Admin Console" title="Settings" description="Company details shown to retailers." />
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-ink">Bank transfer details</h2>
      <p className="mb-4 max-w-xl text-sm text-muted">
        Shown to a retailer who chooses bank transfer at checkout. Leave blank to hide.
      </p>
      <BankSettingsForm initial={bank} />
    </>
  );
}
