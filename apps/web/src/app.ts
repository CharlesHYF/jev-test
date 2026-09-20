type NoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: { true?: string; false?: string };
};

type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string | null>;
};

type ScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[];
};

type JevQuestion = NoulQuestion | ChoiceQuestion | ScoreQuestion;

type ScenarioQuestion = {
  id: string;
  label: string;
  description: string;
  question: JevQuestion;
};

type ScenarioConfig = {
  id: string;
  title: string;
  sidebarTitle: string;
  subtitle: string;
  description: string;
  questions: ScenarioQuestion[];
  samples: Array<{ title: string; text: string }>;
  repeats?: number;
};

type JevAnswer = Record<string, unknown> & {
  type?: "noul" | "choice" | "score";
  noul?: number;
  choice?: string;
  score?: number;
  confidence?: number;
  legend?: Record<string, string>;
  probabilities?: Record<string, number>;
};

type JevProxyResponse = {
  data?: {
    model?: string;
    answers?: Record<string, JevAnswer>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  serverMetrics?: {
    attempts?: number;
    retryCount?: number;
    retryDelayMs?: number;
    finalAttemptMs?: number;
    upstreamHeadersMs?: number;
    upstreamTotalMs?: number;
  };
  error?: string;
  providerStatus?: number;
  details?: unknown;
};

type SseEvent = {
  type?: string;
  delta?: string;
  message?: string;
  error?: { message?: string };
  response?: { status?: string };
};

type JevMetrics = {
  headersMs: number;
  firstByteMs: number;
  totalMs: number;
  upstreamTotalMs?: number;
  retryCount?: number;
};

type OpenAIMetrics = {
  headersMs: number;
  firstEventMs: number | null;
  firstTextMs: number | null;
  totalMs: number;
  eventCount: number;
};

type RunResult = {
  jevData?: JevProxyResponse["data"];
  jevMetrics?: JevMetrics;
  openAIData?: Record<string, unknown>;
  openAIMetrics?: OpenAIMetrics;
};

type StepStatus = "waiting" | "active" | "done" | "error";

type StepState = {
  id: "build" | "jev" | "openai" | "compare";
  title: string;
  detail: string;
  status: StepStatus;
  timeMs?: number;
};

type TurnView = {
  root: HTMLElement;
  title: HTMLElement;
  jevStatus: HTMLElement;
  openAIStatus: HTMLElement;
  jevMetricA: HTMLElement;
  jevMetricB: HTMLElement;
  openAIMetricA: HTMLElement;
  openAIMetricB: HTMLElement;
  jevBody: HTMLElement;
  openAIBody: HTMLElement;
  comparison: HTMLElement;
  analysisMeta: HTMLElement;
};

type ConversationSession = {
  id: string;
  scenarioId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  displayTime: string;
  messageListHtml: string;
  totalRunCount: number;
  jevTotals: number[];
  openAITotals: number[];
  openAIFirstTexts: number[];
  inspectorHtml?: string;
  activeTab?: string;
};

const SESSION_STORAGE_KEY = "jev-openai-chat-inspector.sessions.v1";
const MAX_SESSIONS = 24;

const scenarios: ScenarioConfig[] = [
  {
    id: "comprehensive",
    title: "电商客服 · 综合判断",
    sidebarTitle: "电商客服 · 综合判断",
    subtitle: "紧急程度 · 问题分类 · 客户情绪",
    description: "从客户消息中同时识别是否需要优先处理、主要问题类别与不满程度。",
    questions: [
      {
        id: "urgency",
        label: "是否需要优先处理",
        description: "判断客户是否表达明确时效压力或需要立即介入。",
        question: {
          type: "noul",
          instructions: "这条电商客服消息是否需要优先、尽快处理？",
          criteria: {
            true: "存在明确时效压力、业务损失、重要日期临近、强烈催促或需要立即介入",
            false: "普通咨询或没有明显时间压力，可以按常规优先级处理",
          },
        },
      },
      {
        id: "category",
        label: "问题分类",
        description: "从预定义业务类别中选择最主要的问题。",
        question: {
          type: "choice",
          instructions: "这条客户消息最主要的问题属于哪一类？",
          criteria: {
            物流问题: "配送延迟、包裹未收到、物流停滞、签收异常、配送地址等",
            退款退货: "退款进度、退货、换货、撤销订单、售后退款等",
            支付问题: "付款失败、重复扣款、支付方式、订单支付状态等",
            商品问题: "商品破损、缺件、质量、描述不符、尺寸规格或使用问题",
            账户问题: "登录、账号、会员、优惠券、积分、账户信息等",
            其他问题: "无法归入以上类别的其他电商客服问题",
          },
        },
      },
      {
        id: "frustration",
        label: "客户不满程度",
        description: "把客户当前情绪映射到 0–3 的有序等级。",
        question: {
          type: "score",
          instructions: "客户在这条消息中的不满或愤怒程度有多高？",
          criteria: ["平静，没有明显不满", "轻微不满，但语气克制", "明显不满，存在抱怨或强烈催促", "强烈愤怒，出现威胁投诉、取消或激烈表达"],
        },
      },
    ],
    samples: [
      { title: "物流延误", text: "我的包裹显示已经签收，但是我根本没有收到。这是第三次联系客服了，请尽快帮我处理退款，我已经等了很久了！" },
      { title: "退款催促", text: "我申请退款已经一周了，页面一直显示处理中。之前客服说三天会到账，请告诉我到底什么时候能退。" },
      { title: "支付失败", text: "我付款时连续提示失败，但银行卡已经扣款了。请马上帮我确认订单有没有付款成功，别再重复扣款。" },
      { title: "商品破损", text: "今天收到的咖啡机外壳裂了，包装里还有碎片。我等了很久才收到，请尽快安排换货。" },
    ],
  },
  {
    id: "routing",
    title: "售后路由",
    sidebarTitle: "售后路由",
    subtitle: "处理队列 · 优先级 · 是否升级",
    description: "用于测试 Jev 在客服自动分流与 SLA 排队中的结构化决策。",
    questions: [
      {
        id: "escalate",
        label: "是否需要人工升级",
        description: "判断是否超出常规客服处理范围，需要人工复核或升级。",
        question: { type: "noul", instructions: "这条客服消息是否需要升级给人工高级客服或主管处理？", criteria: { true: "存在高金额、重复投诉、威胁升级、复杂争议或规则外情况", false: "可由常规客服流程直接处理" } },
      },
      {
        id: "route",
        label: "处理队列",
        description: "选择最合适的客服业务队列。",
        question: { type: "choice", instructions: "这条消息最适合路由到哪个客服队列？", criteria: { 物流队列: "配送、签收、承运商", 退款队列: "退款、退货、换货", 支付队列: "扣款、支付状态", 商品支持: "质量、缺件、规格", 账户支持: "登录、会员、优惠券", 人工复核: "复杂争议或无法归类" } },
      },
      {
        id: "priority",
        label: "工单优先级",
        description: "按常规、较高、高、紧急四档决定 SLA。",
        question: { type: "score", instructions: "按客服工单的处理优先级进行评分。", criteria: ["常规", "较高", "高优先级", "紧急"] },
      },
    ],
    samples: [
      { title: "重复投诉", text: "我已经联系你们四次了，每次都说会处理，但订单退款还是没有进展。如果今天没有明确答复，我会提交平台投诉。" },
      { title: "普通咨询", text: "请问这个订单可以修改收货地址吗？现在还没有发货。" },
      { title: "高金额争议", text: "这笔订单金额 8500 元，系统显示已退款，但我银行卡完全没有收到，请安排人工核查。" },
      { title: "账户问题", text: "我换了手机号之后无法登录会员账户，积分和优惠券都在旧账号里。" },
    ],
  },
  {
    id: "refund",
    title: "退款风险",
    sidebarTitle: "退款风险",
    subtitle: "退款意图 · 风险等级 · 下一动作",
    description: "用于验证自动退款前的风险判断与人工复核门槛。",
    questions: [
      {
        id: "refund_intent",
        label: "是否明确要求退款",
        description: "识别客户是否已经提出退款、赔偿或撤单请求。",
        question: { type: "noul", instructions: "客户是否明确要求退款、赔偿或取消订单？" },
      },
      {
        id: "refund_risk",
        label: "自动退款风险",
        description: "评估直接自动退款是否存在异常或争议风险。",
        question: { type: "score", instructions: "评估该请求直接自动退款的业务风险。", criteria: ["低风险，可自动处理", "较低风险，可常规核验", "中风险，需要补充证据", "高风险，应人工审核", "极高风险，应拦截升级"] },
      },
      {
        id: "refund_action",
        label: "建议动作",
        description: "从固定动作集合中选择下一步。",
        question: { type: "choice", instructions: "该退款请求下一步最合适的动作是什么？", criteria: { 自动退款: "证据充分且风险低", 补充材料: "需要照片、物流或付款凭证", 人工复核: "存在争议或中高风险", 拒绝申请: "明显不满足退款条件" } },
      },
    ],
    samples: [
      { title: "低风险退货", text: "商品刚收到，尺寸不合适，我还没有使用，包装和吊牌都完整，想按规则退货退款。" },
      { title: "签收未收到", text: "物流显示签收但我没收到，订单 2300 元，过去一年我没有申请过售后，请问能直接退款吗？" },
      { title: "重复索赔", text: "这是我这个月第三个没有收到的包裹，我要求马上退款，不接受任何物流调查。" },
      { title: "商品破损", text: "打开箱子发现玻璃杯碎了，我可以提供照片，希望直接退款。" },
    ],
  },
  {
    id: "logistics",
    title: "物流异常",
    sidebarTitle: "物流异常",
    subtitle: "异常类型 · 丢件判断 · 紧急程度",
    description: "专门测试物流延迟、丢件、签收异常等固定决策空间。",
    questions: [
      { id: "lost", label: "是否疑似丢件", description: "判断物流状态是否已达到疑似丢件条件。", question: { type: "noul", instructions: "根据客户描述，这个包裹是否疑似已经丢失？" } },
      { id: "logistics_type", label: "物流异常类型", description: "识别最主要的物流异常类型。", question: { type: "choice", instructions: "这条消息属于哪一种物流异常？", criteria: { 配送延误: "长时间无更新或超时", 疑似丢件: "长期无轨迹且无法定位", 签收未收到: "系统显示签收但客户未收到", 地址问题: "地址错误、无法派送", 正常追踪: "仍在正常运输周期" } } },
      { id: "logistics_urgency", label: "物流处理优先级", description: "根据日期、损失和客户诉求决定优先级。", question: { type: "score", instructions: "评估该物流问题的客服处理优先级。", criteria: ["常规", "较高", "高", "紧急"] } },
    ],
    samples: [
      { title: "签收未收到", text: "物流昨天显示已签收，但门口、前台和邻居都没有包裹，我也没接到快递电话。" },
      { title: "轨迹停滞", text: "包裹已经在同一个中转站停了 6 天，没有任何新轨迹。" },
      { title: "地址错误", text: "我刚发现地址写错了一位门牌号，订单还在运输中，可以帮我改吗？" },
      { title: "生日礼物", text: "这是孩子明天生日的礼物，已经晚了两天，请今天一定帮我查清楚。" },
    ],
  },
  {
    id: "sentiment",
    title: "客户情绪",
    sidebarTitle: "客户情绪",
    subtitle: "负面判断 · 强度评分 · 语气类型",
    description: "测试固定情绪空间下的二元判断、连续等级与类别选择。",
    questions: [
      { id: "negative", label: "是否明显负面", description: "判断当前语气是否已经表现出负面情绪。", question: { type: "noul", instructions: "这条客服消息是否表达了明显负面情绪？" } },
      { id: "emotion_score", label: "负面情绪强度", description: "从平静到强烈愤怒进行有序评分。", question: { type: "score", instructions: "评估客户负面情绪的强度。", criteria: ["平静", "轻微不满", "明显不满", "愤怒", "强烈愤怒或威胁投诉"] } },
      { id: "tone", label: "主要语气", description: "选择客户最主要的沟通语气。", question: { type: "choice", instructions: "客户当前最主要的沟通语气是什么？", criteria: { 平静: null, 焦虑: "担心时间、损失或结果", 失望: "对商品或服务结果明显失望", 愤怒: "强烈抱怨或责备", 威胁投诉: "明确表示投诉、曝光、拒付或升级" } } },
    ],
    samples: [
      { title: "平静", text: "你好，我想确认一下退款大概还需要几天到账，谢谢。" },
      { title: "焦虑", text: "物流一直不更新，我明天就要出差了，能不能尽快帮我确认什么时候送到？" },
      { title: "失望", text: "等了两周收到的还是错误型号，真的很失望，希望这次可以认真处理。" },
      { title: "威胁投诉", text: "这是第三次出错了，如果今天还不给处理结果，我会直接向平台投诉并申请拒付。" },
    ],
  },
  {
    id: "stress",
    title: "批量压力测试",
    sidebarTitle: "批量压力测试",
    subtitle: "同一输入连续执行 5 轮",
    description: "复用综合判断问题，连续运行五轮，重点观察 P50 / P95、抖动与 SSE 首文本延迟。",
    repeats: 5,
    questions: [],
    samples: [
      { title: "物流延误", text: "我的包裹显示已经签收，但是我根本没有收到。这是第三次联系客服了，请尽快帮我处理退款，我已经等了很久了！" },
      { title: "支付失败", text: "付款失败但银行卡已经扣款，请帮我尽快核对。" },
      { title: "退款催促", text: "退款超过承诺时间还没到账，请今天给我明确处理结果。" },
      { title: "商品破损", text: "商品到货就是损坏的，我已经上传照片，请马上安排处理。" },
    ],
  },
];

const scenarioSelect = byId<HTMLSelectElement>("scenarioSelect");
const sceneList = byId<HTMLElement>("sceneList");
const scenarioHeadline = byId<HTMLElement>("scenarioHeadline");
const scenarioDescription = byId<HTMLElement>("scenarioDescription");
const scenarioSummary = byId<HTMLElement>("scenarioSummary");
const questionMap = byId<HTMLElement>("questionMap");
const sampleGrid = byId<HTMLElement>("sampleGrid");
const assistantIntro = byId<HTMLElement>("assistantIntro");
const messageInput = byId<HTMLTextAreaElement>("messageInput");
const sendButton = byId<HTMLButtonElement>("sendButton");
const quickExampleButton = byId<HTMLButtonElement>("quickExampleButton");
const attachmentButton = byId<HTMLButtonElement>("attachmentButton");
const chatScroll = byId<HTMLElement>("chatScroll");
const messageList = byId<HTMLElement>("messageList");
const composerStatus = byId<HTMLElement>("composerStatus");
const newChatButton = byId<HTMLButtonElement>("newChatButton");
const conversationHistory = byId<HTMLElement>("conversationHistory");
const apiChipText = byId<HTMLElement>("apiChipText");
const settingsButton = byId<HTMLButtonElement>("settingsButton");
const appearanceButton = byId<HTMLButtonElement>("appearanceButton");
const settingsDialog = byId<HTMLDialogElement>("settingsDialog");
const jevModel = byId<HTMLInputElement>("jevModel");
const openaiModel = byId<HTMLSelectElement>("openaiModel");
const reasoningEffort = byId<HTMLSelectElement>("reasoningEffort");
const maxOutputTokens = byId<HTMLInputElement>("maxOutputTokens");
const apiStatus = byId<HTMLElement>("apiStatus");
const inspectorScroll = document.querySelector<HTMLElement>(".inspector-scroll")!;

let currentScenarioId = "comprehensive";
let busy = false;
let turnSequence = 0;
let totalRunCount = 0;
let jevTotals: number[] = [];
let openAITotals: number[] = [];
let openAIFirstTexts: number[] = [];
let currentSteps = initialSteps();
let executionLogCount = 0;
let latestSseCount = 0;
let sessions: ConversationSession[] = loadSessions();
let currentSessionId: string | null = null;

initialize();

function initialize() {
  for (const scenario of scenarios) {
    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = scenario.title;
    scenarioSelect.append(option);
  }

  renderSceneList();
  renderConversationHistory();
  renderScenario("comprehensive");
  resetCurrentWorkspace();
  renderSteps();
  bindTabs();
  bindCopyButtons();
  void checkHealth();

  scenarioSelect.addEventListener("change", () => switchScenario(scenarioSelect.value));
  sendButton.addEventListener("click", () => void sendCurrentMessage());
  quickExampleButton.addEventListener("click", () => {
    const sample = getScenario().samples[0];
    if (!sample) return;
    messageInput.value = sample.text;
    messageInput.focus();
  });
  attachmentButton.addEventListener("click", () => messageInput.focus());
  messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendCurrentMessage();
    }
  });
  newChatButton.addEventListener("click", startNewConversation);
  settingsButton.addEventListener("click", () => {
    void checkHealth();
    settingsDialog.showModal();
  });
  appearanceButton.addEventListener("click", () => {
    document.body.classList.toggle("reduced-glare");
    appearanceButton.classList.toggle("active", document.body.classList.contains("reduced-glare"));
  });
  bindInspectorContentActions();
}

