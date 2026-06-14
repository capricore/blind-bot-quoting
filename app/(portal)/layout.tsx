import Sidebar from "@/components/Sidebar";
import { db, getDraftQuote, getQuote } from "@/lib/db";

// Every portal page reads live SQLite state; opt this subtree out of static prerendering.
export const dynamic = "force-dynamic";

export default function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  db();
  const draft = getDraftQuote();
  const draftCount = draft ? getQuote(draft.id)!.items.length : 0;

  return (
    <>
      <Sidebar draftCount={draftCount} />
      <main className="ml-60 min-h-screen">
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </main>
    </>
  );
}
