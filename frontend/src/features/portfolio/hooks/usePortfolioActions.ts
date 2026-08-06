/**
 * usePortfolioActions
 *
 * Phase 2B — 状态所有权迁移（state ownership migration）第三步。
 *
 * 范围：
 *   仅抽取 Portfolio 页面中"数据变更 + 后续 refetch + 配套 modal close"
 *   这一类 mutation orchestration 到一个 feature hook。
 *   行为 1:1：create/update/delete、refetch、modal close、alert 错误处理
 *   与原页面 handler 完全一致。
 *
 * 不包含：
 *   - modal state ownership（仍在 page）
 *   - Tp/Sl 任何状态/计算
 *   - 任何 useState（handler 无 loading state，与原页面保持一致）
 *   - 任何 callback abstraction（保持 handler 1:1 形状）
 *
 * 设计原则：
 *   - hook 只编排 mutation，不持有 mutation 触发的源数据
 *   - page 通过 params 注入 refetch 函数（来自 usePortfolioData）
 *     和 modal close 回调（来自 useModal）
 *   - editing / delete target 等"操作对象"由 page wrapper 传入
 */

import {
  createHolding,
  updateHolding,
  deleteHolding,
} from '../../../api/holdings'
import {
  createDeposit,
  updateDeposit,
  deleteDeposit,
} from '../../../api/deposits'
import type {
  Holding,
  HoldingCreate,
  Deposit,
  DepositCreate,
} from '../../../types'
import type { DeleteTarget } from '../components/DeleteConfirmModal'

export interface UsePortfolioActionsParams {
  // refetch 来源（来自 usePortfolioData().holdings.refetch / deposits.refetch）
  refetchHoldings: () => Promise<void>
  refetchDeposits: () => Promise<void>

  // modal close 回调（page 持有 modal state，hook 不持有）
  closeHoldingModal: () => void
  closeDepositModal: () => void
  closeDeleteModal: () => void

  // 错误回调（page 端可挂 toast/alert 等任意通知方式）
  onError?: (msg: string) => void
}

export interface PortfolioActions {
  submitHoldingForm: (
    values: HoldingCreate,
    editing: Holding | null,
  ) => Promise<void>
  submitDepositForm: (
    values: DepositCreate,
    editing: Deposit | null,
  ) => Promise<void>
  confirmDelete: (target: DeleteTarget | null) => Promise<void>
}

export function usePortfolioActions(
  params: UsePortfolioActionsParams,
): PortfolioActions {
  const {
    refetchHoldings,
    refetchDeposits,
    closeHoldingModal,
    closeDepositModal,
    closeDeleteModal,
    onError,
  } = params
  const reportError = (msg: string) => {
    if (onError) onError(msg)
    else alert(msg)
  }

  const submitHoldingForm = async (
    values: HoldingCreate,
    editing: Holding | null,
  ) => {
    try {
      if (editing) {
        await updateHolding(editing.id, values)
      } else {
        await createHolding(values)
      }
      closeHoldingModal()
      void refetchHoldings()
    } catch (err: any) {
      reportError(err.message || '保存失败')
    }
  }

  const submitDepositForm = async (
    values: DepositCreate,
    editing: Deposit | null,
  ) => {
    try {
      if (editing) {
        await updateDeposit(editing.id, values)
      } else {
        await createDeposit(values)
      }
      closeDepositModal()
      void refetchDeposits()
    } catch (err: any) {
      reportError(err.message || '保存失败')
    }
  }

  const confirmDelete = async (target: DeleteTarget | null) => {
    if (!target) return
    try {
      if (target.type === 'holding') {
        await deleteHolding(target.id)
        void refetchHoldings()
      } else {
        await deleteDeposit(target.id)
        void refetchDeposits()
      }
      closeDeleteModal()
    } catch (err: any) {
      reportError(err.message || '删除失败')
    }
  }

  return {
    submitHoldingForm,
    submitDepositForm,
    confirmDelete,
  }
}