function getScenario(id = currentScenarioId): ScenarioConfig {
  const requested = scenarios.find((item) => item.id === id);
  if (!requested) throw new Error(`Unknown scenario: ${id}`);
  if (requested.id === "stress") {
    const base = scenarios.find((item) => item.id === "comprehensive");
    if (!base) throw new Error("Missing comprehensive scenario");
    return { ...requested, questions: base.questions };
  }
  return requested;
}

function renderSceneList() {
  sceneList.innerHTML = "";
  const sceneIcons: Record<string, string> = {
    comprehensive: "/assets/scene-comprehensive.png",
    routing: "/assets/scene-routing.png",
    refund: "/assets/scene-refund.png",
    logistics: "/assets/scene-logistics.png",
    sentiment: "/assets/scene-sentiment.png",
    stress: "/assets/scene-stress.png",
  };

  for (const scenario of scenarios) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scene-button";
    button.dataset.scenario = scenario.id;

    const icon = document.createElement("span");
    icon.className = "scene-icon";
    const iconImage = document.createElement("img");
    iconImage.src = sceneIcons[scenario.id] ?? "/assets/scene-comprehensive.png";
    iconImage.alt = "";
    icon.append(iconImage);

    const copy = document.createElement("span");
    copy.className = "scene-copy";
    const title = document.createElement("strong");
    title.textContent = scenario.sidebarTitle;
    const subtitle = document.createElement("span");
    subtitle.textContent = scenario.subtitle;
    copy.append(title, subtitle);

    button.append(icon, copy);
    button.addEventListener("click", () => switchScenario(scenario.id));
    sceneList.append(button);
  }
}

