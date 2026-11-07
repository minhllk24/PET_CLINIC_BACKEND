import { formatProduct } from '../src/modules/catalog/catalog.service';
import placeholders from '../src/modules/catalog/legacyPlaceholderImages';
import legacyProducts from '../src/seeds/data/legacyProducts.json';
import curated from '../src/modules/catalog/curatedLegacyImages';

describe('legacy product images', () => {
  const code = 'SP-LEG-088';
  const original = legacyProducts.find((product) => product.code === code);
  const format = (productCode, images) => formatProduct({
    _id: 'product-id', productCode, name: 'Product', categoryId: 'category-id', images, variants: [],
  });

  it('filters only the known seeded photos for that product and retains newly added photos', () => {
    const added = { url: 'https://images.unsplash.com/a-user-added-image', isPrimary: false };
    const old = { url: placeholders[code][0], isPrimary: false };
    const result = format(code, [...original.images, old, added]);
    expect(result.images).toEqual([...original.images, added]);
    expect(result.thumbnailUrl).toBe(original.images[0].url);
    expect(result.image).toBe(result.thumbnailUrl);
    expect(result.imageUrl).toBe(result.thumbnailUrl);
    expect(result.product_images[0]).toEqual({ image_url: original.images[0].url, is_primary: true });
    expect(format('OTHER', [old]).images).toEqual([old]);
  });

  it('keeps a consistent primary URL if the removed photo was primary', () => {
    const result = format(code, [
      { url: placeholders[code][0], isPrimary: true },
      { url: 'https://example.com/product.jpg', isPrimary: false },
    ]);
    expect(result.thumbnailUrl).toBe('https://example.com/product.jpg');
    expect(result.images).toHaveLength(1);
  });

  it('does not reintroduce the known placeholders through the seed', () => {
    for (const product of legacyProducts) {
      const known = placeholders[product.code] || [];
      expect(product.images.length).toBeGreaterThan(0);
      expect(product.images.some((image) => known.includes(image.url))).toBe(false);
    }
  });

  it('upgrades an untouched legacy gallery but preserves staff edits', () => {
    const entry = curated[code];
    const oldImages = entry.oldUrls.map((url) => ({ url }));
    expect(format(code, oldImages).images).toEqual(entry.images);
    expect(new Set(entry.images.map((image) => image.url)).size).toBe(3);
    const edited = [...oldImages, { url: 'https://example.com/staff.jpg' }];
    expect(format(code, edited).images).toEqual(edited);
  });

  it('ensures at least 20 curated products have 3 distinct product images and variant images', () => {
    const curatedCodes = Object.keys(curated);
    expect(curatedCodes.length).toBeGreaterThanOrEqual(20);

    for (const productCode of curatedCodes) {
      const entry = curated[productCode];
      expect(entry.images).toHaveLength(3);
      expect(new Set(entry.images.map((img) => img.url)).size).toBe(3);

      const seededProduct = legacyProducts.find((p) => p.code === productCode);
      expect(seededProduct).toBeDefined();
      expect(seededProduct.images).toHaveLength(3);
      expect(new Set(seededProduct.images.map((img) => img.url)).size).toBe(3);
      expect(seededProduct.variants.length).toBeGreaterThanOrEqual(2);
      for (const variant of seededProduct.variants) {
        expect(typeof variant.image).toBe('string');
        expect(variant.image.startsWith('http')).toBe(true);
      }
      expect(new Set(seededProduct.variants.map((v) => v.image)).size).toBe(seededProduct.variants.length);
    }
  });
});
