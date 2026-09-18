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
  // The site version is injected at build time (`__APP_VERSION__` in
  // vite.config.ts) instead of importing package.json, which would drag the
  // whole dependency list into the server bundle for one string. The game data
  // version comes from `data.meta`.
  return <AtlasShell initialSearchParams={params.toString()} />;
}
