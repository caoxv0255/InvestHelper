/**
 * ratingToVariant — feature-level helper for mapping financial
 * rating/risk strings to Badge primitive variants.
 *
 * Lives in features/portfolio/ (NOT components/ui/) because it
 * encodes Finance domain knowledge (A-share convention: buy=涨=RED,
 * sell=跌=GREEN). Badge primitive must not know this mapping.
 *
 * A-share convention:
 *   - buy → 涨 → RED → Badge 'danger' (uses --color-profit-up)
 *   - sell → 跌 → GREEN → Badge 'success' (uses --color-profit-down)
 *   - hold → warning
 *   - neutral → neutral
 */
import type { BadgeVariant } from '../../../components/ui/Badge'

export function ratingToVariant(rating: string | undefined | null): BadgeVariant {
  if (!rating) return 'neutral'
  switch (rating.toUpperCase()) {
    case 'BUY':
      return 'danger'
    case 'SELL':
      return 'success'
    case 'HOLD':
      return 'warning'
    case 'NEUTRAL':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function ratingToText(rating: string | undefined | null): string {
  if (!rating) return '-'
  switch (rating.toUpperCase()) {
    case 'BUY':
      return '买入'
    case 'SELL':
      return '卖出'
    case 'HOLD':
      return '持有'
    case 'NEUTRAL':
      return '中性'
    default:
      return rating
  }
}
