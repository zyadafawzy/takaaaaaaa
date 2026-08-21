import { createFileRoute } from "@tanstack/react-router";
import { StaticPage } from "@/components/layout/StaticPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "شروط الاستخدام — تِكّة" },
      { name: "description", content: "شروط استخدام تطبيق تِكّة وطريقة تأكيد الطلبات." },
      { property: "og:title", content: "شروط الاستخدام — تِكّة" },
      { property: "og:description", content: "شروط الاستخدام وتأكيد الطلبات." },
    ],
  }),
  component: () => (
    <StaticPage title="شروط الاستخدام" intro="شروط مختصرة وواضحة لاستخدام التطبيق وتنفيذ الطلبات.">
      <p>
        تسجيل الطلب في التطبيق خطوة أولى فقط. لا يُعد الطلب مؤكدًا إلا بعد استلامنا رسالتك على واتساب
        وتأكيدنا لها.
      </p>
      <p>الأسعار المعروضة بالجنيه المصري وقابلة للتغيير قبل التأكيد.</p>
      <p>يحق للمتجر رفض أو إلغاء أي طلب مع بيان السبب، خاصة عند نفاد المخزون أو تعذر التوصيل للمنطقة.</p>
      <p>الدفع كاش عند الاستلام، ويحق لك رفض استلام منتج غير مطابق عند التسليم.</p>
    </StaticPage>
  ),
});
