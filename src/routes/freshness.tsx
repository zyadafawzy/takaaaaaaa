import { createFileRoute } from "@tanstack/react-router";
import { StaticPage } from "@/components/layout/StaticPage";

export const Route = createFileRoute("/freshness")({
  head: () => ({
    meta: [
      { title: "سياسة الفريش والبديل — تِكّة" },
      { name: "description", content: "كيف نتعامل مع المنتجات الطازجة والمنتج غير المتوفر وقت التجهيز." },
      { property: "og:title", content: "سياسة الفريش والبديل — تِكّة" },
      { property: "og:description", content: "خيارات البديل عند نقص أي منتج." },
    ],
  }),
  component: () => (
    <StaticPage
      title="سياسة الفريش والبديل"
      intro="نوضح وحدة البيع قبل الشراء، ونمشي على اختيارك عند نقص أي منتج."
    >
      <p>
        الخضار والفاكهة تُباع بالكيلو أو بالقطعة أو بالعبوة كما هو مكتوب في صفحة المنتج. الوزن الفعلي قد
        يختلف اختلافًا بسيطًا عند التجهيز.
      </p>
      <p>عند إنهاء الطلب تختار سياسة واحدة تنطبق على الطلب كله:</p>
      <ul className="list-disc space-y-1 ps-5">
        <li>اختار بديل مناسب: نختار أقرب منتج في النوع والسعر.</li>
        <li>اتصل بيا: لا نبدل أي شيء قبل ما نكلمك.</li>
        <li>شيل المنتج لو مش موجود: نحذف المنتج ونعدّل الإجمالي.</li>
      </ul>
      <p>لا نذكر مصدر المنتج أو مدة صلاحيته إلا عندما تكون البيانات متاحة فعلًا في الكتالوج.</p>
    </StaticPage>
  ),
});
