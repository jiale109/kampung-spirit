// Category filter pills
export const voucherTypes = [
  { name: 'All' },
  { name: 'Hawker' },
  { name: 'Kopitiam' },
  { name: 'Supermarket'},
  { name: 'Pharmacy' },
]
// export const voucherTypes = [
//   { name: 'All', icon: '✨' },
//   { name: 'Hawker', icon: '🍜' },
//   { name: 'Kopitiam', icon: '☕' },
//   { name: 'Supermarket', icon: '🛒' },
//   { name: 'Pharmacy', icon: '💊' },
// ]
export function voucherTypeClass(type) {
  const match = voucherTypes.find((t) => t.name.toLowerCase() === type.toLowerCase())
  return match ? match.colorClass : 'cat-tech'
}

export function voucherTypeIcon(type) {
  const match = voucherTypes.find((t) => t.name.toLowerCase() === type.toLowerCase())
  return match ? match.icon : '🎟️'
}

// Catalog of vouchers 
export const vouchers = [
  {
    id: 'v1',
    merchant: '7-Eleven',
    branch: 'Eunos MRT Station',
    type: 'Supermarket',
    title: '$2 off any purchase',
    cost: 50,
    logo: '/images/merchants/7eleven.png', //  points to public/images/merchants/7eleven.png
    bg: '#008163',
    description: 'Get $2 off your purchase at 7-Eleven.',
    terms: 'Minimum spend of $4. Valid for 30 days.',
  },
  {
    id: 'v2',
    merchant: 'FairPrice',
    branch: 'Blk 418 Eunos Crescent',
    type: 'Supermarket',
    title: '$5 Grocery Voucher',
    cost: 150,
    logo: '/images/merchants/fairprice.png',
    bg: 'white',
    description: 'Get $5 off your total grocery bill at FairPrice Supermarket.',
    terms: 'Valid on all groceries. No minimum spend.',
  },
  {
    id: 'v3',
    merchant: 'Kimly Kopitiam',
    branch: 'Blk 416 Eunos Crescent',
    type: 'Kopitiam',
    title: 'Free Kopi / Teh with Toast',
    cost: 30,
    logo: '/images/merchants/kimly.png',
    bg: 'white',
    description: 'Redeem one traditional hot beverage with any traditional toast set.',
    terms: 'Dine-in or takeaway before 11:30 AM.',
  },
  {
    id: 'v4',
    merchant: 'Cold Storage',
    branch: 'PLQ Mall (Near Eunos)',
    type: 'Supermarket',
    title: '$10 Grocery Voucher',
    cost: 250,
    logo: '/images/merchants/coldstorage.png',
    bg: 'white',
    description: 'Enjoy $10 off your purchase at Cold Storage.',
    terms: 'Valid with a minimum spend of $20.',
  },
  {
    id: 'v5',
    merchant: 'Unity Pharmacy',
    branch: 'Eunos Crescent',
    type: 'Pharmacy',
    title: '$5 wellness & medicine discount',
    cost: 140,
    logo: '/images/merchants/unity.png',
    bg: 'white',
    description: 'Save $5 on vitamins, daily health supplies, or over-the-counter medication.',
    terms: 'Show digital voucher at counter before payment.',
  },
//   {
//     id: 'v6',
//     merchant: 'Eunos Food Centre',
//     branch: 'Blk 4A Eunos Crescent',
//     type: 'Hawker',
//     title: '$2 off any hawker meal',
//     cost: 50,
//     logo: '/images/merchants/hawker.png',
//     bg: '#b45309',
//     description: 'Enjoy $2 off any cooked food or drink stall at Blk 4A Hawker Centre.',
//     terms: 'Valid for one-time use per stall. Min spend $3.50.',
//   },
  {
    id: 'v7',
    merchant: 'Guardian',
    branch: 'Geylang Serai / Eunos',
    type: 'Pharmacy',
    title: '$3 Guardian Voucher',
    cost: 80,
    logo: '/images/merchants/guardian.png',
    bg: '#FF7E27',
    description: 'Get $3 off your purchase at Guardian',
    terms: 'Present code at checkout. Valid for 30 days.',
  },
]