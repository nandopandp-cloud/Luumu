import { requireProductReportAccess } from "@/lib/product-report/access";

/*
  Barreira do segmento inteiro. Não basta sozinha (o layout não roda de novo em navegação
  entre páginas filhas), por isso cada page, action e rota de API do módulo repete o guard.
*/
export default async function ProductReportLayout({ children }: { children: React.ReactNode }) {
  await requireProductReportAccess();
  return children;
}