function renderScenario(id: string) {
  currentScenarioId = id;
  const scenario = getScenario(id);
  scenarioSelect.value = id;
  scenarioHeadline.textContent = scenario.title;
  scenarioDescription.textContent = scenario.description;
  composerStatus.textContent = `当前场景：${scenario.sidebarTitle}${scenario.repeats ? ` · 连续 ${scenario.repeats} 轮` : ""} · Enter 发送，Shift + Enter 换行`;

  document.querySelectorAll<HTMLElement>(".scene-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.scenario === id);
  });

  renderSamples(scenario);
  renderQuestionMap(scenario);
  renderScenarioSummary(scenario);
  setRaw("questionMappingPreview", { questions: toQuestionMap(scenario.questions) });
}

function switchScenario(id: string) {
  if (id === currentScenarioId) {
    renderScenario(id);
    return;
  }
  persistCurrentSession();
  currentSessionId = null;
  renderScenario(id);
  resetCurrentWorkspace();
}

function renderSamples(scenario: ScenarioConfig) {
  sampleGrid.innerHTML = "";
  for (const sample of scenario.samples) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sample-button";
    const strong = document.createElement("strong");
    strong.textContent = sample.title;
    const span = document.createElement("span");
    span.textContent = sample.text;
    button.append(strong, span);
    button.addEventListener("click", () => {
      messageInput.value = sample.text;
      messageInput.focus();
    });
    sampleGrid.append(button);
  }
}

function renderQuestionMap(scenario: ScenarioConfig) {
  questionMap.innerHTML = "";
  for (const descriptor of scenario.questions) {
    const card = document.createElement("article");
    card.className = "question-card";

    const top = document.createElement("div");
    top.className = "question-card-top";
    const text = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = descriptor.label;
    const description = document.createElement("p");
    description.textContent = descriptor.question.instructions;
    text.append(title, description);

    const chip = document.createElement("span");
    chip.className = `type-chip ${descriptor.question.type}`;
    chip.textContent = capitalize(descriptor.question.type);
    top.append(text, chip);
    card.append(top);

    const criteria = document.createElement("div");
    criteria.className = "criteria-list";
    for (const label of getCriteriaLabels(descriptor.question)) {
      const pill = document.createElement("span");
      pill.className = "criteria-pill";
      pill.textContent = label;
      criteria.append(pill);
    }
    if (criteria.childElementCount) card.append(criteria);
    questionMap.append(card);
  }
}

function renderScenarioSummary(scenario: ScenarioConfig) {
  scenarioSummary.innerHTML = "";
  for (const descriptor of scenario.questions.slice(0, 3)) {
    const card = document.createElement("div");
    card.className = "summary-dimension";
    const title = document.createElement("strong");
    title.textContent = descriptor.label;
    const detail = document.createElement("span");
    detail.textContent = `${capitalize(descriptor.question.type)} · ${descriptor.description}`;
    card.append(title, detail);
    scenarioSummary.append(card);
  }
}

async function sendCurrentMessage() {
  const text = messageInput.value.trim();
  if (!text || busy) return;

  const scenario = getScenario();
  const repeats = scenario.repeats ?? 1;
  busy = true;
  assistantIntro.hidden = true;
  sendButton.disabled = true;
  messageInput.disabled = true;
  messageInput.value = "";

  const time = formatClock(new Date());
  ensureCurrentSession(text, time, scenario);
  const turn = createChatTurn(text, time, scenario);
  persistCurrentSession();
  scrollChatToBottom();

  try {
    for (let iteration = 0; iteration < repeats; iteration += 1) {
      if (repeats > 1) {
        turn.analysisMeta.textContent = `压力测试 ${iteration + 1}/${repeats}`;
      }
      await runPair(text, scenario, turn, iteration, repeats);
    }
  } finally {
    busy = false;
    sendButton.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
    updateSidebarStats();
    persistCurrentSession();
  }
}

