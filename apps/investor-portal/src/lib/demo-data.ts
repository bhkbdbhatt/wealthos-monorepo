export function investorDemoData(path: string): unknown | null {
  if (path === '/portfolios') {
    const holdings = [
      { holdingId: 'holding-1', asset: { id: 'asset-1', slug: 'nifty-50-index-fund', name: 'Nifty 50 Index Fund', type: 'MUTUAL_FUND', schemeCode: 'NIF50', issuer: 'WealthOS AMC', category: 'Large Cap Index', navPaise: 268420, navUpdatedAt: '2026-11-02T18:00:00Z' }, units: '212.84', investedPaise: 480000000, currentPaise: 571240000, gainPaise: 91240000, gainPct: 19.01, firstPurchaseAt: '2023-06-18T00:00:00Z' },
      { holdingId: 'holding-2', asset: { id: 'asset-2', slug: 'quality-equity-fund', name: 'Quality Equity Fund', type: 'MUTUAL_FUND', schemeCode: 'QUAL', issuer: 'WealthOS AMC', category: 'Flexi Cap', navPaise: 94210, navUpdatedAt: '2026-11-02T18:00:00Z' }, units: '308.26', investedPaise: 360000000, currentPaise: 404820000, gainPaise: 44820000, gainPct: 12.45, firstPurchaseAt: '2024-01-12T00:00:00Z' },
      { holdingId: 'holding-3', asset: { id: 'asset-3', slug: 'india-short-bond-fund', name: 'India Short Bond Fund', type: 'BOND', schemeCode: 'ISBOND', issuer: 'WealthOS AMC', category: 'Short Duration', navPaise: 112840, navUpdatedAt: '2026-11-02T18:00:00Z' }, units: '184.12', investedPaise: 210000000, currentPaise: 220680000, gainPaise: 10680000, gainPct: 5.09, firstPurchaseAt: '2024-08-04T00:00:00Z' },
    ];
    return { userId: 'demo-investor', holdings, investedPaise: 1050000000, currentPaise: 1196740000, gainPaise: 146740000, gainPct: 13.98, xirrPct: 14.82, allocationByType: [{ type: 'MUTUAL_FUND', currentPaise: 976060000, weightPct: 81.56 }, { type: 'BOND', currentPaise: 220680000, weightPct: 18.44 }] };
  }
  if (path === '/transactions') return [
    { id: 'txn-1', userId: 'demo-investor', asset: { id: 'asset-1', slug: 'nifty-50-index-fund', name: 'Nifty 50 Index Fund', type: 'MUTUAL_FUND' }, type: 'BUY', amountPaise: 2500000, units: '9.31', navPaise: 268420, status: 'COMPLETED', idempotencyKey: null, executedAt: '2026-11-01T10:30:00Z', createdAt: '2026-11-01T10:29:00Z' },
    { id: 'txn-2', userId: 'demo-investor', asset: { id: 'asset-3', slug: 'india-short-bond-fund', name: 'India Short Bond Fund', type: 'BOND' }, type: 'SIP', amountPaise: 1000000, units: '8.86', navPaise: 112840, status: 'COMPLETED', idempotencyKey: null, executedAt: '2026-10-30T09:00:00Z', createdAt: '2026-10-30T08:58:00Z' },
  ];
  if (path === '/goals') return [
    { id: 'goal-1', name: 'Retirement corpus', targetAmountPaise: 5000000000, horizonMonths: 240, expectedAnnualReturnBps: 1200, currentValuePaise: 1196740000, recommendedMonthlyPaise: 6920000, progressPct: 23.93, achieved: false },
    { id: 'goal-2', name: 'Europe holiday', targetAmountPaise: 1000000000, horizonMonths: 18, expectedAnnualReturnBps: 850, currentValuePaise: 326000000, recommendedMonthlyPaise: 3570000, progressPct: 32.6, achieved: false },
  ];
  if (path === '/sips') return [
    { id: 'sip-1', asset: { id: 'asset-1', slug: 'nifty-50-index-fund', name: 'Nifty 50 Index Fund', type: 'MUTUAL_FUND' }, monthlyAmountPaise: 2500000, intervalsPerMonth: 1, scheduledDays: [5], status: 'ACTIVE', startOn: '2026-01-05', endOn: null, nextRunOn: '2026-12-05' },
    { id: 'sip-2', asset: { id: 'asset-2', slug: 'quality-equity-fund', name: 'Quality Equity Fund', type: 'MUTUAL_FUND' }, monthlyAmountPaise: 1500000, intervalsPerMonth: 1, scheduledDays: [12], status: 'ACTIVE', startOn: '2026-03-12', endOn: null, nextRunOn: '2026-12-12' },
  ];
  if (path === '/baskets') return [
    { id: 'basket-1', name: 'Core Wealth', slug: 'core-wealth', description: 'A diversified foundation for long-term compounding.', category: 'Core', riskLevel: 'MODERATE', items: [{ asset: { id: 'asset-1', slug: 'nifty-50-index-fund', name: 'Nifty 50 Index Fund', type: 'MUTUAL_FUND' }, targetWeightPct: 50 }, { asset: { id: 'asset-2', slug: 'quality-equity-fund', name: 'Quality Equity Fund', type: 'MUTUAL_FUND' }, targetWeightPct: 30 }, { asset: { id: 'asset-3', slug: 'india-short-bond-fund', name: 'India Short Bond Fund', type: 'BOND' }, targetWeightPct: 20 }] },
    { id: 'basket-2', name: 'India Growth', slug: 'india-growth', description: 'High-growth businesses positioned for India’s next decade.', category: 'Growth', riskLevel: 'HIGH', items: [{ asset: { id: 'asset-4', slug: 'india-opportunities-fund', name: 'India Opportunities Fund', type: 'MUTUAL_FUND' }, targetWeightPct: 60 }, { asset: { id: 'asset-5', slug: 'emerging-business-fund', name: 'Emerging Business Fund', type: 'EQUITY' }, targetWeightPct: 40 }] },
  ];
  if (path === '/kyc/me/state') return { userId: 'demo-investor', state: 'COMPLETED', panMasked: 'ABCDP****8R', rejectionReason: null, updatedAt: '2026-10-12T08:00:00Z' };
  if (path === '/kyc/me/timeline') return [
    { kind: 'KYC_STATUS', fromState: 'INITIATED', toState: 'PAN_VALIDATED', at: '2026-10-10T09:00:00Z' },
    { kind: 'KYC_STATUS', fromState: 'PAN_VALIDATED', toState: 'COMPLETED', at: '2026-10-12T08:00:00Z' },
  ];
  return null;
}
