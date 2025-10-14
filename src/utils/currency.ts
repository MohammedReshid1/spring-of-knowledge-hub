/**
 * Currency formatting utilities
 */

interface CurrencyConfig {
  symbol: string;
  code: string;
  position: 'before' | 'after';
  decimals: number;
}

const CURRENCY_CONFIGS: Record<string, CurrencyConfig> = {
  ETB: {
    symbol: 'Br',
    code: 'ETB',
    position: 'before',
    decimals: 2
  },
  USD: {
    symbol: '$',
    code: 'USD',
    position: 'before',
    decimals: 2
  },
  EUR: {
    symbol: '€',
    code: 'EUR',
    position: 'before',
    decimals: 2
  },
  GBP: {
    symbol: '£',
    code: 'GBP',
    position: 'before',
    decimals: 2
  }
};

/**
 * Format a number as currency
 */
export function formatCurrency(amount: number, currencyCode: string = 'ETB'): string {
  const config = CURRENCY_CONFIGS[currencyCode] || CURRENCY_CONFIGS.ETB;
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals
  });

  if (config.position === 'before') {
    return `${config.symbol} ${formattedAmount}`;
  } else {
    return `${formattedAmount} ${config.symbol}`;
  }
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currencyCode: string = 'ETB'): string {
  const config = CURRENCY_CONFIGS[currencyCode] || CURRENCY_CONFIGS.ETB;
  return config.symbol;
}

/**
 * Get currency configuration
 */
export function getCurrencyConfig(currencyCode: string = 'ETB'): CurrencyConfig {
  return CURRENCY_CONFIGS[currencyCode] || CURRENCY_CONFIGS.ETB;
}