async function runPair(text: string, scenario: ScenarioConfig, view: TurnView, iteration: number, repeats: number) {
  const runStarted = performance.now();
  latestSseCount = 0;
  resetInspectorForRun(iteration, repeats);
  setRunBadge(repeats > 1 ? `第 ${iteration + 1}/${repeats} 轮` : "执行中", "running");

  const questions = toQuestionMap(scenario.questions);
  const jevRequest = { state: text, model: jevModel.value.trim() || "jev-latest", questions };
  const responseSchema = buildResponseSchema(scenario);
  const openAIInput = buildOpenAIInput(text, scenario);
  const openAIRequest = {
    model: openaiModel.value,
    input: openAIInput,
    reasoningEffort: reasoningEffort.value,
    maxOutputTokens: Math.max(32, Number(maxOutputTokens.value) || 256),
    schemaName: `${scenario.id}_benchmark`,
    responseSchema,
  };

  setRaw("jevRequest", jevRequest);
  setRaw("questionMappingPreview", { state: text, questions });
  setRaw("openaiRequest", openAIRequest);
  updateStep("build", "done", performance.now() - runStarted, `已构建 ${scenario.questions.length} 个 Jev 问题与 OpenAI JSON Schema`);
  addExecutionLog("构建测试请求", `场景：${scenario.sidebarTitle} · ${scenario.questions.length} 个评估维度`, performance.now() - runStarted);

  setProviderStatus(view.jevStatus, "请求中", "running");
  setProviderStatus(view.openAIStatus, "流式响应中", "running");
  renderLoading(view.jevBody);
  renderLoading(view.openAIBody);
  view.comparison.hidden = true;

  const result: RunResult = {};
  const jevPromise = executeJev(jevRequest, scenario, view, result);
  const openAIPromise = executeOpenAI(openAIRequest, scenario, view, result);
  await Promise.allSettled([jevPromise, openAIPromise]);

  const compareStarted = performance.now();
  updateStep("compare", "active", undefined, "对齐两边结构化结果并计算性能差异");
  const comparisonText = renderComparison(view, scenario, result);
  updateStep("compare", "done", performance.now() - compareStarted, comparisonText);
  addExecutionLog("完成结果比对", comparisonText, performance.now() - compareStarted);
  setRunBadge("已完成", "success");
  view.title.textContent = `已完成分析 · ${scenario.sidebarTitle}`;
  if (result.jevMetrics && result.openAIMetrics) {
    view.analysisMeta.textContent = `Jev ${formatMs(result.jevMetrics.totalMs)} · OpenAI ${formatMs(result.openAIMetrics.totalMs)}`;
  } else if (result.jevMetrics || result.openAIMetrics) {
    view.analysisMeta.textContent = "部分模型已完成，详情见右侧执行观测台";
  } else {
    view.analysisMeta.textContent = "两路请求均未成功，详情见右侧执行观测台";
  }
  totalRunCount += 1;
  updatePerformance(result);
  scrollChatToBottom();
}

async function executeJev(request: Record<string, unknown>, scenario: ScenarioConfig, view: TurnView, result: RunResult) {
  updateStep("jev", "active", undefined, "调用 TypeSafe /v1/systemone");
  const startedAt = performance.now();
  let headersAt: number | null = null;
  let firstByteAt: number | null = null;

  try {
    const response = await fetch("/api/jev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    headersAt = performance.now();

    const raw = await readTextWithFirstByte(response, () => {
      firstByteAt = performance.now();
      view.jevMetricA.textContent = formatMs(firstByteAt - startedAt);
    });
    const completedAt = performance.now();
    const parsed = parseJson<JevProxyResponse>(raw, { details: raw });
    setRaw("jevResponse", parsed);

    if (!response.ok) throw new Error(parsed.error ?? `Jev HTTP ${response.status}`);

    const serverMetrics = parsed.serverMetrics ?? {};
    const metrics: JevMetrics = {
      headersMs: (headersAt ?? completedAt) - startedAt,
      firstByteMs: (firstByteAt ?? headersAt ?? completedAt) - startedAt,
      totalMs: completedAt - startedAt,
      upstreamTotalMs: serverMetrics.upstreamTotalMs,
      retryCount: serverMetrics.retryCount,
    };

    result.jevData = parsed.data;
    result.jevMetrics = metrics;
    jevTotals.push(metrics.totalMs);
    view.jevMetricA.textContent = formatMs(metrics.firstByteMs);
    view.jevMetricB.textContent = formatMs(metrics.totalMs);
    setProviderStatus(view.jevStatus, "完成", "success");
    renderJevResult(view.jevBody, scenario, parsed.data?.answers ?? {});
    updateStep("jev", "done", metrics.totalMs, `TypeSafe 返回 ${scenario.questions.length} 项结构化决策`);
    addExecutionLog("Jev 请求完成", `首字节 ${formatMs(metrics.firstByteMs)}${metrics.retryCount ? ` · 重试 ${metrics.retryCount} 次` : ""}`, metrics.totalMs);
  } catch (error) {
    const total = performance.now() - startedAt;
    setProviderStatus(view.jevStatus, "失败", "error");
    renderError(view.jevBody, error);
    updateStep("jev", "error", total, errorMessage(error));
    addExecutionLog("Jev 请求失败", errorMessage(error), total);
  }
}

async function executeOpenAI(request: Record<string, unknown>, scenario: ScenarioConfig, view: TurnView, result: RunResult) {
  updateStep("openai", "active", undefined, "通过 Responses API 接收 SSE 流");
  const startedAt = performance.now();
  let headersAt: number | null = null;
  let firstEventMs: number | null = null;
  let firstTextMs: number | null = null;
  let completedAt: number | null = null;
  let eventCount = 0;
  let streamedText = "";
  let buffer = "";

  try {
    const response = await fetch("/api/openai/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    headersAt = performance.now();
    if (!response.ok) throw new Error(await response.text());
    if (!response.body) throw new Error("OpenAI SSE response body 不可用");

    const consume = (event: SseEvent) => {
      eventCount += 1;
      latestSseCount = eventCount;
      const elapsed = performance.now() - startedAt;
      if (firstEventMs === null) firstEventMs = elapsed;
      const type = event.type ?? "unknown";
      const detail = String(event.delta ?? event.message ?? event.error?.message ?? event.response?.status ?? "");
      appendSseEvent(elapsed, type, detail);

      if (type === "response.output_text.delta" && typeof event.delta === "string") {
        if (firstTextMs === null) {
          firstTextMs = elapsed;
          view.openAIMetricA.textContent = formatMs(firstTextMs);
        }
        streamedText += event.delta;
        setRawText("openaiOutputRaw", streamedText);
      }
      if (type === "response.completed") completedAt = performance.now();
    };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        if (!block.trim()) continue;
        const event = parseSseBlock(block);
        if (event) consume(event);
      }
    }
    if (buffer.trim()) {
      const event = parseSseBlock(buffer);
      if (event) consume(event);
    }

    const totalMs = (completedAt ?? performance.now()) - startedAt;
    const parsed = parseJson<Record<string, unknown>>(streamedText, {});
    const metrics: OpenAIMetrics = {
      headersMs: (headersAt ?? performance.now()) - startedAt,
      firstEventMs,
      firstTextMs,
      totalMs,
      eventCount,
    };

    result.openAIData = parsed;
    result.openAIMetrics = metrics;
    openAITotals.push(metrics.totalMs);
    if (metrics.firstTextMs !== null) openAIFirstTexts.push(metrics.firstTextMs);
    view.openAIMetricA.textContent = formatMs(metrics.firstTextMs);
    view.openAIMetricB.textContent = formatMs(metrics.totalMs);
    setProviderStatus(view.openAIStatus, "完成", "success");
    renderOpenAIResult(view.openAIBody, scenario, parsed);
    updateStep("openai", "done", metrics.totalMs, `${eventCount} 个 SSE 事件 · 首文本 ${formatMs(metrics.firstTextMs)}`);
    addExecutionLog("OpenAI SSE 完成", `${eventCount} 个事件 · 首文本 ${formatMs(metrics.firstTextMs)}`, metrics.totalMs);
  } catch (error) {
    const total = performance.now() - startedAt;
    setProviderStatus(view.openAIStatus, "失败", "error");
    renderError(view.openAIBody, error);
    updateStep("openai", "error", total, errorMessage(error));
    addExecutionLog("OpenAI 请求失败", errorMessage(error), total);
  }
}

