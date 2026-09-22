// تحديث التواصل: أرقام البطاقة المميزة + بيانات المحل + واتساب الطلب
import { readFileSync, writeFileSync } from 'node:fs';

function patch(file, pairs) {
  let s = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) s = s.split(a).join(b);
  writeFileSync(file, s);
  console.log(file, 'patched');
}

/* --- منصة العميل --- */
patch('src/customer/CustomerApp.tsx', [
  // واتساب الطلب
  ["?? '963952639157'", "?? '963936107119'"],
  // اسم المحل
  ['Dose Coffee &amp; More — أكثر من مجرد قهوة', 'Dose Cafe — أكثر من مجرد قهوة'],
  ['أكثر من مجرد قهوة.</b>', 'أكثر من مجرد قهوة.</b>'],
  ["مرحبًا، أحتاج مساعدة من Dose Coffee & More", "مرحبًا، أحتاج مساعدة من Dose Cafe"],
  ['<p className="mt-1 text-xs font-bold text-[#EAC98F]" dir="ltr">Dose Coffee &amp; More</p>', '<p className="mt-1 text-xs font-bold text-[#EAC98F]" dir="ltr">Dose Cafe</p>'],
  // هاتف المحل الافتراضي
  ["?? '0952639157'", "?? '0936107119'"],
  // انستغرام
  ["contactRow('instagram', 'إنستغرام', '@dose.coffee', 'https://instagram.com/dose.coffee')", "contactRow('instagram', 'إنستغرام', '@dose__cafe', 'https://www.instagram.com/dose__cafe')"],
  // فيسبوك
  ["contactRow('facebook', 'فيسبوك', 'Dose Coffee', 'https://facebook.com/dose.coffee')", "contactRow('facebook', 'فيسبوك', 'Dose Cafe', 'https://www.facebook.com/share/1DhShCC3Fm/')"],
  // حذف الموقع الإلكتروني
  ["        {contactRow('globe', 'الموقع الإلكتروني', 'www.dose.com', 'https://www.dose.com')}\n", ''],
  // تبديل أرقام البطاقة المميزة
  ["credit('براء دهبية', 'صاحب الفكرة والدعم', '0952639157')", "credit('براء دهبية', 'صاحب الفكرة والدعم', '0966333006')"],
  ["credit('قصي مهند الصالح', 'مطور المنصة وبرمجتها', '0966333006')", "credit('قصي مهند الصالح', 'مطور المنصة وبرمجتها', '0952639157')"],
  // توقيع البطاقة
  ['صُنعت هذه المنصة بحب ☕ Dose Coffee &amp; More', 'صُنعت هذه المنصة بحب — Dose Cafe'],
  // شريط الهيدر
  ['COFFEE &amp; MORE">COFFEE &amp; MORE', 'COFFEE &amp; MORE">CAFE'],
]);

/* --- كشك المحل --- */
patch('src/kiosk/KioskApp.tsx', [
  ["?? '0952639157'", "?? '0936107119'"],
  ['https://instagram.com/dose.coffee', 'https://www.instagram.com/dose__cafe'],
  ['@dose.coffee', '@dose__cafe'],
]);

/* --- رسالة واتساب --- */
patch('src/lib/whatsapp.ts', [
  ['☕ طلب جديد — Dose Coffee & More', '☕ طلب جديد — Dose Cafe'],
]);

/* --- مخطط قاعدة البيانات (seed) --- */
patch('supabase/schema.sql', [
  ["('Dose Coffee & More','0952639157','963952639157','Dose Coffee & More')", "('Dose Cafe','0936107119','963936107119','Dose Cafe')"],
  ["('whatsapp_number','963952639157')", "('whatsapp_number','963936107119')"],
  ["('store_phone','0952639157')", "('store_phone','0936107119')"],
]);
console.log('all patches done');
