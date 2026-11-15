import { describe, expect, it } from "vitest";
import { amapSearchUrl, cityOf, mapKeyword } from "../../lib/geo/map";

describe("map helper", () => {
  it("线上途径不生成地图链接", () => {
    expect(mapKeyword("国家医保服务平台 App、当地政务 App")).toBe("");
    expect(mapKeyword("当地医保局官网/公众号、12393 医保服务热线、社区公告栏")).toBe("");
    expect(mapKeyword("")).toBe("");
  });

  it("按地点类型给出可搜索的关键词", () => {
    expect(mapKeyword("国家医保服务平台 App、医保窗口")).toBe("医保经办服务大厅");
    expect(mapKeyword("在家整理；需要复印、打印可到社区便民服务中心或村（社区）服务站")).toBe("便民服务中心");
    expect(mapKeyword("街道（乡镇）便民服务中心、残联窗口")).toBe("残疾人联合会");
    expect(mapKeyword("就读学校学生资助管理中心")).toBe("学生资助管理中心");
    expect(mapKeyword("线上自助 或 就近便民服务中心")).toBe("便民服务中心");
  });

  it("城市取到市级，链接带城市参数", () => {
    expect(cityOf("广东省广州市黄埔区")).toBe("广东省广州市");
    expect(cityOf("北京市朝阳区")).toBe("北京市");
    const url = amapSearchUrl("医保经办服务大厅", "广东省广州市黄埔区");
    expect(url).toContain("uri.amap.com/search");
    expect(url).toContain(`city=${encodeURIComponent("广东省广州市")}`);
    expect(url).toContain(`keyword=${encodeURIComponent("医保经办服务大厅")}`);
  });
});
