import { Category } from './types'

// ─── Agent question set ────────────────────────────────────────────────────────
export const CATEGORIES: Category[] = [
  {
    id: 'strategy_fit',
    name: 'Strategy Fit',
    weight: 0.20,
    questions: [
      {
        id: 'sf_1',
        text: 'Does the agent align with your investment strategy (e.g., capital growth vs. cash flow)?',
        options: [
          { label: 'Yes – clearly articulated my strategy and recommended accordingly', score: 10 },
          { label: 'Somewhat – touched on it but wasn\'t specific', score: 6 },
          { label: 'No – went straight to recommendations without asking', score: 2 },
        ],
      },
      {
        id: 'sf_2',
        text: 'Did the agent ask about your financial goals and risk tolerance before recommending suburbs?',
        options: [
          { label: 'Yes – thorough discussion before any recommendations', score: 10 },
          { label: 'Briefly – asked a few surface-level questions', score: 6 },
          { label: 'No – gave generic advice without asking', score: 2 },
        ],
      },
    ],
  },
  {
    id: 'data_evidence',
    name: 'Data & Evidence',
    weight: 0.15,
    questions: [
      {
        id: 'de_1',
        text: 'Did the agent provide suburb-level sale comparables or market data?',
        options: [
          { label: 'Yes – comprehensive data with sources', score: 10 },
          { label: 'Some – mentioned data but limited detail', score: 6 },
          { label: 'No – no data provided', score: 2 },
        ],
      },
      {
        id: 'de_2',
        text: 'Did the agent reference vacancy rates, rental demand, or infrastructure pipeline?',
        options: [
          { label: 'Yes – with specific metrics and sources', score: 10 },
          { label: 'Mentioned – but high-level only', score: 6 },
          { label: 'No – not discussed', score: 2 },
        ],
      },
    ],
  },
  {
    id: 'asset_quality',
    name: 'Asset Quality',
    weight: 0.20,
    questions: [
      {
        id: 'aq_1',
        text: "Did the agent assess the property's rental yield potential with specific numbers?",
        options: [
          { label: 'Yes – provided yield calculations and comparisons', score: 10 },
          { label: 'General estimate provided', score: 6 },
          { label: 'No – yield not discussed', score: 2 },
        ],
      },
      {
        id: 'aq_2',
        text: 'Did the agent discuss capital growth drivers (e.g., rezoning, infrastructure, population growth)?',
        options: [
          { label: 'Yes – specific, evidenced growth drivers', score: 10 },
          { label: 'Yes – mentioned but vague', score: 6 },
          { label: 'No – not discussed', score: 2 },
        ],
      },
    ],
  },
  {
    id: 'financials',
    name: 'Financial Transparency',
    weight: 0.15,
    questions: [
      {
        id: 'fin_1',
        text: "Were all fees (buyer's agent, commission, referral) disclosed upfront?",
        options: [
          { label: 'Yes – full fee schedule provided upfront', score: 10 },
          { label: 'Partially – some fees mentioned, others vague', score: 6 },
          { label: 'No – fees were unclear or avoided', score: 2 },
        ],
      },
      {
        id: 'fin_2',
        text: 'Did the agent explain total acquisition costs (stamp duty, legal, inspections)?',
        options: [
          { label: 'Yes – detailed breakdown provided', score: 10 },
          { label: 'Brief overview only', score: 6 },
          { label: 'No – not covered', score: 2 },
        ],
      },
    ],
  },
  {
    id: 'track_record',
    name: 'Track Record',
    weight: 0.10,
    questions: [
      {
        id: 'tr_1',
        text: 'Did the agent provide verifiable past client results or case studies?',
        options: [
          { label: 'Yes – specific results with addresses or verified testimonials', score: 10 },
          { label: 'General claims made without evidence', score: 6 },
          { label: 'No – no track record offered', score: 2 },
        ],
      },
      {
        id: 'tr_2',
        text: "How long has the agent / firm been operating as a buyer's agent?",
        options: [
          { label: '5+ years with an established presence', score: 10 },
          { label: '2–5 years', score: 6 },
          { label: 'Less than 2 years', score: 2 },
        ],
      },
    ],
  },
  {
    id: 'professionalism',
    name: 'Professionalism',
    weight: 0.10,
    questions: [
      {
        id: 'pro_1',
        text: 'Did the agent respond to queries promptly and communicate professionally?',
        options: [
          { label: 'Yes – always responsive, clear and professional', score: 10 },
          { label: 'Mostly – minor gaps in responsiveness', score: 6 },
          { label: 'No – slow, vague or unprofessional', score: 2 },
        ],
      },
      {
        id: 'pro_2',
        text: 'Did the agent make negative comments about other agents, developers or properties?',
        options: [
          { label: 'No – remained objective and professional throughout', score: 10 },
          { label: 'Once or twice – minor negative remarks', score: 6 },
          { label: 'Yes – frequently negative or dismissive', score: 2 },
        ],
      },
    ],
  },
  {
    id: 'incentives',
    name: 'Incentives',
    weight: 0.10,
    questions: [
      {
        id: 'inc_1',
        text: 'Does the agent have any referral arrangements with developers, mortgage brokers, or other third parties?',
        options: [
          { label: 'No conflicts – fee-only model clearly disclosed', score: 10 },
          { label: 'Referral arrangements disclosed and explained', score: 6 },
          { label: 'Undisclosed or evasive about referral arrangements', score: 2 },
        ],
      },
    ],
  },
]

export const ALL_QUESTION_IDS = CATEGORIES.flatMap((c) => c.questions.map((q) => q.id))

