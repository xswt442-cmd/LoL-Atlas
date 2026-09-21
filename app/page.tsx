import { AtlasShell } from "@/components/atlas/atlas-shell";

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
  // 站点版本在构建时注入（`__APP_VERSION__`，见 vite.config.ts），而不是 import
  // package.json —— 后者会因为一个字符串把整份依赖清单拖进服务端产物。
  // 游戏数据版本来自 `data.meta`。
  return <AtlasShell initialSearchParams={params.toString()} />;
}
