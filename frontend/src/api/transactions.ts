import api from './request'

export type TransactionSide = 'buy' | 'sell' | 'dividend' | 'deposit' | 'withdraw'

/** 资金流水方向列表 */
export const CASH_FLOW_SIDES: TransactionSide[] = ['deposit', 'withdraw']
/** 持仓交易方向列表 */
export const ASSET_SIDES: TransactionSide[] = ['buy', 'sell', 'dividend']

export interface Transaction {
  id: number
  account: string
  asset_type: string
  code: string
  name: string
  side: TransactionSide
  trade_date: string
  quantity: number
  price: number
  fee: number
  currency: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type TransactionCreate = Omit<Transaction, 'id' | 'created_at' | 'updated_at'>

export const getTransactions = () => api.get<Transaction[]>('/transactions')
export const createTransaction = (data: TransactionCreate) => api.post<Transaction>('/transactions', data)
export const deleteTransaction = (id: number) => api.delete(`/transactions/${id}`)
