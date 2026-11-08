import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import Pet from '../src/modules/customer/models/Pet';
import Customer from '../src/modules/customer/models/Customer';
import Product from '../src/modules/catalog/models/Product';
import Service from '../src/modules/catalog/models/Service';
import Category from '../src/modules/catalog/models/Category';
import * as searchService from '../src/modules/search/search.service';
import * as bookingService from '../src/modules/booking/booking.service';

describe('WEB 2 Business Report & Specification Alignments Suite', () => {
  describe('1. M04 Pet Profile Archiving & Data Integrity', () => {
    it('should allow archiving a pet and filter it out of default active list', async () => {
      const mockCustomerId = new mongoose.Types.ObjectId();
      const activePet = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Milo Active',
        species: 'DOG',
        customerId: mockCustomerId,
        isArchived: false,
      };
      const archivedPet = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Lucky Passed Away',
        species: 'CAT',
        customerId: mockCustomerId,
        isArchived: true,
      };

      jest.spyOn(Customer, 'findOne').mockReturnValue({
        lean: () => Promise.resolve({ _id: mockCustomerId, userId: mockCustomerId }),
      });

      jest.spyOn(Pet, 'find').mockImplementation((filter) => {
        let items = [activePet, archivedPet];
        if (filter.isArchived && filter.isArchived.$ne === true) {
          items = items.filter((p) => !p.isArchived);
        } else if (filter.isArchived === true) {
          items = items.filter((p) => p.isArchived);
        }
        return {
          sort: () => Promise.resolve(items),
        };
      });

      // Default query filters out archived pets
      const resActive = await request(app)
        .get(`/api/v1/customers/${mockCustomerId}/pets`)
        .set('x-mock-bypass', 'true');
      expect(resActive.status).toBe(200);
      expect(resActive.body.length).toBe(1);
      expect(resActive.body[0].name).toBe('Milo Active');

      // includeArchived=true returns both
      const resAll = await request(app)
        .get(`/api/v1/customers/${mockCustomerId}/pets?includeArchived=true`)
        .set('x-mock-bypass', 'true');
      expect(resAll.status).toBe(200);
      expect(resAll.body.length).toBe(2);

      // isArchived=true returns only archived
      const resArchivedOnly = await request(app)
        .get(`/api/v1/customers/${mockCustomerId}/pets?isArchived=true`)
        .set('x-mock-bypass', 'true');
      expect(resArchivedOnly.status).toBe(200);
      expect(resArchivedOnly.body.length).toBe(1);
      expect(resArchivedOnly.body[0].name).toBe('Lucky Passed Away');

      Pet.find.mockRestore();
      Customer.findOne.mockRestore();
    });

    it('should soft-delete a pet by setting isArchived=true instead of hard deleting', async () => {
      const petId = new mongoose.Types.ObjectId();
      const updatedPet = {
        _id: petId,
        name: 'Milo',
        isArchived: true,
      };

      jest.spyOn(Pet, 'findByIdAndUpdate').mockResolvedValue(updatedPet);

      const res = await request(app).delete(`/api/v1/pets/${petId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('archived');
      expect(res.body.pet.isArchived).toBe(true);

      Pet.findByIdAndUpdate.mockRestore();
    });
  });

  describe('2. M19 Search Suggestions Rich Card & Multi-Category Query', () => {
    it('should include image and price in product suggestions when available', async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Hạt Cho Chó Royal Canin',
        productCode: 'RC-MAXI',
        categoryId: { name: 'Thức ăn cho chó' },
        variants: [{ sku: 'RC-1KG', price: 250000, image: 'https://cdn.petclinic.com/rc-maxi.png' }],
        images: ['https://cdn.petclinic.com/rc-maxi-main.png'],
        status: 'ACTIVE',
      };

      jest.spyOn(Product, 'find').mockReturnValue({
        select: () => ({
          populate: () => ({
            limit: () => ({
              lean: () => ({
                exec: () => Promise.resolve([mockProduct]),
              }),
            }),
          }),
        }),
      });

      jest.spyOn(Service, 'find').mockReturnValue({
        select: () => ({
          limit: () => ({
            lean: () => ({
              exec: () => Promise.resolve([]),
            }),
          }),
        }),
      });

      jest.spyOn(Category, 'find').mockReturnValue({
        select: () => ({
          limit: () => ({
            lean: () => ({
              exec: () => Promise.resolve([]),
            }),
          }),
        }),
      });

      const suggestions = await searchService.getSearchSuggestions({ q: 'Royal Canin', limit: 5 });
      expect(suggestions.suggestions.length).toBeGreaterThan(0);
      const productSuggestion = suggestions.suggestions.find((s) => s.type === 'product');
      expect(productSuggestion).toBeDefined();
      expect(productSuggestion.price).toBe(250000);
      expect(productSuggestion.image).toBe('https://cdn.petclinic.com/rc-maxi-main.png');

      Product.find.mockRestore();
      Service.find.mockRestore();
      Category.find.mockRestore();
    });
  });

  describe('3. M15 Appointment Cancellation & Reschedule Policy Metadata', () => {
    it('should compute cancellationDeadline, hoursUntilStart, and depositRefundable', () => {
      const futureDate = new Date(Date.now() + 48 * 3600000); // 48h in future
      const apt = {
        _id: new mongoose.Types.ObjectId(),
        code: 'APT-TEST-001',
        scheduledStart: futureDate,
        status: 'CONFIRMED',
        rescheduleCount: 0,
        services: [{ executionStatus: 'NOT_STARTED' }],
      };

      const formatted = bookingService.formatAppointment(apt);
      expect(formatted.cancellationPolicy).toBeDefined();
      expect(formatted.cancellationPolicy.depositRefundable).toBe(true);
      expect(formatted.cancellationPolicy.canSelfReschedule).toBe(true);
      expect(formatted.cancellationPolicy.canSelfCancel).toBe(true);
      expect(formatted.cancellationPolicy.hoursUntilStart).toBeGreaterThanOrEqual(47);
      expect(formatted.cancellationPolicy.cancellationDeadline).toBeDefined();
    });

    it('should mark deposit non-refundable and disable self-reschedule when < 24h', () => {
      const soonDate = new Date(Date.now() + 10 * 3600000); // 10h in future (< 24h)
      const apt = {
        _id: new mongoose.Types.ObjectId(),
        code: 'APT-TEST-002',
        scheduledStart: soonDate,
        status: 'CONFIRMED',
        rescheduleCount: 0,
        services: [{ executionStatus: 'NOT_STARTED' }],
      };

      const formatted = bookingService.formatAppointment(apt);
      expect(formatted.cancellationPolicy).toBeDefined();
      expect(formatted.cancellationPolicy.depositRefundable).toBe(false);
      expect(formatted.cancellationPolicy.canSelfReschedule).toBe(false);
      expect(formatted.cancellationPolicy.canSelfCancel).toBe(true);
    });
  });
});

