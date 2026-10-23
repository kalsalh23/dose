import os
import pypdfium2 as pdfium

os.makedirs('scripts/menu2-pages', exist_ok=True)
pdf = pdfium.PdfDocument(r'C:\Users\DELL\Downloads\منيو حلويات دوز.pdf')
print('pages:', len(pdf))
for i, page in enumerate(pdf):
    bmp = page.render(scale=2.2)
    img = bmp.to_pil()
    path = f'scripts/menu2-pages/page-{i+1}.png'
    img.save(path)
    print(path, img.size)
