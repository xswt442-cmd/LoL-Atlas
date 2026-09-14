import { AtlasShell } from "@/components/atlas/atlas-shell";
import pkg from "@/package.json";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
  }
  // 站点 tag 版本来自 package.json（服务端读取），游戏数据版本来自 data.meta
  return <AtlasShell initialSearchParams={params.toString()} appVersion={pkg.version} />;
}
