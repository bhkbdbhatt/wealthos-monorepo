export function partnerDemoData(path: string): unknown | null {
  if (path === '/analytics/advisor') {
    return {
      aumTotalPaise: 184560000000,
      liveSipCount: 286,
      mrrPaise: 487500000,
      clientCount: 128,
      commissionsUpfrontPaise: 124500000,
      commissionsTrailPaise: 68400000,
      timeseries: [
        { date: '2026-06', aumPaise: 168250000000, sipInflowPaise: 42100000, sipOutflowPaise: 6200000 },
        { date: '2026-07', aumPaise: 171480000000, sipInflowPaise: 43800000, sipOutflowPaise: 5900000 },
        { date: '2026-08', aumPaise: 174920000000, sipInflowPaise: 45100000, sipOutflowPaise: 6400000 },
        { date: '2026-09', aumPaise: 178640000000, sipInflowPaise: 46900000, sipOutflowPaise: 7100000 },
        { date: '2026-10', aumPaise: 181370000000, sipInflowPaise: 48200000, sipOutflowPaise: 6800000 },
        { date: '2026-11', aumPaise: 184560000000, sipInflowPaise: 48750000, sipOutflowPaise: 6500000 },
      ],
      byAssetClass: [
        { type: 'MUTUAL_FUND', currentPaise: 112340000000 },
        { type: 'EQUITY', currentPaise: 39620000000 },
        { type: 'BOND', currentPaise: 18460000000 },
        { type: 'FIXED_DEPOSIT', currentPaise: 9420000000 },
        { type: 'INSURANCE', currentPaise: 4800000000 },
      ],
    };
  }
  if (path === '/users/advisor-clients') return [
    { id: 'client-1', fullName: 'Asha Rao', email: 'asha.rao@example.com', phone: null, role: 'CLIENT', status: 'ACTIVE', createdAt: '2024-04-18T00:00:00Z' },
    { id: 'client-2', fullName: 'Vikram Shah', email: 'vikram.shah@example.com', phone: '9811112233', role: 'CLIENT', status: 'ACTIVE', createdAt: '2024-08-02T00:00:00Z' },
    { id: 'client-3', fullName: 'Meera Kapoor', email: 'meera.kapoor@example.com', phone: null, role: 'CLIENT', status: 'ACTIVE', createdAt: '2025-01-14T00:00:00Z' },
    { id: 'client-4', fullName: 'Arjun Mehta', email: 'arjun.mehta@example.com', phone: '9822334455', role: 'CLIENT', status: 'INVITED', createdAt: '2026-02-22T00:00:00Z' },
  ];
  if (path === '/segments') return [
    { id: 'segment-1', name: 'High-value investors', description: 'AUM above ₹50 lakh', clientCount: 42 },
    { id: 'segment-2', name: 'KYC follow-up', description: 'Pending KYC completion', clientCount: 18 },
    { id: 'segment-3', name: 'SIP momentum', description: 'Three or more active SIPs', clientCount: 63 },
  ];
  if (path === '/leads') return [
    { id: 'lead-1', name: 'Priya Nair', email: 'priya.nair@example.com', phone: '9876543210', status: 'NEW', createdAt: '2026-11-02T09:30:00Z' },
    { id: 'lead-2', name: 'Kabir Bedi', email: 'kabir.bedi@example.com', phone: '9811112233', status: 'CONTACTED', createdAt: '2026-11-01T14:20:00Z' },
    { id: 'lead-3', name: 'Rina Joshi', email: 'rina.joshi@example.com', phone: '9822334455', status: 'QUALIFIED', createdAt: '2026-10-30T11:10:00Z' },
  ];
  if (path === '/commissions') return [
    { id: 'commission-1', type: 'UPFRONT', amountPaise: 24500000, status: 'PAID', assetName: 'Nifty 50 Index Fund', createdAt: '2026-10-28T00:00:00Z' },
    { id: 'commission-2', type: 'TRAIL', amountPaise: 1820000, status: 'PENDING', assetName: 'WealthOS Balanced Basket', createdAt: '2026-10-31T00:00:00Z' },
    { id: 'commission-3', type: 'TRAIL', amountPaise: 1640000, status: 'PAID', assetName: 'Quality Equity Fund', createdAt: '2026-10-15T00:00:00Z' },
  ];
  return null;
}
