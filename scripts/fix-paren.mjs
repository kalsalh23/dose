import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const old = `      </div>
    </section>
}

/* بطاقة كود الخصم المنشور */`;
if (!s.includes(old)) { console.error('anchor not found'); process.exit(1); }
s = s.replace(old, `      </div>
    </section>
  );
}

/* بطاقة كود الخصم المنشور */`);
writeFileSync(f, s);
console.log('fixed: added );');