function createChatTurn(text: string, time: string, scenario: ScenarioConfig): TurnView {
  turnSequence += 1;
  const turn = document.createElement("article");
  turn.className = "chat-turn";

  const userRow = document.createElement("div");
  userRow.className = "user-row";
  const userWrap = document.createElement("div");
  userWrap.className = "user-bubble-wrap";
  const userTime = document.createElement("div");
  userTime.className = "message-time";
  userTime.textContent = time;
  const bubble = document.createElement("div");
  bubble.className = "user-bubble";
  bubble.textContent = text;
  userWrap.append(bubble, userTime);
  const userAvatar = document.createElement("div");
  userAvatar.className = "user-avatar";
  userAvatar.textContent = "U";
  userRow.append(userWrap, userAvatar);

  const assistantRow = document.createElement("div");
  assistantRow.className = "assistant-row";
  const avatar = document.createElement("div");
  avatar.className = "assistant-mini-avatar";
  avatar.textContent = "AI";
  const content = document.createElement("div");
  content.className = "assistant-content";
  const title = document.createElement("div");
  title.className = "analysis-title";
  const titleStrong = document.createElement("strong");
  titleStrong.textContent = `正在分析 · ${scenario.sidebarTitle}`;
  const meta = document.createElement("span");
  meta.textContent = "Jev 与 OpenAI 并行执行";
  title.append(titleStrong, meta);

  const grid = document.createElement("div");
  grid.className = "result-grid";
  const jev = createProviderCard("Jev", "System One Model", "jev");
  const openai = createProviderCard("OpenAI", openaiModel.value, "openai");
  grid.append(jev.card, openai.card);

  const comparison = document.createElement("div");
  comparison.className = "comparison-card";
  comparison.hidden = true;
  const comparisonTitle = document.createElement("strong");
  comparisonTitle.textContent = "对比结论";
  const comparisonText = document.createElement("p");
  comparison.append(comparisonTitle, comparisonText);

  const explanation = document.createElement("details");
  explanation.className = "analysis-explanation";
  const explanationSummary = document.createElement("summary");
  explanationSummary.textContent = "OpenAI 的分析解释";
  const explanationCopy = document.createElement("p");
  explanationCopy.textContent = "本基准默认比较结构化决策结果；展开此处仅用于查看说明，不会额外触发模型请求。";
  explanation.append(explanationSummary, explanationCopy);

  content.append(title, grid, comparison, explanation);
  assistantRow.append(avatar, content);
  turn.append(userRow, assistantRow);
  messageList.append(turn);

  return {
    root: turn,
    title: titleStrong,
    jevStatus: jev.status,
    openAIStatus: openai.status,
    jevMetricA: jev.metricA,
    jevMetricB: jev.metricB,
    openAIMetricA: openai.metricA,
    openAIMetricB: openai.metricB,
    jevBody: jev.body,
    openAIBody: openai.body,
    comparison,
    analysisMeta: meta,
  };
}

function createProviderCard(name: string, subtitle: string, kind: "jev" | "openai") {
  const card = document.createElement("section");
  card.className = "result-card";
  const header = document.createElement("div");
  header.className = "result-card-header";
  const title = document.createElement("div");
  title.className = "provider-title";
  const badge = document.createElement("div");
  badge.className = `provider-badge ${kind}`;
  badge.textContent = kind === "jev" ? "J" : "O";
  const titleCopy = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = name;
  const small = document.createElement("span");
  small.textContent = subtitle;
  titleCopy.append(strong, small);
  title.append(badge, titleCopy);
  const status = document.createElement("span");
  status.className = "provider-status running";
  status.textContent = "准备中";
  header.append(title, status);

  const metrics = document.createElement("div");
  metrics.className = `provider-metrics ${kind === "jev" ? "jev-metrics" : "openai-metrics"}`;
  const metricABox = document.createElement("div");
  const metricALabel = document.createElement("span");
  metricALabel.textContent = kind === "jev" ? "首字节" : "首文本";
  const metricA = document.createElement("strong");
  metricA.textContent = "—";
  metricABox.append(metricALabel, metricA);
  const metricBBox = document.createElement("div");
  const metricBLabel = document.createElement("span");
  metricBLabel.textContent = "总耗时";
  const metricB = document.createElement("strong");
  metricB.textContent = "—";
  metricBBox.append(metricBLabel, metricB);
  if (kind === "jev") {
    metricABox.hidden = true;
    const speedBadge = document.createElement("span");
    speedBadge.className = "speed-badge";
    speedBadge.textContent = "等待对比";
    metrics.append(metricBBox, speedBadge);
  } else {
    metrics.append(metricABox, metricBBox);
  }

  const body = document.createElement("div");
  body.className = "result-body";
  renderLoading(body);
  const footer = document.createElement("div");
  footer.className = "provider-footer";
  footer.textContent = "⌄  查看详情";
  card.append(header, metrics, body, footer);
  return { card, status, metricA, metricB, body };
}

function renderLoading(target: HTMLElement) {
  target.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "loading-lines";
  for (let i = 0; i < 3; i += 1) {
    const line = document.createElement("div");
    line.className = "loading-line";
    wrap.append(line);
  }
  target.append(wrap);
}

function renderError(target: HTMLElement, error: unknown) {
  target.innerHTML = "";
  const row = document.createElement("div");
  row.className = "decision-row";
  const label = document.createElement("span");
  label.textContent = "请求失败";
  const value = document.createElement("strong");
  value.className = "value-warn";
  value.textContent = errorMessage(error).slice(0, 120);
  row.append(label, value);
  target.append(row);
}

function renderJevResult(target: HTMLElement, scenario: ScenarioConfig, answers: Record<string, JevAnswer>) {
  target.innerHTML = "";
  const heading = document.createElement("strong");
  heading.className = "result-section-title";
  heading.textContent = "分析结果";
  const list = document.createElement("div");
  list.className = "decision-list";
  for (const descriptor of scenario.questions) {
    const answer = answers[descriptor.id];
    list.append(createDecisionRow(descriptor.label, formatJevAnswer(descriptor, answer), valueClass(descriptor.question.type)));
  }
  target.append(heading, list);
}

function renderOpenAIResult(target: HTMLElement, scenario: ScenarioConfig, data: Record<string, unknown>) {
  target.innerHTML = "";
  const heading = document.createElement("strong");
  heading.className = "result-section-title";
  heading.textContent = "分析结果";
  const list = document.createElement("div");
  list.className = "decision-list";
  for (const descriptor of scenario.questions) {
    list.append(createDecisionRow(descriptor.label, formatOpenAIValue(descriptor, data[descriptor.id]), valueClass(descriptor.question.type)));
  }
  target.append(heading, list);
}

