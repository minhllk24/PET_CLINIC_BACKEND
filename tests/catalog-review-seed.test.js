import { formatServiceResponse, CURATED_SERVICE_IMAGES } from '../src/modules/catalog/serviceCatalog.service';
import { syncAllCatalogRatings } from '../src/seeds/catalogReviewSeed';

describe('Catalog Review Seed & Service Rating Exposure', () => {
  test('formatServiceResponse resolves curated medical service images across standard aliases', () => {
    const formatted = formatServiceResponse({
      _id: '6ad08e4517bf41f5954234d1',
      code: 'MED05',
      name: 'Thay băng / Chăm sóc sau điều trị',
      serviceType: 'MEDICAL',
      basePrice: 120000,
      durationMinutes: 30,
      requiredStaffRole: 'NURSE',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
    });

    expect(formatted.imageUrl).toBe(CURATED_SERVICE_IMAGES.MED05);
    expect(formatted.image_url).toBe(CURATED_SERVICE_IMAGES.MED05);
    expect(formatted.image).toBe(CURATED_SERVICE_IMAGES.MED05);
    expect(formatted.thumbnail).toBe(CURATED_SERVICE_IMAGES.MED05);
    expect(formatted.images).toEqual([CURATED_SERVICE_IMAGES.MED05]);

    const groomingFormatted = formatServiceResponse({
      _id: '6ad08e4417bf41f5954234c6',
      code: 'GRM01',
      name: 'Tắm & Sấy khô',
      serviceType: 'GROOMING',
      basePrice: 70000,
      durationMinutes: 60,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
    });
    expect(groomingFormatted.image_url).toBe(CURATED_SERVICE_IMAGES.GRM01);

    const comboFormatted = formatServiceResponse({
      _id: '6aefe9ddb25c942961da0872',
      code: 'CMB01',
      name: 'Combo Tắm 11 bước',
      serviceType: 'GROOMING',
      basePrice: 180000,
      durationMinutes: 120,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
    });
    expect(comboFormatted.image_url).toBe(CURATED_SERVICE_IMAGES.CMB01);
  });

  test('formatServiceResponse exposes zeroed rating fields when ratingCount is 0', () => {
    const formatted = formatServiceResponse({
      _id: '6ad08e4517bf41f5954234c7',
      name: 'Massage chuyên sâu',
      serviceType: 'GROOMING',
      basePrice: 150000,
      durationMinutes: 45,
      requiredStaffRole: 'CARE_STAFF',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
      ratingAvg: 4.5, // Should not display rating if ratingCount is 0
      ratingCount: 0,
    });

    expect(formatted.rating).toBe(0);
    expect(formatted.averageRating).toBe(0);
    expect(formatted.ratingAvg).toBe(0);
    expect(formatted.reviewCount).toBe(0);
    expect(formatted.ratingCount).toBe(0);
    expect(formatted.ratingDisplay).toBe(0);
    expect(formatted.hasReviews).toBe(false);
  });

  test('formatServiceResponse exposes computed rating fields when ratingCount > 0', () => {
    const formatted = formatServiceResponse({
      _id: '6ad08e4417bf41f5954234c6',
      name: 'Tắm & Sấy khô',
      serviceType: 'GROOMING',
      basePrice: 200000,
      durationMinutes: 60,
      requiredStaffRole: 'CARE_STAFF',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
      ratingAvg: 4.7,
      ratingCount: 5,
    });

    expect(formatted.rating).toBe(4.7);
    expect(formatted.averageRating).toBe(4.7);
    expect(formatted.ratingAvg).toBe(4.7);
    expect(formatted.reviewCount).toBe(5);
    expect(formatted.ratingCount).toBe(5);
    expect(formatted.ratingDisplay).toBe(4.7);
    expect(formatted.hasReviews).toBe(true);
  });

  test('syncAllCatalogRatings safely no-ops when mongoose is disconnected', async () => {
    const res = await syncAllCatalogRatings();
    expect(res).toEqual({ updatedProducts: 0, updatedServices: 0 });
  });
});
