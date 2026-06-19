import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { admin } from "@/lib/supabase/admin";

const BUCKET = "accessory-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];

/** Upload a catalog image → public URL. Multipart body with a `file` field. Admin only. */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Use a PNG/JPEG/WebP/GIF/SVG image" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be ≤ 5 MB" }, { status: 400 });

    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `models/${crypto.randomUUID()}.${ext}`;
    const sb = admin(); // service_role → bypasses storage RLS for the write
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      const msg = /bucket/i.test(error.message)
        ? `Storage bucket "${BUCKET}" not found — create it (public) in Supabase first.`
        : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
