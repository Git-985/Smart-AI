import { z } from "zod";
import type { PolicyEvidence } from "@/lib/rag/types";
import { requestDeepSeekJson, deepseekConfigured } from "@/lib/ai/deepseek";
import { searchWeb, type WebSearchOutcome } from "@/lib/ai/web-search";
import { regionMatches } from "@/lib/rag/retriever";

/**
 * 解答生成：把右侧“依据与材料”面板里的政策证据当作本地知识库，
 * 交给 DeepSeek 组织成“先问清楚 → 再给全流程”的办事指引；
 * 联网结果只作为可核对线索，与本地证据区分呈现。
 */

export type GuidanceQuestion = {
  question: string;
  why: string;
  examples: string[];
  options: string[];
};

export type GuidanceStep = {
  title: string;
  detail: string;
  where: string;
  materials: string[];
  note: string;
};

export type GuidanceReply = {
  id: string;
  kind: "question" | "other";
  question: string;
  answer: string;
  citations: string[];
  createdAt: string;
};

export type Guidance = {
  understanding: string;
  questions: GuidanceQuestion[];
  steps: GuidanceStep[];
  materials: string[];
  riskNotes: string[];
  citations: string[];
  replies: GuidanceReply[];
  localCoverage: boolean;
  answered: boolean;
  generatedBy: "deepseek" | "rules";
  web: WebSearchOutcome;
  updatedAt: string;
};

export type GuidanceAnswer = { question: string; answer: string };

export type GuidanceInput = {
  message: string;
  serviceType: string;
  region?: string;
  year?: string;
  evidence: PolicyEvidence[];
  aiSummary?: string;
  answered?: GuidanceAnswer[];
};

const SERVICE_LABEL: Record<string, string> = {
  medical_insurance: "城乡居民基本医疗保险参保缴费",
  student_aid: "高校学生资助申请",
  elderly_disability_service: "老年与残障人士公共服务办理",
  unknown: "待确认的公共服务事项",
};

const clip = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);

const guidanceModelSchema = z.object({
  understanding: z.string().default(""),
  questions: z.array(z.object({
    question: z.string().default(""),
    why: z.string().default(""),
    examples: z.array(z.string()).default([]),
    options: z.array(z.string()).default([]),
  })).default([]),
  steps: z.array(z.object({
    title: z.string().default(""),
    detail: z.string().default(""),
    where: z.string().default(""),
    materials: z.array(z.string()).default([]),
    note: z.string().default(""),
  })).default([]),
  materials: z.array(z.string()).default([]),
  riskNotes: z.array(z.string()).default([]),
  citationTitles: z.array(z.string()).default([]),
});

const SYSTEM_PROMPT = `你是“Smart AI（明白办）”的政务办理引导员。服务对象多是老年人、残障人士和很少上网的人，你要把一件事讲到他“照着做就能办成”。

硬性规则：
1. 政策事实只能来自【本地知识库】里的条目，引用时写出条目标题；不得编造政策名称、金额、截止日期、电话、窗口地址或链接。
2. 【联网结果】只能作为“可核对的公开线索”，不得直接当作确定结论；与本地条目冲突时以本地条目为准，并提醒用户以官方原文为准。
3. 本地知识库没给出的地方数字（缴费标准、报销比例、办理时限、补贴金额），一律写成“需以当地公告为准”，绝对不要猜。
4. 不得把用户的猜测、网上传言或你的常识当成政策事实；知识库没写的，就说“知识库里没有，需要向当地确认”。
5. 涉及资格认定、缴费、报销、权益、正式提交时，必须提示“需要人工确认”，并说明系统不代替任何政府窗口。
6. 语言：短句、大白话，一件事一句话；必须出现的术语要用一句话解释（例如“统筹地区，就是给你办医保的那个市或县”）；不要用“赋能、闭环、抓手”这类词；不要用表情符号。
7. 先问清楚再给路径：第一轮输出 3 到 6 个澄清问题；如果用户已经回答过一轮，最多再问 2 个，信息足够时直接返回空数组。问题要围绕“到底办哪件事、给谁办、在哪办、什么时候办、有没有特殊身份”，每个问题说明为什么问，并给出 2 到 5 个可直接点击的短选项（每个不超过 12 个字；不要写“其他”，界面会自动补）。问题必须用第二人称直接问用户（“您……”），不要用“老人/他/家属”这类第三人称描述用户，也不要替用户陈述（反例：老人行动不便，怎么办理更方便？）。
8. 再给全流程：5 到 8 步，按真实办理顺序排列；每一步写清做什么、去哪里办、带什么、大概多久、办不成怎么办；where 必须写具体可去的地点（如“街道便民服务中心”“医保经办窗口”，可带官网/App 名称），不需要出门的就写“在家整理”或“手机上办理”，不要留空或写“—”.步骤必须结合用户已确认的回答给出具体做法：选了自己去办就写窗口办理，选了代办就补代办材料和委托要求，人户分离就加异地备案，属于低保/特困/脱贫人口就先确认参保资助，已完成困难认定就跳过认定环节；不要输出与回答无关的通用模板。
9. 只输出 JSON，不要 Markdown 代码块，不要任何解释文字。

JSON 字段：
{
  "understanding": "用两三句话复述用户要办的事，并点明关键不确定点",
  "questions": [{ "question": "要问的问题", "why": "为什么问、会影响什么", "examples": ["回答示例"], "options": ["短选项1", "短选项2"] }],
  "steps": [{ "title": "第1步：……", "detail": "具体怎么做", "where": "去哪办/找谁办", "materials": ["这一步要带的材料"], "note": "容易卡住的地方或注意事项" }],
  "materials": ["去之前要准备的全部材料，去重后列出"],
  "riskNotes": ["时效、地区差异、资格、费用等风险提醒"],
  "citationTitles": ["本次用到的本地知识库条目标题，必须与给定标题完全一致"]
}`;

