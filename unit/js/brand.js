/* Unit Command: the product name, look and plan live here so they're easy to change later. */
window.UC = window.UC || {};
UC.BRAND = {
  name: 'Unit Command',
  short: 'Unit Command',
  mark: 'UC',
  tagline: 'Create it, open it, run it, multiply it.',
  version: '0.6.0'
};
/* Plans: "full" is the owner's system. "lite" is the version that can be marketed (fewer departments and agents). */
UC.PLANS = {
  full: { label: 'Full', depts: null },
  lite: { label: 'Lite', depts: ['sales', 'people', 'ops', 'supply', 'finance', 'customer', 'knowledge'], liteOnly: true }
};
UC.plan = () => { try { return JSON.parse(localStorage.getItem('ocd.uc.plan')) || 'full'; } catch { return 'full'; } };
