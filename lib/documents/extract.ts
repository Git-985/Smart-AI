/**
 * 从材料文字里提取地区和年份，用于“上传材料后直接开始流程”。
 * 只做保守匹配：拿不准就返回空，让用户自己补。
 */

const PROVINCES = [
  "北京", "天津", "上海", "重庆", "河北", "山西", "辽宁", "吉林", "黑龙江",
  "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南",
  "广东", "海南", "四川", "贵州", "云南", "陕西", "甘肃", "青海", "内蒙古",
  "广西", "西藏", "宁夏", "新疆",
];

const MUNICIPALITIES = new Set(["北京", "天津", "上海", "重庆"]);

export function detectRegion(text: string): string {
  const flat = text.replace(/\s+/g, "");
  const province = PROVINCES.find((item) => flat.includes(item));
  if (!province) return "";

  const start = flat.indexOf(province);
  let base = province;
  let cursor = start + province.length;

  if (MUNICIPALITIES.has(province)) {
    base = `${province}市`;
    if (flat.startsWith("市", cursor)) cursor += 1;
  } else {
    const suffix = flat.slice(cursor, cursor + 6).match(/^(省|自治区|特别行政区)/)?.[0] ?? "";
    base = `${province}${suffix}`;
    cursor += suffix.length;
  }

  const rest = flat.slice(cursor, cursor + 24);
  const city = rest.match(/^[\u4e00-\u9fa5]{2,10}?(?:市|自治州|地区|盟)/)?.[0] ?? "";
  const district = rest.slice(city.length).match(/^[\u4e00-\u9fa5]{2,10}?(?:区|县|旗)/)?.[0] ?? "";

  return `${base}${city}${district}`.slice(0, 30);
}

export function detectYear(text: string): string {
  const yearly = text.match(/(20[2-9]\d)\s*年度/);
  if (yearly) return yearly[1];
  const plain = text.match(/(20[2-9]\d)\s*年/);
  return plain ? plain[1] : "";
}


export type MaterialServiceType = "medical_insurance" | "student_aid" | "elderly_disability_service";

/** 依据材料里的关键词推断属于哪个模块，用于上传后直接进入对应流程。 */
export function detectServiceType(text: string): MaterialServiceType | "" {
  const flat = text.replace(/\s+/g, "");
  if (/医保|社保|参保|缴费|异地就医|医保局/.test(flat)) return "medical_insurance";
  if (/助学|奖学金|学生资助|困难认定|生源地贷款|学籍/.test(flat)) return "student_aid";
  if (/高龄|护理补贴|残疾|失能|养老|津贴/.test(flat)) return "elderly_disability_service";
  return "";
}
