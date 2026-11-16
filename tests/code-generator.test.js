import fs from 'fs';
import path from 'path';
import Order from '../src/modules/order/models/Order';
import { formatCompactVnDate, generateUniqueDocumentCode } from '../src/utils/codeGenerator';
import { makeOrderCode, generateUniqueOrderCode } from '../src/modules/order/order.service';

describe('Document Code Standardization (ORD / APT / RET / REF -YYYYMMDD-XXXX)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('formats dates using Asia/Ho_Chi_Minh (+07:00) boundary rather than UTC', () => {
    // 2026-11-16T18:30:00.000Z is 2026-11-17 01:30:00 in VN (+07:00)
    const lateUtc = new Date('2026-11-16T18:30:00.000Z');
    expect(formatCompactVnDate(lateUtc)).toBe('20261117');
    expect(makeOrderCode(lateUtc)).toMatch(/^ORD-20261117-\d{4}$/);
  });

  it('generates canonical sequential PREFIX-YYYYMMDD-XXXX codes without status or UAT tags', async () => {
    const fixedDate = new Date('2026-11-16T03:00:00.000Z');
    const findChain = (doc) => ({
      session: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(doc),
    });

    jest
      .spyOn(Order, 'findOne')
      .mockReturnValueOnce(findChain({ code: 'ORD-20261116-0009' }))
      .mockReturnValueOnce(findChain(null));

    const nextOrd = await generateUniqueOrderCode(null);
    expect(nextOrd).toMatch(/^ORD-\d{8}-0010$/);

    const mockModel = {
      findOne: jest
        .fn()
        .mockReturnValueOnce(findChain(null))
        .mockReturnValueOnce(findChain(null)),
    };
    const nextRet = await generateUniqueDocumentCode(mockModel, 'RET', { date: fixedDate });
    expect(nextRet).toBe('RET-20261116-0001');

    // Fallback when disconnected must still preserve 3-part PREFIX-YYYYMMDD-XXXX shape
    const fallbackRef = await generateUniqueDocumentCode(null, 'REF', { date: fixedDate });
    expect(fallbackRef).toMatch(/^REF-20261116-\d{4}$/);
  });

  it('ensures uatSeed.js and dashboardUatSeed.js contain zero legacy ORD-UAT / APT-UAT / RET-UAT / RF-UAT codes', () => {
    const uatSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/seeds/uatSeed.js'), 'utf8');
    const dashSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/seeds/dashboardUatSeed.js'), 'utf8');

    expect(uatSrc).not.toMatch(/ORD-UAT-/);
    expect(uatSrc).not.toMatch(/RET-UAT-/);
    expect(uatSrc).not.toMatch(/REF-UAT-/);

    // dashboardUatSeed only references legacy *-UAT-* inside deleteMany cleanup patterns
    const dashWithoutCleanup = dashSrc.replace(/await \w+\.deleteMany\(\{ code: \/[^/]+\/i \}\);/g, '');
    expect(dashWithoutCleanup).not.toMatch(/ORD-UAT-/);
    expect(dashWithoutCleanup).not.toMatch(/APT-UAT-/);
    expect(dashWithoutCleanup).not.toMatch(/RET-UAT-/);
    expect(dashWithoutCleanup).not.toMatch(/RF-UAT-/);
  });
});

