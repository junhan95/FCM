import { requireAdmin } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { getPrices, getPriceImportChanges, latestPriceImport, listPriceImports } from "@/lib/data";
import PriceTable from "./PriceTable";
import PriceImport from "@/components/PriceImport";

export const dynamic = "force-dynamic";

export default async function PricesPage() {
  await requireAdmin();
  const lang = await getLang();
  const [prices, last, history] = await Promise.all([getPrices(), latestPriceImport(), listPriceImports(10)]);
  const changes = last ? await getPriceImportChanges(last.id) : [];
  const categories = [...new Set(prices.map((p) => p.category).filter((c): c is string => !!c))];
  return (
    <main className="shell">
      <PriceImport lang={lang} last={last} changes={changes} history={history} itemCount={prices.filter((p) => p.ref !== null).length} />
      <PriceTable
        lang={lang}
        categories={categories}
        rows={prices
          .filter((p) => !p.isHeader || p.item)
          .map((p) => ({
            id: p.id,
            row: p.row,
            ref: p.ref,
            sage: p.sage == null ? "" : String(p.sage),
            item: p.item == null ? "" : String(p.item),
            description: p.description == null ? "" : String(p.description),
            unit: p.unit == null ? "" : String(p.unit),
            price: typeof p.price === "number" ? p.price : null,
            priceText: p.price == null ? "" : String(p.price),
            delivery: p.delivery == null ? "" : String(p.delivery),
            priceDate: p.priceDate == null ? "" : String(p.priceDate),
            category: p.category ?? "",
            isHeader: !!p.isHeader,
          }))}
      />
    </main>
  );
}