function createDecisionRow(labelText: string, valueText: string, className: string) {
  const row = document.createElement("div");
  row.className = "decision-row";
  const label = document.createElement("span");
  label.textContent = labelText;
  const value = document.createElement("strong");
  value.className = className;
  value.textContent = valueText;
  row.append(label, value);
  return row;
}

function renderComparison(view: TurnView, scenario: ScenarioConfig, result: RunResult) {
  const paragraph = view.comparison.querySelector("p")!;
  const matches: string[] = [];
  const mismatches: string[] = [];

  if (result.jevData?.answers && result.openAIData) {
    for (const descriptor of scenario.questions) {
      const match = compareField(descriptor, result.jevData.answers[descriptor.id], result.openAIData[descriptor.id]);
      (match ? matches : mismatches).push(descriptor.label);
    }
  }

  const jevTotal = result.jevMetrics?.totalMs;
  const openTotal = result.openAIMetrics?.totalMs;
  let performance = "";
  if (jevTotal !== undefined && openTotal !== undefined) {
    const ratio = openTotal / Math.max(jevTotal, 1);
    performance = `本轮 OpenAI 总耗时约为 Jev 的 ${ratio.toFixed(2)}×。`;
    const speedBadge = view.root.querySelector<HTMLElement>(".speed-badge");
    if (speedBadge) {
      speedBadge.textContent = ratio >= 1 ? `快 ${ratio.toFixed(2)}×` : `慢 ${(1 / Math.max(ratio, 0.01)).toFixed(2)}×`;
      speedBadge.classList.toggle("slower", ratio < 1);
    }
  }

  const consistency = mismatches.length === 0 && matches.length > 0
    ? `核心判断 ${matches.length} 项一致。`
    : matches.length || mismatches.length
      ? `${matches.length} 项一致，${mismatches.length} 项存在差异${mismatches.length ? `（${mismatches.join("、")}）` : ""}。`
      : "至少一路模型未返回可比较结果。";

  paragraph.textContent = `${consistency}${performance ? ` ${performance}` : ""}`;
  view.comparison.hidden = false;
  return `${consistency}${performance ? ` ${performance}` : ""}`;
}

function compareField(descriptor: ScenarioQuestion, jev: JevAnswer | undefined, openAI: unknown) {
  if (!jev) return false;
  if (descriptor.question.type === "noul") {
    return typeof jev.noul === "number" && typeof openAI === "boolean" && (jev.noul >= 0.5) === openAI;
  }
  if (descriptor.question.type === "choice") {
    return typeof jev.choice === "string" && typeof openAI === "string" && jev.choice === openAI;
  }
  if (descriptor.question.type === "score") {
    return typeof jev.score === "number" && typeof openAI === "number" && Math.round(jev.score) === Math.round(openAI);
  }
  return false;
}

function formatJevAnswer(descriptor: ScenarioQuestion, answer: JevAnswer | undefined) {
  if (!answer) return "—";
  if (descriptor.question.type === "noul" && typeof answer.noul === "number") {
    return `${answer.noul >= 0.5 ? "是" : "否"} (${answer.noul.toFixed(2)})`;
  }
  if (descriptor.question.type === "choice" && typeof answer.choice === "string") {
    return `${answer.choice}${typeof answer.confidence === "number" ? ` · ${answer.confidence.toFixed(2)}` : ""}`;
  }
  if (descriptor.question.type === "score" && typeof answer.score === "number") {
    const max = Math.max(1, descriptor.question.criteria.length - 1);
    const nearest = descriptor.question.criteria[Math.min(max, Math.max(0, Math.round(answer.score)))];
    return `${answer.score.toFixed(1)} / ${max} · ${shortLabel(nearest)}`;
  }
  return "—";
}

function formatOpenAIValue(descriptor: ScenarioQuestion, value: unknown) {
  if (descriptor.question.type === "noul") return typeof value === "boolean" ? (value ? "是" : "否") : "—";
  if (descriptor.question.type === "choice") return typeof value === "string" ? value : "—";
  if (descriptor.question.type === "score" && typeof value === "number") {
    const max = Math.max(1, descriptor.question.criteria.length - 1);
    const nearest = descriptor.question.criteria[Math.min(max, Math.max(0, Math.round(value)))];
    return `${value.toFixed(1)} / ${max} · ${shortLabel(nearest)}`;
  }
  return "—";
}

function buildResponseSchema(scenario: ScenarioConfig) {
  const properties: Record<string, unknown> = {};
  for (const descriptor of scenario.questions) {
    const question = descriptor.question;
    if (question.type === "noul") properties[descriptor.id] = { type: "boolean" };
    if (question.type === "choice") properties[descriptor.id] = { type: "string", enum: Object.keys(question.criteria) };
    if (question.type === "score") properties[descriptor.id] = { type: "number", minimum: 0, maximum: question.criteria.length - 1 };
  }
  return {
    type: "object",
    properties,
    required: scenario.questions.map((item) => item.id),
    additionalProperties: false,
  };
}

function buildOpenAIInput(text: string, scenario: ScenarioConfig) {
  const lines = [
    "你是一个电商客服决策系统。你的任务不是写客服回复，而是完成固定业务判断。",
    `当前场景：${scenario.title}`,
    "请严格根据下列字段定义判断，并只输出符合 JSON Schema 的结构化结果。",
    "",
  ];
  for (const descriptor of scenario.questions) {
    const question = descriptor.question;
    lines.push(`字段 ${descriptor.id}（${descriptor.label}）：${question.instructions}`);
    if (question.type === "noul") lines.push("输出布尔值 true / false。", `true：${question.criteria?.true ?? "命题成立"}`, `false：${question.criteria?.false ?? "命题不成立"}`);
    if (question.type === "choice") lines.push(`只能从以下值选择：${Object.keys(question.criteria).join("、")}`);
    if (question.type === "score") lines.push(`输出 0 到 ${question.criteria.length - 1} 的数值。等级依次为：${question.criteria.map((item, index) => `${index}=${item}`).join("；")}`);
    lines.push("");
  }
  lines.push(`客户消息：${text}`);
  return lines.join("\n");
}

function toQuestionMap(questions: ScenarioQuestion[]) {
  return Object.fromEntries(questions.map((item) => [item.id, item.question]));
}

function resetInspectorForRun(iteration: number, repeats: number) {
  currentSteps = initialSteps();
  renderSteps();
  executionLogCount = 0;
  byId<HTMLElement>("executionTimeline").innerHTML = "";
  byId<HTMLElement>("timelineCount").textContent = "0 条";
  byId<HTMLElement>("sseList").innerHTML = "";
  byId<HTMLElement>("sseEventCount").textContent = "0 个事件";
  setRawText("jevRequest", "等待请求…");
  setRawText("jevResponse", "等待响应…");
  setRawText("openaiRequest", "等待请求…");
  setRawText("openaiOutputRaw", "等待响应…");
  if (repeats > 1) addExecutionLog("开始压力测试轮次", `第 ${iteration + 1}/${repeats} 轮`, 0);
}

function initialSteps(): StepState[] {
  return [
    { id: "build", title: "请求构建", detail: "生成 Jev Questions 与 OpenAI Schema", status: "waiting" },
    { id: "jev", title: "Jev 请求", detail: "调用 TypeSafe System One API", status: "waiting" },
    { id: "openai", title: "OpenAI SSE", detail: "调用 Responses API 并流式接收事件", status: "waiting" },
    { id: "compare", title: "结果比对", detail: "对齐决策与性能数据", status: "waiting" },
  ];
}