function buildUserPrompt(input: GuidanceInput, web: WebSearchOutcome): string {
  const evidenceLines = input.evidence.length
    ? input.evidence.map((item, index) => [
      `[${index + 1}] 标题：${item.title}`,
      `地区：${item.region ?? "全国"}｜事项：${SERVICE_LABEL[item.serviceType] ?? item.serviceType}`,
      `适用范围：${item.applicabilityReason}`,
      `条款摘要：${item.quote}`,
    ].join("｜"))
    : ["（本地知识库没有命中条目，请只输出澄清问题，steps 留空，并说明需要补充地区或事项。）"];

  const webLines = web.used
    ? web.results.map((item, index) => `[${index + 1}] ${item.title}｜${item.snippet}｜${item.url}`)
    : ["本次未启用联网核验，请只依据本地知识库作答。"];

  const answeredLines = input.answered?.length
    ? input.answered.map((item) => `问：${item.question}｜答：${item.answer}`)
    : [];

  return [
    "【用户情况】",
    `原话：${input.message}`,
    `事项类型：${SERVICE_LABEL[input.serviceType] ?? input.serviceType}`,
    `办理地区：${input.region?.trim() || "未提供"}`,
    `办理年份：${input.year?.trim() || "未提供"}`,
    input.aiSummary ? `已掌握的诉求概括：${input.aiSummary}` : "",
    "",
    answeredLines.length ? "【用户已确认的回答（不要再问同样的问题）】" : "",
    ...answeredLines,
    "",
    "【本地知识库（唯一政策依据）】",
    evidenceLines.join("\n"),
    "",
    "【联网结果（仅作线索，不得当作结论）】",
    webLines.join("\n"),
    "",
    answeredLines.length
      ? "请输出 JSON。用户已回答过一轮：questions 最多 2 个，信息足够时返回空数组；步骤要具体到“带什么、去哪里”；不要出现本地知识库之外的数字或链接。"
      : "请输出 JSON。要求：澄清问题优先于结论；步骤要具体到“带什么、去哪里”；不要出现本地知识库之外的数字或链接。",
  ].filter(Boolean).join("\n");
}

type OfflineProfile = {
  questions: GuidanceQuestion[];
  steps: Array<[string, string, string, string[], string]>;
  materials: string[];
  risks: string[];
};