// ─── Property question set ─────────────────────────────────────────────────────
export const PROPERTY_CATEGORIES: Category[] = [
  {
    id: 'prop_asset',
    name: 'Asset Quality',
    weight: 0.25,
    questions: [
      {
        id: 'pa_1',
        text: 'Does the property show evidence of poor physical condition or deferred maintenance that was not disclosed up front?',
        options: [
          { label: 'No – condition was clearly disclosed and independently verified', score: 10 },
          { label: 'Partially – some concerns mentioned but not fully assessed', score: 6 },
          { label: 'Yes – condition issues exist that were not disclosed', score: 2 },
        ],
      },
      {
        id: 'pa_2',
        text: 'Does the property have development-friendly land characteristics (regular shape, flat block, no restrictive easements)?',
        options: [
          { label: 'Yes – standard rectangular block with no encumbrances', score: 10 },
          { label: 'Somewhat – minor limitations but broadly usable', score: 6 },
          { label: 'No – irregular, sloped, or heavily encumbered land', score: 2 },
        ],
      },
      {
        id: 'pa_3',
        text: 'Was a building and pest inspection completed, or explicitly recommended before exchange?',
        options: [
          { label: 'Yes – completed with a clean or fully disclosed report', score: 10 },
          { label: 'Recommended but not yet completed', score: 6 },
          { label: 'No – not recommended or actively discouraged', score: 2 },
        ],
      },
    ],
  },
  {
    id: 'prop_finance',
    name: 'Financial Viability',
    weight: 0.25,
    questions: [
      {
        id: 'pf_1',
        text: 'Is the stated rental yield supported by current, independently sourced comparable rental data?',
        options: [
          { label: 'Yes – yield backed by recent rental comparables with sources', score: 10 },
          { label: 'General estimate provided without third-party source', score: 6 },
          { label: 'No – yield claimed without any supporting data', score: 2 },
        ],
      },
      {
        id: 'pf_2',
        text: 'Was the purchase price benchmarked against recent comparable sales in the same suburb?',
        options: [
          { label: 'Yes – comparable sales data provided with addresses and dates', score: 10 },
          { label: 'Some comparables mentioned but limited detail', score: 6 },
          { label: 'No – price not benchmarked against comparable sales', score: 2 },
        ],
      },
      {
        id: 'pf_3',
        text: 'Were total holding costs (rates, insurance, property management, vacancy buffer) included in the financial projection?',
        options: [
          { label: 'Yes – full cost breakdown including vacancy and management fees', score: 10 },
          { label: 'Partial – some costs covered but key items omitted', score: 6 },
          { label: 'No – holding costs not addressed', score: 2 },
        ],
      },
    ],
  },
  {
    id: 'prop_location',
    name: 'Location & Demand',
    weight: 0.15,
    questions: [
      {
        id: 'pl_1',
        text: 'Is rental demand in the suburb evidenced by vacancy rates or independent rental marketplace data?',
        options: [
          { label: 'Yes – vacancy rate provided from a named independent source', score: 10 },
          { label: 'General demand claimed without specific source', score: 6 },
          { label: 'No – rental demand not substantiated', score: 2 },
        ],
      },
      {
        id: 'pl_2',
        text: 'Was proximity to transport, schools, and employment hubs documented with specific examples?',
        options: [
          { label: 'Yes – specific distances, names, and travel times provided', score: 10 },
          { label: 'Mentioned in general terms without specifics', score: 6 },
          { label: 'No – infrastructure not assessed', score: 2 },
        ],
      },
      {
        id: 'pl_3',
        text: 'Were surrounding land uses and neighbourhood composition (e.g. public housing, industrial zones) assessed?',
        options: [
          { label: 'Yes – immediate surroundings assessed with any risks disclosed', score: 10 },
          { label: 'Briefly noted without full assessment', score: 6 },
          { label: 'No – neighbourhood composition not discussed', score: 2 },
        ],
      },
    ],
  },
  {
    id: 'prop_risk',
    name: 'Risk Factors',
    weight: 0.20,
    questions: [
      {
        id: 'pr_1',
        text: 'Were environmental risks (flood zone, bushfire overlay, contaminated land, heritage overlay) checked and disclosed?',
        options: [
          { label: 'Yes – all environmental overlays checked and either clear or disclosed', score: 10 },
          { label: 'Some checks done but not comprehensive', score: 6 },
          { label: 'No – environmental risks not assessed', score: 2 },
        ],
      },
      {
        id: 'pr_2',
        text: 'Were external risk factors (high-voltage power lines, public housing density, strata levies, commercial neighbours) identified?',
        options: [
          { label: 'Yes – all external risk factors identified and their impact assessed', score: 10 },
          { label: 'Some factors mentioned without full risk assessment', score: 6 },
          { label: 'No – external risk factors not disclosed', score: 2 },
        ],
      },
    ],
  },
  {
    id: 'prop_evidence',
    name: 'Evidence & Justification',
    weight: 0.15,
    questions: [
      {
        id: 'pe_1',
        text: 'Is the recommendation supported by independent comparable sales or third-party research reports?',
        options: [
          { label: 'Yes – independent data sources named and cited', score: 10 },
          { label: 'Some supporting data provided but not independently sourced', score: 6 },
          { label: 'No – recommendation relies solely on agent assertions', score: 2 },
        ],
      },
      {
        id: 'pe_2',
        text: 'Is the investment thesis (why this asset, at this price, in this location) articulated with specific, verifiable evidence?',
        options: [
          { label: 'Yes – clear thesis with specific, verifiable supporting facts', score: 10 },
          { label: 'Partially articulated but missing key supporting detail', score: 6 },
          { label: 'No – recommendation not justified with verifiable evidence', score: 2 },
        ],
      },
    ],
  },
]

export const ALL_PROPERTY_QUESTION_IDS = PROPERTY_CATEGORIES.flatMap((c) => c.questions.map((q) => q.id))

