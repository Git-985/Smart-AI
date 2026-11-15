import Link from "next/link";
import { TaskWorkspace } from "@/components/task-workspace";

type Scenario = {
  serviceType: "medical_insurance" | "student_aid" | "elderly_disability_service";
  sample: string;
  placeholder: string;
};

// 三个模块各自的示例与提示语，避免所有入口都显示同一句医保文案。
const scenarios: Record<string, Scenario> = {
  medical: {
    serviceType: "medical_insurance",
    sample: "帮父亲了解今年居民医保怎么缴费，他行动不太方便。",
    placeholder: "例如：帮父亲了解今年居民医保怎么缴费，他行动不太方便。",
  },
  student: {
    serviceType: "student_aid",
    sample: "帮孩子了解高校学生助学金怎么申请，需要准备哪些材料。",
    placeholder: "例如：帮孩子了解高校助学金的申请条件和要准备的材料。",
  },
  elderly: {
    serviceType: "elderly_disability_service",
    sample: "帮家里老人申请护理补贴，需要带哪些材料。",
    placeholder: "例如：帮家里老人申请护理补贴或高龄津贴，需要带什么材料。",
  },
};

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; demo?: string }>;
}) {
  const { scenario, demo } = await searchParams;
  const config = scenario ? scenarios[scenario] : undefined;
  return (
    <main className="main">
      <Link href="/">← 返回首页</Link>
      <TaskWorkspace
        initialMessage={config && demo === "1" ? config.sample : ""}
        placeholder={config?.placeholder}
        scenario={config?.serviceType}
      />
    </main>
  );
}