function offlineProfile(serviceType: string, region?: string): OfflineProfile {
  const place = region?.trim() || "您户口所在地";
  if (serviceType === "student_aid") {
    return {
      questions: [
        { question: "是您本人申请，还是帮孩子申请？", why: "申请人不同，需要的证件和签字人不一样。", examples: ["帮孩子办，今年刚考上大专。"], options: ["帮孩子申请", "本人申请", "帮其他亲属申请"] },
        { question: "申请人读的是哪个学段？", why: "不同学段的资助项目和申请入口完全不同。", examples: ["大专一年级。"], options: ["高中/中职", "大专/本科", "研究生", "还不确定"] },
        { question: "学校在省内还是省外？", why: "生源地贷款在户籍地办，入学后的资助在学校办，先分清在哪头办。", examples: ["省外的学校。"], options: ["省内学校", "省外学校", "还没确定"] },
        { question: "家里是否已经做过家庭经济困难认定？", why: "困难认定是多数助学金的门槛，没有认定通常要先补这一步。", examples: ["还没做过，不知道去哪儿认定。"], options: ["已经认定过", "还没做过", "不清楚有没有"] },
        { question: "今年是第一次申请，还是往年申请过想续期？", why: "续期一般只需复核材料，新申请要重新走完整流程。", examples: ["第一次申请。"], options: ["第一次申请", "往年申请过，想续期"] },
      ],
      steps: [
        ["第1步：确定要申请哪一类资助", "先分清是助学贷款、国家助学金、临时困难补助还是学费减免。", "学校学生资助管理中心或县级学生资助管理单位", [], "一项一项办，不要同时投多个重复项目。"],
        ["第2步：完成家庭经济困难认定", "向学校提交认定申请，由学校按程序评议。", "就读学校（班主任或资助中心）", ["身份证", "户口簿", "家庭收入或困难情况说明"], "认定结果通常作为后续助学金的依据。"],
        ["第3步：按学校要求线上或线下提交申请", "登录学校资助系统或全国学生资助管理信息系统，按提示填报。", "学校统一通知的入口", ["录取通知书/学生证", "本人银行卡", "认定结果"], "银行卡要本人名下，开户行信息要填全。"],
        ["第4步：等待学校审核与公示", "跟进班级和学校的公示名单，有异议及时反馈。", "班级群、学校资助中心", [], "公示期一般会给反馈窗口，别错过。"],
        ["第5步：确认资金到账并留存凭证", "助学金通常打到本人银行卡，到账后核对金额与发放学期。", "银行 App 或银行柜台", [], "没到账先问学校资助中心，不要私下转账给任何人。"],
      ],
      materials: ["身份证", "户口簿", "录取通知书或学生证", "本人银行卡", "家庭经济困难相关证明"],
      risks: ["资助项目和金额按学校与当地政策执行，需以学校通知为准。", "任何要求先交手续费、保证金的“助学金”都是诈骗。"],
    };
  }

  if (serviceType === "elderly_disability_service") {
    return {
      questions: [
        { question: "这次想办的是哪一项？", why: "这四项分属不同部门，材料和窗口都不一样。", examples: ["想申请护理补贴。"], options: ["残疾人证", "护理补贴", "高龄津贴", "居家适老化改造", "还不确定"] },
        { question: "申请人有没有残疾人证？等级是多少？", why: "多数护理补贴以残疾等级为门槛，没有证要先评残。", examples: ["有证，二级肢体残疾。"], options: ["有一级/二级证", "有三级/四级证", "没有残疾证", "不清楚等级"] },
        { question: "户口在哪里，实际住在哪里？", why: "补贴一般按户籍地申请，人户分离时要问清能否跨区办理。", examples: ["户口在县里，现跟子女住市区。"], options: ["户口和居住地一致", "户口在老家，人在子女家", "不清楚"] },
        { question: "您打算怎么去办？", why: "多数地区支持代办和上门，提前问清可以少跑一趟。", examples: ["下不了楼，希望有人上门。"], options: ["家人代办", "需要上门服务", "本人能去"] },
      ],
      steps: [
        ["第1步：确认要办的具体项目", "把需求对到一个具体事项上，不同事项不能混在一起申请。", "社区（村）便民服务站或街道残联", [], "先打电话问清本区由哪个部门受理。"],
        ["第2步：核对本地受理条件和材料清单", "以当地残联、民政部门公布的口径为准，别按网上的旧清单准备。", "当地残联/民政窗口、12345", [], "各地材料清单差异较大。"],
        ["第3步：备齐材料并复印", "证件类带原件和复印件，照片按要求准备。", "在家整理；需要复印、拍照可到社区服务站或便民服务中心", ["身份证", "户口簿", "残疾人证", "本人银行卡", "代办人身份证与委托说明"], "银行卡用来打补贴，必须本人名下。"],
        ["第4步：提交申请", "窗口提交或由社区代为转报；行动不便可申请上门。", "街道（乡镇）便民服务中心、残联窗口", [], "提交后索要受理回执或拍照留存。"],
        ["第5步：跟进评残/审核与公示", "需要评残的按通知到指定医院评定。", "指定评定机构", [], "错过评定时间要重新排队。"],
        ["第6步：确认补贴发放", "按月或按季到账，核对金额和发放起始月份。", "银行流水、当地政务 App", [], "金额与起始时间以当地公布标准为准。"],
      ],
      materials: ["身份证", "户口簿", "残疾人证", "本人银行卡", "近期照片", "代办人身份证及委托说明"],
      risks: ["补贴标准、护理等级认定由各地自定，需以当地公告为准。", "涉及资格和补贴金额，办理结果必须经人工确认。"],
    };
  }

  if (serviceType === "medical_insurance") {
    return {
      questions: [
        { question: "这次是给谁办？", why: "参保人身份不同，缴费标准和资助政策不一样。", examples: ["给父亲办，他 68 岁。"], options: ["给父亲本人办", "给母亲办", "给配偶办", "给孩子办", "给其他家人办"] },
        { question: "参保人现在是哪种医保？", why: "职工医保和居民医保不能重复参保，先确认能避免白交钱。", examples: ["一直是居民医保，往年村里统一收。"], options: ["居民医保", "职工医保", "两种都参过", "不清楚"] },
        { question: "户口和常住地一致吗？", why: "居民医保按统筹地区政策执行，常住外地还要考虑异地就医备案。", examples: ["户口在河南周口，人在郑州住。"], options: ["户口和常住地一致", "户口在老家，人在外地", "不确定，需要协助判断"] },
        { question: "今年要办哪一类？", why: "新参保、续保、补缴的入口和待遇生效规则不同。", examples: ["续缴今年的。"], options: ["新参保", "续缴今年", "补缴断缴年份", "还不确定"] },
        { question: "家里属于这些身份吗？", why: "低保、特困等身份可能享受参保资助，能少缴或免缴。", examples: ["不是，普通家庭。"], options: ["普通家庭", "低保", "特困", "脱贫人口/监测对象", "不清楚"] },
        { question: "您打算怎么去办？", why: "很多地区支持家人代办和上门帮办，提前问清可以少跑路。", examples: ["人在外地，让哥哥代办。"], options: ["本人亲自办理", "托家人代办", "需要上门服务", "还没想好"] },
      ],
      steps: [
        ["第1步：确认本地今年的集中缴费期和标准", `缴费金额、截止日期每年由${place}的医保部门公布，先查当年公告，不要按往年数字准备。`, "当地医保局官网/公众号、12393 医保服务热线、社区公告栏", [], "错过集中缴费期，可能要等下一轮或按补缴规则处理。"],
        ["第2步：查清当前的参保状态", "确认是居民医保还是职工医保、有没有断缴，避免重复参保。", "国家医保服务平台 App、当地政务 App、医保窗口", ["身份证号、社保卡"], "断缴后重新参保可能有待遇等待期。"],
        ["第3步：备齐材料", "证件类带原件，代办要带代办人身份证和关系说明。", "在家整理；需要复印、打印可到社区便民服务中心或村（社区）服务站", ["本人身份证", "户口簿（户籍地办理）或居住证（常住地办理）", "社保卡或医保电子凭证", "代办人身份证"], "行动不便的，可先电话问能否上门或视频核验。"],
        ["第4步：选择办理渠道并缴费", "线上：国家医保服务平台 App、当地政务 App、微信/支付宝“城市服务”里的社保缴费；线下：街道（乡镇）便民服务中心、医保经办窗口、村（社区）代收点。", "线上自助 或 就近便民服务中心", [], "只走官方入口，不要点陌生人发的缴费链接。"],
        ["第5步：留存缴费凭证", "缴费成功后截图或保存电子回单，核对姓名、身份证号、所属年度。", "手机上保存电子回单；需要打印可到医保窗口或便民服务中心", [], "姓名或年度错了要尽快到窗口更正。"],
        ["第6步：确认待遇生效时间", "问清从哪一天开始享受待遇，有没有等待期。", "医保窗口、12393", [], "各地规则不同，以当地答复为准。"],
        ["第7步：需要去外地看病时补办备案", "长期在外地居住或要转诊的，先做异地就医备案，再持医保电子凭证或社保卡直接结算。", "国家医保服务平台 App“异地备案”入口", ["居住证或居住证明（长期居住类）"], "备案类型和报销比例按参保地政策执行。"],
      ],
      materials: ["本人身份证", "户口簿或居住证", "社保卡/医保电子凭证", "代办人身份证", "困难身份证明（如适用）"],
      risks: ["缴费标准、集中征缴期、待遇等待期由各统筹地区公布，需以当地公告为准。", "涉及缴费和待遇资格，本指引不构成官方结论，办理前请向当地医保部门核对。"],
    };
  }

  return {
    questions: [
      { question: "您具体想办哪一件事？", why: "不同事项对应不同部门和材料，先定事项才能给准确路径。", examples: ["想办居民医保缴费。"], options: ["办证", "缴费", "申请补贴", "查询进度"] },
      { question: "是给本人办，还是帮家人办？", why: "代办通常需要额外材料。", examples: ["帮父亲办。"], options: ["本人办理", "帮父母办", "帮子女办", "帮其他家人办"] },
      { question: "在哪个范围办理？", why: "公共服务大多按属地执行。", examples: ["河北省保定市。"], options: ["在户口所在地", "在常住地", "还不确定"] },
    ],
    steps: [
      ["第1步：把事项说具体", "用一句话说清“给谁、办什么、在哪办”。", "先在家想清楚；需要当面咨询可打 12345 或到社区便民服务中心", [], "说不清时，先打 12345 问该找哪个部门。"],
      ["第2步：确认受理部门和材料", "以当地公布的办事指南为准。", "当地政务服务网、12345", [], "不要按旧攻略准备材料。"],
    ],
    materials: ["身份证", "户口簿"],
    risks: ["事项未确认前不提供确定性结论。"],
  };
}

