import Link from "next/link";
import { notFound } from "next/navigation";
import Configurator from "@/components/Configurator";
import { getActivePricing, getLine, getProduct } from "@/lib/db";

export default async function ConfigurePage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const product = getProduct(productId);
  if (!product) notFound();
  const line = getLine(product.lineId)!;
  const pricing = getActivePricing(product.lineId);

  return (
    <div>
      <nav className="rise mb-5 text-[13px] text-muted">
        <Link href="/catalog" className="hover:text-brass">
          Catalog
        </Link>
        <span className="mx-2 text-line">/</span>
        <Link href={`/catalog?line=${line.id}`} className="hover:text-brass">
          {line.name}
        </Link>
        <span className="mx-2 text-line">/</span>
        <span className="font-medium text-ink">{product.name}</span>
      </nav>
      <Configurator
        product={product}
        line={line}
        pricingVersion={pricing.version}
        leadTimeDays={line.leadTimeDays}
      />
    </div>
  );
}