function updateStep(id: StepState["id"], status: StepStatus, timeMs?: number, detail?: string) {
  const step = currentSteps.find((item) => item.id === id);
  if (!step) return;
  step.status = status;
  if (timeMs !== undefined) step.timeMs = timeMs;
  if (detail) step.detail = detail;
  renderSteps();
}

function renderSteps() {
  const track = byId<HTMLElement>("stepTrack");
  track.innerHTML = "";
  currentSteps.forEach((step, index) => {
    const card = document.createElement("div");
    card.className = `step-card ${step.status}`;
    const number = document.createElement("div");
    number.className = "step-index";
    number.textContent = step.status === "done" ? "✓" : step.status === "error" ? "!" : String(index + 1);
    const copy = document.createElement("div");
    copy.className = "step-copy";
    const title = document.createElement("strong");
    title.textContent = step.title;
    const detail = document.createElement("span");
    detail.textContent = step.detail;
    copy.append(title, detail);
    const time = document.createElement("div");
    time.className = "step-time";
    time.textContent = step.timeMs === undefined ? statusLabel(step.status) : formatMs(step.timeMs);
    card.append(number, copy, time);
    track.append(card);
  });
}

function addExecutionLog(titleText: string, detailText: string, durationMs: number) {
  const log = byId<HTMLElement>("executionTimeline");
  if (log.querySelector(".empty-state")) log.innerHTML = "";
  executionLogCount += 1;
  byId<HTMLElement>("timelineCount").textContent = `${executionLogCount} 条`;

  const row = document.createElement("div");
  row.className = "log-row";
  const time = document.createElement("span");
  time.className = "log-time";
  time.textContent = formatClock(new Date(), true);
  const copy = document.createElement("div");
  copy.className = "log-copy";
  const title = document.createElement("strong");
  title.textContent = titleText;
  const detail = document.createElement("span");
  detail.textContent = detailText;
  copy.append(title, detail);
  const duration = document.createElement("span");
  duration.className = "log-duration";
  duration.textContent = formatMs(durationMs);
  row.append(time, copy, duration);
  log.append(row);
}

function appendSseEvent(elapsedMs: number, typeText: string, detailText: string) {
  const list = byId<HTMLElement>("sseList");
  if (list.querySelector(".empty-state")) list.innerHTML = "";
  byId<HTMLElement>("sseEventCount").textContent = `${latestSseCount} 个事件`;

  const row = document.createElement("div");
  row.className = "sse-row";
  const time = document.createElement("strong");
  time.textContent = `+${Math.round(elapsedMs)} ms`;
  const type = document.createElement("code");
  type.textContent = typeText;
  const detail = document.createElement("span");
  detail.textContent = detailText.replace(/\s+/g, " ").slice(0, 200) || "—";
  row.append(time, type, detail);
  list.append(row);
  while (list.children.length > 120) list.firstElementChild?.remove();
}

function updatePerformance(result: RunResult) {
  byId<HTMLElement>("perfJevTotal").textContent = formatMs(result.jevMetrics?.totalMs);
  byId<HTMLElement>("perfJevDetail").textContent = result.jevMetrics
    ? `首字节 ${formatMs(result.jevMetrics.firstByteMs)}${result.jevMetrics.upstreamTotalMs ? ` · 上游 ${formatMs(result.jevMetrics.upstreamTotalMs)}` : ""}`
    : "本轮 Jev 未完成";
  byId<HTMLElement>("perfOpenAIFirst").textContent = formatMs(result.openAIMetrics?.firstTextMs);
  byId<HTMLElement>("perfOpenAIFirstDetail").textContent = result.openAIMetrics ? `${result.openAIMetrics.eventCount} 个 SSE 事件` : "本轮 OpenAI 未完成";
  byId<HTMLElement>("perfOpenAITotal").textContent = formatMs(result.openAIMetrics?.totalMs);
  byId<HTMLElement>("perfOpenAIDetail").textContent = result.openAIMetrics ? `首事件 ${formatMs(result.openAIMetrics.firstEventMs)}` : "等待测试";

  const ratio = result.jevMetrics && result.openAIMetrics ? result.openAIMetrics.totalMs / Math.max(result.jevMetrics.totalMs, 1) : null;
  byId<HTMLElement>("perfRatio").textContent = ratio === null ? "—" : `${ratio.toFixed(2)}×`;

  const pairedRuns = Math.min(jevTotals.length, openAITotals.length);
  byId<HTMLElement>("statsRunCount").textContent = `${pairedRuns} 轮`;
  setText("jevP50", formatMs(percentile(jevTotals, 50)));
  setText("jevP95", formatMs(percentile(jevTotals, 95)));
  setText("jevMin", formatMs(minValue(jevTotals)));
  setText("jevMax", formatMs(maxValue(jevTotals)));
  setText("openaiP50", formatMs(percentile(openAITotals, 50)));
  setText("openaiP95", formatMs(percentile(openAITotals, 95)));
  setText("openaiMin", formatMs(minValue(openAITotals)));
  setText("openaiMax", formatMs(maxValue(openAITotals)));
}

function updateSidebarStats() {
  byId<HTMLElement>("totalRuns").textContent = `${totalRunCount} 次`;
  const all = [...jevTotals, ...openAITotals];
  byId<HTMLElement>("averageLatency").textContent = all.length ? formatMs(all.reduce((a, b) => a + b, 0) / all.length) : "—";
}

function loadSessions(): ConversationSession[] {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ConversationSession => Boolean(item && typeof item.id === "string" && typeof item.scenarioId === "string"))
      .slice(0, MAX_SESSIONS);
  } catch {
    return [];
  }
}

function saveSessions() {
  sessions = sessions
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS);
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    sessions = sessions.slice(0, Math.min(12, sessions.length));
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      // Keep the in-memory session list usable even when storage is unavailable or full.
    }
  }
}

