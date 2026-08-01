"""风险分析相关 Pydantic Schema"""
from pydantic import BaseModel, Field


class IndustryConcentrationItem(BaseModel):
    """行业集中度单项"""
    industry: str = Field(..., description="行业名称")
    weight: float = Field(..., description="权重（0-1）")
    amount: float = Field(..., description="行业市值")


class CorrelationMatrix(BaseModel):
    """相关性矩阵"""
    codes: list[str] = Field(..., description="标的代码列表")
    correlations: list[list[float]] = Field(..., description="相关系数矩阵")


class VaRResult(BaseModel):
    """VaR 计算结果"""
    amount: float = Field(..., description="单日最大可能损失金额")
    percentage: float = Field(..., description="相对组合市值的损失百分比")
    confidence: float = Field(..., description="置信水平")


class RiskScoreFactors(BaseModel):
    """风险评分因子"""
    concentration_score: float = Field(..., description="集中度得分")
    correlation_score: float = Field(..., description="相关性得分")
    var_score: float = Field(..., description="VaR得分")
    total_score: float = Field(..., description="综合得分")
    hhi: float = Field(..., description="赫芬达尔指数")
    max_industry_weight: float = Field(..., description="最大行业权重")


class RiskScore(BaseModel):
    """综合风险评分"""
    level: str = Field(..., description="风险等级: low/medium/high/very_high")
    label: str = Field(..., description="风险等级中文标签")
    factors: RiskScoreFactors = Field(..., description="评分因子明细")


class LargestPosition(BaseModel):
    """最大单一持仓"""
    code: str = Field(..., description="标的代码")
    weight: float = Field(..., description="权重（0-1）")


class RiskSummary(BaseModel):
    """风险分析汇总"""
    total_value: float = Field(..., description="组合总市值")
    position_count: int = Field(..., description="持仓数量")


class FactorExposureItem(BaseModel):
    """单因子暴露"""
    factor: str = Field(..., description="因子名称: market/size/value/momentum/industry")
    value: float = Field(..., description="暴露值")


class FactorAttributionItem(BaseModel):
    """单因子贡献"""
    factor: str = Field(..., description="因子名称")
    contribution: float = Field(..., description="年化因子贡献（收益率形式）")


class FactorRadarItem(BaseModel):
    """雷达图单项"""
    indicator: str = Field(..., description="指标名称")
    value: float = Field(..., description="标准化后的数值（0-1）")


class StockBetaItem(BaseModel):
    """个股 Beta 信息"""
    code: str = Field(..., description="标的代码")
    beta: float = Field(..., description="相对沪深300的 Beta")
    weight: float = Field(..., description="组合权重（0-1）")
    industry: str | None = Field(None, description="所属行业")


class RiskAnalysisResult(BaseModel):
    """完整风险分析结果"""
    industry_concentration: list[IndustryConcentrationItem] = Field(..., description="行业集中度分布")
    correlation_matrix: CorrelationMatrix = Field(..., description="收益相关性矩阵")
    var: VaRResult = Field(..., description="VaR结果")
    risk_score: RiskScore = Field(..., description="综合风险评分")
    largest_position: LargestPosition = Field(..., description="最大单一持仓")
    summary: RiskSummary = Field(..., description="汇总信息")
    factor_exposures: list[FactorExposureItem] = Field(default_factory=list, description="多因子暴露")
    factor_attribution: list[FactorAttributionItem] = Field(default_factory=list, description="因子贡献归因")
    factor_radar: list[FactorRadarItem] = Field(default_factory=list, description="因子雷达图数据")
    stock_betas: list[StockBetaItem] = Field(default_factory=list, description="个股 Beta 列表")
    warnings: list[str] = Field(default_factory=list, description="计算过程中的警告信息")
