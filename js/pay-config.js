/** Private payment config — recipient details never shown on the public site */
window.SP_PAY_CONFIG = {
  recipientName: 'Mohammad Hamdan',
  cardNumber: '4475133714333777',
  whatsapp: '970595052784',
  plans: {
    starter: { price: 12, currency: 'USD', nameKey: 'pricing.starter' },
    growth: { price: 25, currency: 'USD', nameKey: 'pricing.growth' },
    pro: { price: 50, currency: 'USD', nameKey: 'pricing.pro' }
  },
  methods: [
    { id: 'card', nameKey: 'pay.method.card' },
    { id: 'reflect', nameKey: 'pay.method.reflect' },
    { id: 'bank', nameKey: 'pay.method.bank' },
    { id: 'visa', nameKey: 'pay.method.visa' }
  ]
};
