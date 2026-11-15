/**
 * 高德地图网页搜索链接（无需 Key）：
 * 把“去哪办”变成可直接查看的位置，而不是一句地点名。
 *
 * 精确到某个窗口的地址无法从文案里可靠推断，这里按“地点类型 + 城市”搜索，
 * 由地图给出附近的候选点，避免编造具体地址。
 */

// 这些说法指向线上渠道或公告，不适合直接拿去搜地点
const ONLINE_HINT = /(线上|手机|网上|app|微信|支付宝|官网|公众号|网站|热线|电话|在家|公告栏|自助)/i;

export function cityOf(region?: string): string {
  if (!region) return "";
  const match = region.match(/^.*?(?:市|自治州|地区|盟)/);
  return match?.[0] ?? region.slice(0, 12);
}

const RULES: Array<{ test: RegExp; keyword: string }> = [
  { test: /医保|社保|参保|医疗保障/, keyword: "医保经办服务大厅" },
  { test: /残联|残疾/, keyword: "残疾人联合会" },
  { test: /学校|资助中心|学生资助/, keyword: "学生资助管理中心" },
  { test: /医院|评定|体检/, keyword: "指定医院" },
  { test: /银行|网点/, keyword: "银行网点" },
  { test: /派出所|公安/, keyword: "派出所" },
  { test: /便民服务中心|政务服务中心|服务大厅|办事大厅/, keyword: "便民服务中心" },
  { test: /社区|村委会|居委会|村（社区）/, keyword: "社区服务站" },
];

/** 从“去哪办”里挑出可以搜的位置类型；全是线上途径时返回空。 */
export function mapKeyword(where?: string): string {
  if (!where) return "";
  const parts = where.split(/[、,，;；/或]/).map((item) => item.trim()).filter(Boolean);
  const physical = parts.filter((part) => !ONLINE_HINT.test(part));
  if (!physical.length) return "";
  for (const rule of RULES) {
    if (physical.some((part) => rule.test.test(part))) return rule.keyword;
  }
  return "";
}

export function amapSearchUrl(keyword: string, region?: string): string {
  const params = new URLSearchParams({ keyword, callnative: "1" });
  const city = cityOf(region);
  if (city) params.set("city", city);
  return `https://uri.amap.com/search?${params.toString()}`;
}
