// إضافة حقول رفع الصور إلى لوحة الإدارة
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/admin/AdminApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// 1) استيراد عميل Supabase
s = s.replace("import { rpc } from '../lib/supabase';", "import { rpc, sb } from '../lib/supabase';");
if (!s.includes("rpc, sb")) { console.error('import anchor missing'); process.exit(1); }

// 2) مكوّن حقل رفع الصورة بعد useAdminAction
const anchor = `  return { busy, wrap };
};`;
if (!s.includes(anchor)) { console.error('useAdminAction anchor missing'); process.exit(1); }
const comp = `
/* حقل رفع صورة من الجهاز إلى Supabase Storage */
function ImageUploadField({ value, onChange, folder }: { value: string; onChange: (url: string) => void; folder: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const upload = async (file: File) => {
    setBusy(true); setErr('');
    try {
      if (!file.type.startsWith('image/')) throw new Error('اختر ملف صورة صحيحًا');
      if (file.size > 5 * 1024 * 1024) throw new Error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace('jpeg', 'jpg');
      const path = folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const { error } = await sb.storage.from('images').upload(path, file, { contentType: file.type });
      if (error) throw error;
      onChange(sb.storage.from('images').getPublicUrl(path).data.publicUrl);
    } catch (e: any) {
      setErr(e.message || 'فشل رفع الصورة');
    }
    setBusy(false);
  };
  return (
    <div>
      <div className="flex items-center gap-3">
        {value
          ? <img src={value} alt="" className="size-16 rounded-2xl object-cover shadow ring-1 ring-fresh-100" />
          : <span className="grid size-16 place-items-center rounded-2xl bg-[#F3EDE0] text-neutral-400"><Icon name="package" size={20} /></span>}
        <label className="cursor-pointer rounded-xl bg-coffee-900 px-4 py-2.5 text-[11px] font-extrabold text-cream transition active:scale-95">
          {busy ? 'جارٍ الرفع…' : value ? 'تغيير الصورة' : 'رفع صورة من الجهاز'}
          <input type="file" accept="image/*" className="hidden" disabled={busy}
            onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = ''; }} />
        </label>
        {value && <span className="text-[10px] font-extrabold text-green-600">جاهزة للعرض</span>}
      </div>
      {err && <p className="mt-1.5 text-[11px] font-bold text-red-600">{err}</p>}
    </div>
  );
}`;
s = s.replace(anchor, anchor + '\n' + comp);

// 3) حقل صورة المنتج (كان قائمة روابط)
const pStart = s.indexOf('<Field label="رابط الصورة">');
if (pStart < 0) { console.error('products field missing'); process.exit(1); }
const pEnd = s.indexOf('</Field>', pStart) + '</Field>'.length;
s = s.slice(0, pStart) + '<Field label="صورة المنتج"><ImageUploadField value={edit.image_url} onChange={(url) => setEdit({ ...edit, image_url: url })} folder="products" /></Field>' + s.slice(pEnd);

// 4) حقل صورة المكافأة (أول «الصورة»)
let i1 = s.indexOf('<Field label="الصورة">');
if (i1 < 0) { console.error('rewards field missing'); process.exit(1); }
let e1 = s.indexOf('</Field>', i1) + '</Field>'.length;
s = s.slice(0, i1) + '<Field label="صورة المكافأة"><ImageUploadField value={edit.image_url} onChange={(url) => setEdit({ ...edit, image_url: url })} folder="rewards" /></Field>' + s.slice(e1);

// 5) حقل صورة الإعلان (ثاني «الصورة»)
let i2 = s.indexOf('<Field label="الصورة">');
if (i2 < 0) { console.error('ads field missing'); process.exit(1); }
let e2 = s.indexOf('</Field>', i2) + '</Field>'.length;
s = s.slice(0, i2) + '<Field label="صورة الإعلان"><ImageUploadField value={edit.image_url} onChange={(url) => setEdit({ ...edit, image_url: url })} folder="ads" /></Field>' + s.slice(e2);

writeFileSync(f, s);
console.log('patched | selects left:', (s.match(/<select/g) || []).length, '| upload fields:', s.split('ImageUploadField value').length - 1);
