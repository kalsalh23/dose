// حذف شريط العروض من الرئيسية — الهيرو يحل محله (الإعلانات تبقى عبر Splash والإشعارات)
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/customer/CustomerApp.tsx';
let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const oldBlock = `
      {pathname !== '/account' && pathname !== '/about' && (
        <div className="px-4 pt-3">
          <OfferBanners ads={ads} cur={cur} onOpen={(a) => setAdOpen(a)} />
        </div>
      )}
`;
if (!s.includes(oldBlock)) { console.error('banner block not found'); process.exit(1); }
s = s.replace(oldBlock, '');

writeFileSync(f, s);
console.log('offers banner removed from home. renders left:', s.split('<OfferBanners').length - 1);