function bigrams(text: string): string[] {
  const compact = text.replace(/[\s，。、；：（）()“”"',.?!！？]/gu, "");
  const grams: string[] = [];
  for (let index = 0; index < compact.length - 1; index += 1) grams.push(compact.slice(index, index + 2));
  return grams;
}

/** 规则兜底时按标题/条目的二字重合度挑引用，避免把“新生儿参保”这类不相关条目挂到老人医保上。 */
function pickCitations(input: GuidanceInput): string[] {
  const messageGrams = new Set(bigrams(input.message));
  const scored = input.evidence
    .map((item) => {
      const titleGrams = bigrams(`${item.title}${item.section ?? ""}`);
      const score = titleGrams.filter((gram) => messageGrams.has(gram)).length;
      return { title: item.title, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const picked = scored.length ? scored : input.evidence.map((item) => ({ title: item.title, score: 0 }));
  return picked.slice(0, 3).map((item) => item.title);
}

function coverageNote(input: GuidanceInput): string | null {
  const region = input.region?.trim();
  if (!region) return null;
  if (input.evidence.some((item) => regionMatches(item.region, region))) return null;
  return `本地知识库暂未收录${region}的专门条目，下面按全国政策整理，地方标准和办理窗口请向当地经办机构核对。`;
}

function withCoverage(input: GuidanceInput, risks: string[]): string[] {
  const note = coverageNote(input);
  if (!note) return risks.slice(0, 6);
  return [note, ...risks.filter((item) => !item.includes("暂未收录"))].slice(0, 6);
}


function normalizeWhere(value: string): string {
  const text = (value ?? "").trim();
  if (!text || text === "—" || text === "-" || text === "无" || text === "不适用") {
    return "就近的政务服务中心或社区服务站（或线上办理）";
  }
  return text;
}

function stripStepNumber(title: string): string {
  return title.replace(/^第\s*[0-9一二三四五六七八九十]+\s*步\s*[:：、.．]?\s*/, "");
}

/**
 * 规则兜底时也要“按用户选的东西出方案”：
 * 根据已回答的内容插入、替换、补充步骤和材料，而不是永远给同一套模板。
 */
function personalizeSteps(
  input: GuidanceInput,
  steps: GuidanceStep[],
  materials: string[],
  risks: string[],
): { steps: GuidanceStep[]; materials: string[]; risks: string[] } {
  const answers = (input.answered ?? []).map((item) => item.answer).join(" ");
  const base = steps.map((step) => ({ ...step, title: stripStepNumber(step.title) }));
  const nextMaterials = [...materials];
  const nextRisks = [...risks];
  if (!answers.trim()) return { steps: renumber(base), materials: nextMaterials, risks: nextRisks };

  const has = (pattern: RegExp) => pattern.test(answers);
  const addMaterial = (value: string) => {
    if (!nextMaterials.some((item) => item.includes(value.slice(0, 4)))) nextMaterials.push(value);
  };
  const insertAfter = (pattern: RegExp, step: GuidanceStep) => {
    const index = base.findIndex((item) => pattern.test(item.title));
    base.splice(index >= 0 ? index + 1 : base.length, 0, step);
  };
  const insertBefore = (pattern: RegExp, step: GuidanceStep) => {
    const index = base.findIndex((item) => pattern.test(item.title));
    base.splice(index >= 0 ? index : 0, 0, step);
  };
  const findStep = (pattern: RegExp) => base.find((item) => pattern.test(item.title));

  if (input.serviceType === "medical_insurance") {
    if (has(/代办|上门/)) {
      addMaterial("代办人身份证与关系说明");
      const step = findStep(/备齐材料/);
      if (step) step.note = "家人代办要带代办人身份证；部分窗口要求书面委托，出发前先电话确认。";
    }
    if (has(/户口在老家|人在外地/)) {
      if (!base.some((item) => item.title.includes("异地就医备案"))) {
        insertAfter(/查清当前的参保状态/, {
          title: "人不在户籍地，先做异地就医备案",
          detail: "长期在常住地居住的，先在参保地办理异地就医备案，之后在常住地联网医院可直接结算。",
          where: "国家医保服务平台 App、参保地医保窗口",
          materials: ["居住证或居住证明"],
          note: "备案类型按参保地规定选择，报销比例仍按参保地政策。",
        });
      }
      addMaterial("居住证或居住证明（常住地办理或备案用）");
    }
    if (has(/低保|特困|脱贫/)) {
      insertAfter(/集中缴费期/, {
        title: "确认能否享受参保资助",
        detail: "低保、特困、脱贫人口等身份可能由医疗救助资助参保，先确认身份是否在册，再决定交多少。",
        where: "乡镇（街道）民政窗口、医保局",
        materials: ["低保证或特困证明（如适用）"],
        note: "资助资格和标准由当地认定，不要先自行垫付再补申请。",
      });
      addMaterial("低保证或特困证明（如适用）");
    }
    if (has(/职工医保/)) nextRisks.push("已参加职工医保的不能再参加居民医保，重复参保不会重复报销。");
    if (has(/补缴/)) nextRisks.push("补缴年份的待遇生效时间和等待期按当地规定执行，可能不如连续参保。");
    if (has(/新参保/)) nextRisks.push("新参保通常有待遇等待期，具体天数以当地公告为准。");
  }

  if (input.serviceType === "student_aid") {
    if (has(/已经认定过/)) {
      const step = findStep(/困难认定/);
      if (step) {
        step.title = "调出已有的家庭经济困难认定结果";
        step.detail = "已完成认定，直接准备认定结果复印件；学校要求更新的，再补最新材料即可。";
        step.materials = ["家庭经济困难认定结果"];
      }
    }
    if (has(/还没做过/)) nextRisks.push("没有家庭经济困难认定通常不能直接申请助学金，先完成认定再提交申请。");
    if (has(/省外学校/)) nextRisks.push("省外就读的，生源地贷款在户籍地办、校内资助在学校办，别把两边材料混在一起。");
    if (has(/续期/)) {
      const step = findStep(/提交申请/);
      if (step) step.note = "续期一般只需复核材料，按学校通知更新信息即可。";
    }
  }

  if (input.serviceType === "elderly_disability_service") {
    if (has(/没有残疾证|不清楚等级/)) {
      insertBefore(/核对本地受理条件/, {
        title: "先申请残疾人证或确认残疾等级",
        detail: "没有残疾人证或等级不清的，先到户籍地残联申请评残，拿到证后再申请护理补贴。",
        where: "户籍地残联、指定评定医院",
        materials: ["身份证", "户口簿", "近期照片"],
        note: "评残要到指定医院评定，错过时间要重新排队。",
      });
    }
    if (has(/需要上门/)) {
      const step = findStep(/提交申请/);
      if (step) step.note = "行动不便可申请上门或由社区代报，提交前先电话确认是否支持。";
    }
    if (has(/户口在老家|人在子女家/)) nextRisks.push("人户分离的，补贴一般仍在户籍地申请，能否跨区办理要问当地窗口。");
  }

  return { steps: renumber(base), materials: nextMaterials, risks: nextRisks };
}

function renumber(steps: GuidanceStep[]): GuidanceStep[] {
  // 序号由界面上的圆形标签渲染，标题里不再重复“第 N 步：”
  return steps.map((step) => ({ ...step, title: stripStepNumber(step.title) }));
}

export function offlineGuidance(input: GuidanceInput): Guidance {
  const profile = offlineProfile(input.serviceType, input.region);
  const label = SERVICE_LABEL[input.serviceType] ?? SERVICE_LABEL.unknown;
  const regionText = input.region?.trim() || "办理地区";
  const yearText = input.year?.trim() ? `${input.year} 年度` : "本年度";
  const evidenceText = input.evidence.length
    ? `下面的步骤依据本地知识库中 ${input.evidence.length} 条政策摘要整理，涉及金额、时限的地方以${regionText}官方公告为准。`
    : "本地知识库暂未命中可用条目，以下只提供通用路径，具体口径需要向当地经办机构核实。";

  const said = clip(input.message, 160).replace(/[。；，、！？\s]+$/u, "");

  const baseSteps = profile.steps.map(([title, detail, where, materials, note]) => ({ title, detail, where, materials, note }));
  const tuned = personalizeSteps(input, baseSteps, profile.materials, profile.risks);

  return {
    understanding: `您要办的是“${label}”（${yearText}）。您说的是：“${said}”。${evidenceText}`,
    questions: profile.questions,
    steps: tuned.steps,
    materials: tuned.materials,
    riskNotes: withCoverage(input, tuned.risks),
    citations: pickCitations(input),
    replies: [],
    localCoverage: !coverageNote(input),
    answered: Boolean(input.answered?.length),
    generatedBy: "rules",
    web: { used: false, provider: null, results: [], note: "本次未启用联网核验。" },
    updatedAt: new Date().toISOString(),
  };
}

function matchCitations(titles: string[], evidence: PolicyEvidence[]): string[] {
  const matched = titles
    .map((title) => clip(title, 120))
    .filter((title) => title.length > 3)
    .filter((title) => evidence.some((item) => item.title.includes(title) || title.includes(item.title)));
  return Array.from(new Set(matched)).slice(0, 6);
}

function sanitizeOptions(options: string[]): string[] {
  const cleaned = options
    .map((option) => clip(option, 24))
    .filter((option) => option.length > 0 && !/^其他/.test(option));
  return Array.from(new Set(cleaned)).slice(0, 5);
}

function sanitize(
  model: z.infer<typeof guidanceModelSchema>,
  input: GuidanceInput,
  web: WebSearchOutcome,
): Guidance | null {
  const questions = model.questions
    .map((item) => ({
      question: clip(item.question, 160),
      why: clip(item.why, 160),
      examples: item.examples.map((example) => clip(example, 80)).filter(Boolean).slice(0, 2),
      options: sanitizeOptions(item.options),
    }))
    .filter((item) => item.question.length > 4)
    .slice(0, 6);

  const steps = model.steps
    .map((item) => ({
      title: clip(item.title.replace(/^第\s*[0-9一二三四五六七八九十]+\s*步\s*[:：、.．]?\s*/, ""), 80),
      detail: clip(item.detail, 400),
      where: normalizeWhere(clip(item.where, 120)),
      materials: item.materials.map((material) => clip(material, 60)).filter(Boolean).slice(0, 6),
      note: clip(item.note, 200),
    }))
    .filter((item) => item.title.length > 2 && item.detail.length > 4)
    .slice(0, 8);

  // 首轮（还没回答六问）模型只输出澄清问题、不给步骤，这是有效输出；
  // 回答过之后才要求必须给出完整步骤。
  if (!input.answered?.length && steps.length === 0) {
    // 保留澄清问题，步骤留空，界面在答完前也不展示步骤
  } else if (steps.length < 3) {
    return null;
  }

  const understanding = clip(model.understanding, 500);
  if (understanding.length < 10) return null;

  const fallback = offlineProfile(input.serviceType, input.region);
  let mergedQuestions = questions;
  if (!input.answered?.length && questions.length < 3) {
    mergedQuestions = [...questions, ...fallback.questions.filter((item) => !questions.some((asked) => asked.question === item.question))].slice(0, 6);
  }

  const matched = matchCitations(model.citationTitles, input.evidence);

  return {
    understanding,
    questions: mergedQuestions,
    steps,
    materials: model.materials.map((item) => clip(item, 60)).filter(Boolean).slice(0, 12),
    riskNotes: withCoverage(input, model.riskNotes.map((item) => clip(item, 200)).filter(Boolean)),
    citations: matched.length ? matched : pickCitations(input),
    replies: [],
    localCoverage: !coverageNote(input),
    answered: Boolean(input.answered?.length),
    generatedBy: "deepseek",
    web,
    updatedAt: new Date().toISOString(),
  };
}

export async function generateGuidance(input: GuidanceInput): Promise<Guidance> {
  const web = await searchWeb(
    [SERVICE_LABEL[input.serviceType] ?? "", input.region ?? "", "办理流程 所需材料 官方"].filter(Boolean).join(" "),
  );

  if (!deepseekConfigured()) return { ...offlineGuidance(input), web: web.used ? web : offlineGuidance(input).web };

  const json = await requestDeepSeekJson(SYSTEM_PROMPT, buildUserPrompt(input, web), {
    maxTokens: 2200,
    temperature: 0.2,
    timeoutMs: 40000,
  });
  if (!json) {
    if (process.env.DEEPSEEK_DEBUG === "1") console.error("[guidance] no model json");
    return { ...offlineGuidance(input), web };
  }

  const parsed = guidanceModelSchema.safeParse(json);
  if (!parsed.success) {
    if (process.env.DEEPSEEK_DEBUG === "1") console.error("[guidance] schema", JSON.stringify(parsed.error.issues.slice(0, 3)));
    return { ...offlineGuidance(input), web };
  }
  const tunedGuidance = sanitize(parsed.data, input, web);
  if (!tunedGuidance && process.env.DEEPSEEK_DEBUG === "1") {
    console.error("[guidance] sanitize-null", JSON.stringify({
      keys: Object.keys(parsed.data ?? {}),
      questions: parsed.data?.questions?.length,
      steps: parsed.data?.steps?.length,
      understandingLength: parsed.data?.understanding?.length,
    }));
  }
  return tunedGuidance ?? { ...offlineGuidance(input), web };
}

const FOLLOWUP_PROMPT = `你是“Smart AI（明白办）”的政务办理引导员，正在回答用户对刚才办理指引的追问。

硬性规则：
1. 只能依据【本地知识库】和【当前指引】回答；知识库没有的，直接说“知识库里没有这条”，再告诉用户去哪核实（当地政务服务热线 12345、医保 12393、经办窗口），不得编造。
2. 不写具体金额、比例、截止日期和电话，除非本地知识库条目里原样出现。
3. 用户在补充其他情况时，先说明“这样理解对不对”，再给需要调整的动作。
4. 短句、大白话，不超过 200 字，直接回答问题，不要重复整份指引。
5. 只输出 JSON：{ "answer": "回答正文", "citations": ["用到的本地知识库条目标题"] }`;

const followUpSchema = z.object({
  answer: z.string().default(""),
  citations: z.array(z.string()).default([]),
});

export async function answerFollowUp(input: {
  question: string;
  kind: "question" | "other";
  message: string;
  serviceType: string;
  region?: string;
  year?: string;
  evidence: PolicyEvidence[];
  guidance?: Guidance | null;
}): Promise<GuidanceReply> {
  const question = clip(input.question, 300);
  const created = () => ({ id: `reply_${Date.now().toString(36)}`, question, kind: input.kind, createdAt: new Date().toISOString() });

  const evidenceLines = input.evidence.length
    ? input.evidence.map((item, index) => `[${index + 1}] ${item.title}｜${item.region ?? "全国"}｜${item.section ?? ""}｜${item.quote}`).join("\n")
    : "（本次没有命中本地知识库条目）";

  const stepLines = input.guidance?.steps.map((step) => `${step.title}：${step.detail}`).join("\n") ?? "（暂无指引）";

  const user = [
    `用户最初的情况：${input.message}`,
    `办理地区：${input.region?.trim() || "未提供"}｜年份：${input.year?.trim() || "未提供"}`,
    "",
    `【当前指引】\n${stepLines}`,
    "",
    `【本地知识库】\n${evidenceLines}`,
    "",
    input.kind === "other"
      ? `【用户补充的其他情况】${question}`
      : `【用户的追问】${question}`,
    "",
    input.kind === "other"
      ? "请先确认理解是否变化，再给需要调整的具体动作。"
      : "请直接回答这个问题；答不了就说知识库没有，并给核实渠道。",
  ].join("\n");

  if (deepseekConfigured()) {
    const json = await requestDeepSeekJson(FOLLOWUP_PROMPT, user, { maxTokens: 600, temperature: 0.2, timeoutMs: 30000 });
    const parsed = json ? followUpSchema.safeParse(json) : null;
    const answer = parsed?.success ? clip(parsed.data.answer, 600) : "";
    if (answer.length >= 4) {
      return {
        ...created(),
        answer,
        citations: parsed?.success ? matchCitations(parsed.data.citations, input.evidence).slice(0, 3) : [],
      };
    }
  }

  const place = input.region?.trim() || "当地";
  const citations = pickCitations({ message: input.message, serviceType: input.serviceType, region: input.region, evidence: input.evidence });
  const fallback = input.kind === "other"
    ? `记下了。本地知识库暂时没有这条的具体规定，不做猜测。这种情况建议在办理时向${place}经办窗口当面说明，或先打 12345 确认是否需要额外材料。上面的办理步骤仍然适用。`
    : `这条问题本地知识库暂时没有直接依据，不提供推测答案。可以先按上面的办理步骤走；涉及${place}的具体标准，请打 12345（医保可拨 12393）或到政务服务窗口确认。`;

  return { ...created(), answer: fallback, citations };
}
