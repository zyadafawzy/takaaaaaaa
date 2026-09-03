# تِكّة — منصة سوبرماركت متعددة المتاجر

تِكّة هي منصة PWA إنتاجية لإدارة سوبرماركتس مصرية وتشغيلها. العميل يتصفح المنتجات ويضيفها للسلة ويؤكد الطلب عبر واتساب من غير ما يسجّل دخول. صاحب المتجر وفريقه يدخلون من `/admin` عشان يديروا الكتالوج، الطلبات، المخزون، العروض، مناطق التوصيل، والتقارير.

## الحالة الحالية

المنصة شغالة على TanStack Start + React 19 + Supabase. الواجهة كلها RTL بالعربي المصرية مع دعم Dark/Light mode. فيها داتا demo موسومة بوضوح، والربط بالسحابة مفتوح لكن مكتمل لحد الـ repository functions.

## التقنية

- **Framework:** [TanStack Start](https://tanstack.com/start) مع SSR/SSG
- **UI:** React 19 + TypeScript + Tailwind CSS v4
- **Build:** Vite 7
- **Backend / Auth:** Supabase (PostgREST + Row Level Security)
- **State:** TanStack Query
- **Routing:** TanStack Router (file-based)
- **Storage:** Supabase Storage للصور والشعارات
- **PWA:** `manifest.webmanifest` + Service Worker
- **Target runtime:** Edge / Cloudflare Workers

## هيكل المشروع

```
src/
  routes/           كل صفحات المنصة (file-based routing)
  components/       مكوّنات قابلة لإعادة الاستخدام
  domain/           أنواع البيانات والـ types
  services/         repositories و adapters
  lib/              منطق التسعير، التنسيق، العربي، الواتساب، الجلسة
  data/             بيانات demo قليلة وواقعية
  integrations/     Supabase clients
  styles.css        tokens الألوان والـ theme
public/             assets، icons، manifest، SW
scripts/            أدوات استيراد ونشر بيانات
```

## أهم المسارات

### واجهة العميل
- `/` — الصفحة الرئيسية
- `/categories` — الأقسام
- `/category/:slug` — منتجات قسم
- `/search` — البحث
- `/product/:slug` — صفحة منتج
- `/cart` — السلة
- `/checkout` — إنهاء الطلب
- `/order/pending/:token` — تأكيد الطلب على واتساب
- `/track/:token` — متابعة الطلب
- `/s/:storeSlug/*` — واجهة كل سوبرماركت منفصلة

### لوحة الإدارة
- `/admin/login` — دخول فريق المتجر
- `/admin` — لوحة العمليات
- `/admin/orders` — مركز الطلبات
- `/admin/catalog` — الكتالوج والمنتجات
- `/admin/catalog-import` — استيراد CSV/Excel
- `/admin/inventory` — المخزون
- `/admin/bundles` — عروض الجملة
- `/admin/promotions` — العروض والخصومات
- `/admin/delivery` — مناطق التوصيل
- `/admin/reports` — التقارير
- `/admin/settings` — إعدادات المتجر
- `/s/:storeSlug/admin/*` — لوحة إدارة خاصة بكل متجر

### أدوات المطوّر
- `/developer` — قائمة المتاجر
- `/developer/new` — إنشاء متجر جديد
- `/developer/stores/:id` — إدارة تفاصيل المتجر

### API عام
- `/api/public/product-image/:id` — صورة منتج عامة
- `/api/public/store-logo/:id` — شعار متجر عام

## قواعد أساسية

- لا حسابات للعملاء. الدخول للفريق الداخلي فقط.
- WhatsApp بدون API: نفتح رابط `wa.me` فقط وما ندّعيش الإرسال.
- السلة محلية عبر anonymous session id.
- الأسعار بصيغة `125.00 ج.م`، أرقام لاتينية، الاتجاه ما ينقلبش.
- كل الألوان `oklch` design tokens في `src/styles.css`.

## تشغيل محلي

```bash
bun install
bun run dev
```

الموقع بيفتح على `http://localhost:8080`.

## التطوير

- مسارات TanStack Router تتولد تلقائيًا في `src/routeTree.gen.ts` — ممنوع تعديله يدويًا.
- functions اللي بتتصل بالـ Supabase بتكون `*.functions.ts` في `src/lib/`، مش في `src/server/`.
- اي تعديل في قاعدة البيانات يتم عبر migrations في Supabase.
- الصور والأصول بتتحفظ في `public/` أو تترفع على Supabase Storage.

## وضع الأوفلاين في نقاط البيع (POS Offline)

الوضع الأوفلاين شغال على شاشات الإدارة/الكاشير فقط (`/pos/*` و`/s/:slug/admin/pos/*`)، وواجهة العميل مش متأثرة بيه خالص.

### اللقطة المحلية (Snapshot)
- بتتحفظ في IndexedDB (`tikka-offline` / store `kv`) تحت مفتاح `snapshot:<storeId>`.
- `posOfflineSnapshot` بيرجع الأصناف **مفلترة بـ `store_id`** + الباركودات والمخزون والعملاء وطرق الدفع للمتجر/الفرع.
- تحديث تفاضلي: الطلب بيبعت `since` (وقت آخر لقطة) والسيرفر يرجع المتغيّر بس (`partial: true`)، والعميل بيدمج الأصناف الجديدة/المحدّثة.
- لو اللقطة أقدم من `SNAPSHOT_STALE_HOURS = 12` ساعة، شريط الحالة يعرض تحذير «حدّث النسخة المحلية».

### الورديات أوفلاين
- لو مفيش نت: «افتح وردية أوفلاين» بيعمل وردية محلية (`local-shift:<storeId>`) بـ `clientShiftId`.
- `posCheckout` بيقبل `shiftId = null` مع `offlineShift`، وبينشئ/بيلاقي وردية على السيرفر بنفس `client_shift_id` (index فريد على `store_id, client_shift_id`).
- لو الوردية الأصلية كانت اتقفلت قبل الرفع، السيرفر يفتح وردية `-late` للفواتير المتأخرة فبدل ما تفشل بترتفع.
- قفل الوردية المحلية بيتسجل محليًا، وبيتنفذ على السيرفر (`posCloseOfflineShift`) بعد رفع كل فواتيرها.

### منع التكرار (Idempotency)
- كل فاتورة بتتولد بـ `clientInvoiceId` فريد قبل أي محاولة رفع.
- في قاعدة البيانات: `pos_invoices.client_invoice_id` + unique index جزئي على `(store_id, client_invoice_id)`.
- لو الرد ضاع والعميل أعاد الإرسال، السيرفر يرجّع نفس الفاتورة بـ `duplicate: true` بدون تكرار محاسبي.

### طابور الرفع والفواتير المعلّقة
- طابورين في IndexedDB: `outbox` (فواتير) و`outbox-ops` (تعديل مخزون، مشتريات، هوالك، عميل جديد، دفعة عميل) — العمليات دي بقت بتشتغل من غير نت وترتفع بعدين.
- كل عنصر فيه `attempts` و`lastError`؛ بعد `MAX_SYNC_ATTEMPTS = 5` يتحوّل `blocked` ويقف عن المحاولة التلقائية.
- شاشة **«المعلّقة»** (`/pos/pending`) بتعرض الفواتير والعمليات المتأخرة مع إعادة محاولة يدوية أو حذف، وكذلك خريطة «الرقم المحلي ← الرقم الرسمي».

### أرقام الفواتير والطباعة
- الفاتورة الأوفلاين بتطبع برقم محلي `OFF-...`، وبعد الرفع بيتسجل الرقم الرسمي ويتحدّث تلقائيًا في شاشة الكاشير مع إشعار للكاشير.

### الأسعار
- `posCheckout` بيقارن سعر الصنف على السيرفر بالسعر اللي البيع اتعمل بيه، وبيرجع `priceConflicts`؛ الكاشير بياخد تحذير لو السعر المحلي كان قديم.

### حدود معروفة
- الدمج التفاضلي بيحدّث/يضيف أصناف، لكن مش بيحذف الأصناف اللي اتوقفت — التحديث الكامل (بدون `since`) بينضّف.
- اللقطة لسه غير مضغوطة (JSON في IndexedDB).
- التقارير والتحليلات أونلاين فقط.

## الخطط القادمة

- اكتمال الـ RLS والصلاحيات السحابية للأدوار.
- ربط الطلبات الحقيقية بدل demo adapter.
- OTP لتتبع الطلب.
- مدفوعات محلية (Vodafone Cash، InstaPay).
- إشعارات WhatsApp Business API (اختياري).

---

Built with [Lovable](https://lovable.dev).