function renderConversationHistory() {
  conversationHistory.innerHTML = "";
  if (!sessions.length) {
    conversationHistory.innerHTML = '<div class="history-empty">完成一次测试后，会话会保存在这里。</div>';
    return;
  }

  for (const session of [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.classList.toggle("active", session.id === currentSessionId);
    button.dataset.sessionId = session.id;

    const icon = document.createElement("img");
    icon.className = "history-icon";
    icon.src = "/assets/history.png";
    icon.alt = "";
    const title = document.createElement("strong");
    title.textContent = session.title;
    const time = document.createElement("span");
    time.className = "history-time";
    time.textContent = session.displayTime;
    button.append(icon, title, time);
    button.addEventListener("click", () => restoreSession(session.id));
    conversationHistory.append(button);
  }
}

function ensureCurrentSession(firstMessage: string, time: string, scenario: ScenarioConfig) {
  if (currentSessionId) return;
  const now = Date.now();
  const session: ConversationSession = {
    id: `session-${now}-${Math.random().toString(36).slice(2, 8)}`,
    scenarioId: scenario.id,
    title: firstMessage.replace(/\s+/g, " ").trim().slice(0, 36) || "未命名会话",
    createdAt: now,
    updatedAt: now,
    displayTime: time,
    messageListHtml: "",
    totalRunCount: 0,
    jevTotals: [],
    openAITotals: [],
    openAIFirstTexts: [],
    inspectorHtml: "",
    activeTab: "steps",
  };
  currentSessionId = session.id;
  sessions.unshift(session);
  saveSessions();
  renderConversationHistory();
}

function persistCurrentSession() {
  if (!currentSessionId) return;
  const session = sessions.find((item) => item.id === currentSessionId);
  if (!session) return;
  session.scenarioId = currentScenarioId;
  session.messageListHtml = messageList.innerHTML;
  session.totalRunCount = totalRunCount;
  session.jevTotals = [...jevTotals];
  session.openAITotals = [...openAITotals];
  session.openAIFirstTexts = [...openAIFirstTexts];
  session.inspectorHtml = inspectorScroll.innerHTML;
  session.activeTab = getActiveTab();
  session.updatedAt = Date.now();
  saveSessions();
  renderConversationHistory();
}

function restoreSession(sessionId: string) {
  if (busy || sessionId === currentSessionId) return;
  persistCurrentSession();
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;

  currentSessionId = session.id;
  renderScenario(session.scenarioId);
  messageList.innerHTML = session.messageListHtml;
  assistantIntro.hidden = Boolean(session.messageListHtml.trim());
  totalRunCount = session.totalRunCount || 0;
  jevTotals = [...(session.jevTotals || [])];
  openAITotals = [...(session.openAITotals || [])];
  openAIFirstTexts = [...(session.openAIFirstTexts || [])];
  updateSidebarStats();
  if (session.inspectorHtml?.trim()) {
    inspectorScroll.innerHTML = session.inspectorHtml;
    bindInspectorContentActions();
    activateTab(session.activeTab || "steps");
  } else {
    updatePerformance({});
    resetInspectorForRun(0, 1);
    setRunBadge("历史会话", "neutral");
  }
  renderConversationHistory();
  scrollChatToBottom();
}

function startNewConversation() {
  if (busy) return;
  persistCurrentSession();
  currentSessionId = null;
  resetCurrentWorkspace();
  renderConversationHistory();
  messageInput.focus();
}

function resetCurrentWorkspace() {
  messageList.innerHTML = "";
  assistantIntro.hidden = false;
  totalRunCount = 0;
  jevTotals = [];
  openAITotals = [];
  openAIFirstTexts = [];
  turnSequence = 0;
  updateSidebarStats();
  updatePerformance({});
  resetInspectorForRun(0, 1);
  setRunBadge("等待输入", "");
  messageInput.value = "";
  messageInput.disabled = false;
  sendButton.disabled = false;
}

function bindTabs() {
  document.querySelectorAll<HTMLButtonElement>(".tab-button").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab ?? "steps"));
  });
}

function activateTab(tab: string) {
  document.querySelectorAll<HTMLElement>(".tab-button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  document.querySelectorAll<HTMLElement>(".tab-pane").forEach((pane) => pane.classList.toggle("active", pane.dataset.pane === tab));
}

function getActiveTab() {
  return document.querySelector<HTMLButtonElement>(".tab-button.active")?.dataset.tab || "steps";
}

function bindInspectorContentActions() {
  const jump = document.querySelector<HTMLButtonElement>("#jumpToMapping");
  if (jump) jump.onclick = () => activateTab("mapping");
  bindCopyButtons();
}

function bindCopyButtons() {
  document.querySelectorAll<HTMLButtonElement>(".copy-button").forEach((button) => {
    button.onclick = async () => {
      const id = button.dataset.copy;
      if (!id) return;
      const text = byId<HTMLElement>(id).textContent ?? "";
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "已复制";
        setTimeout(() => { button.textContent = "复制"; }, 1200);
      } catch {
        button.textContent = "复制失败";
      }
    };
  });
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const data = await response.json() as {
      providers?: { jev?: boolean; openai?: boolean };
      environment?: { loadedFiles?: string[]; projectRootDetected?: boolean; cwdMatchesProjectRoot?: boolean };
    };
    const jevReady = Boolean(data.providers?.jev);
    const openAIReady = Boolean(data.providers?.openai);
    const both = jevReady && openAIReady;
    const loadedFiles = data.environment?.loadedFiles ?? [];

    if (both) {
      apiChipText.textContent = "真实 API";
      apiStatus.textContent = `Jev 已配置 · OpenAI 已配置${loadedFiles.length ? ` · 已读取 ${loadedFiles.join(" / ")}` : " · 使用系统环境变量"}`;
    } else {
      const missing = [!jevReady ? "TYPESAFE_API_KEY" : "", !openAIReady ? "OPENAI_API_KEY" : ""].filter(Boolean).join("、");
      apiChipText.textContent = "API 配置异常";
      apiStatus.textContent = loadedFiles.length
        ? `已读取 ${loadedFiles.join(" / ")}，但未检测到：${missing}`
        : `未读取到 .env / .env.local；缺少：${missing}`;
    }

    const chip = document.querySelector(".api-chip");
    chip?.classList.toggle("ready", both);
    chip?.classList.toggle("warning", !both);
  } catch {
    apiChipText.textContent = "后端未连接";
    apiStatus.textContent = "无法连接 Node.js 后端";
    document.querySelector(".api-chip")?.classList.add("warning");
  }
}

async function readTextWithFirstByte(response: Response, onFirstByte: () => void) {
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = "";
  let first = true;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (first) {
      first = false;
      onFirstByte();
    }
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

function parseSseBlock(block: string): SseEvent | null {
  const dataLines = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart());
  if (!dataLines.length) return null;
  const data = dataLines.join("\n");
  if (data === "[DONE]") return { type: "done" };
  return parseJson<SseEvent>(data, { type: "raw", message: data });
}

function getCriteriaLabels(question: JevQuestion) {
  if (question.type === "noul") return [question.criteria?.true ? `True：${shortLabel(question.criteria.true)}` : "True", question.criteria?.false ? `False：${shortLabel(question.criteria.false)}` : "False"];
  if (question.type === "choice") return Object.keys(question.criteria);
  return question.criteria.map((item, index) => `${index} · ${shortLabel(item)}`);
}

function valueClass(type: JevQuestion["type"]) {
  if (type === "noul") return "value-good";
  if (type === "choice") return "value-blue";
  return "value-warn";
}

function setProviderStatus(target: HTMLElement, text: string, state: "running" | "success" | "error") {
  target.textContent = text;
  target.className = `provider-status ${state}`;
}

function setRunBadge(text: string, state: string) {
  const badge = byId<HTMLElement>("runStateBadge");
  badge.textContent = text;
  badge.className = `run-badge${state ? ` ${state}` : ""}`;
}

function setRaw(id: string, value: unknown) {
  setRawText(id, JSON.stringify(value, null, 2));
}

function setRawText(id: string, text: string) {
  byId<HTMLElement>(id).textContent = text;
}

function setText(id: string, text: string) {
  byId<HTMLElement>(id).textContent = text;
}

function percentile(values: number[], percent: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percent / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function minValue(values: number[]) {
  return values.length ? Math.min(...values) : null;
}

function maxValue(values: number[]) {
  return values.length ? Math.max(...values) : null;
}

function formatMs(value: number | null | undefined) {
  return value == null ? "—" : `${Math.round(value)} ms`;
}

function formatClock(date: Date, includeSeconds = false) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", ...(includeSeconds ? { second: "2-digit" } : {}), hour12: false }).format(date);
}

function statusLabel(status: StepStatus) {
  return ({ waiting: "等待", active: "进行中", done: "完成", error: "失败" } as const)[status];
}

function shortLabel(text: string | undefined) {
  if (!text) return "—";
  return text.length > 14 ? `${text.slice(0, 14)}…` : text;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    chatScroll.scrollTop = chatScroll.scrollHeight;
  });
}

function byId<T extends HTMLElement>(id: string) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as T;
}
