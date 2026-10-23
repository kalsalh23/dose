import os
import pypdfium2 as pdfium

os.makedirs('scripts/pdf-pages', exist_ok=True)
pdf = pdfium.PdfDocument(r'C:\Users\DELL\Downloads\he.pdf')
print('pages:', len(pdf))
for i, page in enumerate(pdf):
    bmp = page.render(scale=2.2)
    img = bmp.to_pil()
    path = f'scripts/pdf-pages/page-{i+1}.png'
    img.save(path)
    print(path, img.size)
