#!/usr/bin/npx tsx
/**
 * (주)제이에스브라더스 거래처 070 번호 일괄 변경
 * 사용: npx tsx scripts/update-jsb-070-number.ts [--target prod]
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local";

loadEnvLocal();

const OLD_NUMBER = "07045044181";
const NEW_NUMBER = "050827935382";
const CLIENT_NAME_MATCH = "제이에스브라더스";

type DbTarget = "local" | "prod";

function getClient(target: DbTarget) {
  if (target === "prod") {
    const url = process.env.MIGRATION_TARGET_SUPABASE_URL?.trim();
    const key = process.env.MIGRATION_TARGET_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
      throw new Error("MIGRATION_TARGET_SUPABASE_URL / MIGRATION_TARGET_SERVICE_ROLE_KEY 필요");
    }
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function updateTarget(target: DbTarget) {
  const supabase = getClient(target);
  const label = target === "prod" ? "운영" : "로컬";

  const { data: clients, error: clientErr } = await supabase
    .from("clients")
    .select("id, name, slug")
    .ilike("name", `%${CLIENT_NAME_MATCH}%`);

  if (clientErr) throw new Error(`[${label}] clients 조회 실패: ${clientErr.message}`);
  if (!clients?.length) {
    console.log(`[${label}] '${CLIENT_NAME_MATCH}' 거래처 없음 — 스킵`);
    return;
  }

  for (const client of clients) {
    const { data: configs, error: cfgErr } = await supabase
      .from("client_call_070_configs")
      .select("id, call_070_number")
      .eq("client_id", client.id);

    if (cfgErr) throw new Error(`[${label}] config 조회 실패: ${cfgErr.message}`);

    const hits = (configs ?? []).filter((c) => {
      const n = String(c.call_070_number ?? "").replace(/\D/g, "");
      return n === OLD_NUMBER || n.includes(OLD_NUMBER.replace(/\D/g, ""));
    });

    if (!hits.length) {
      console.log(
        `[${label}] ${client.name} (${client.id}): ${OLD_NUMBER} 없음 — 현재:`,
        (configs ?? []).map((c) => c.call_070_number).join(", ") || "(설정 없음)"
      );
      continue;
    }

    for (const cfg of hits) {
      const { error: updErr } = await supabase
        .from("client_call_070_configs")
        .update({
          call_070_number: NEW_NUMBER,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cfg.id);

      if (updErr) throw new Error(`[${label}] config 업데이트 실패: ${updErr.message}`);

      console.log(
        `[${label}] ✓ ${client.name}: ${cfg.call_070_number} → ${NEW_NUMBER} (config ${cfg.id})`
      );
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const targets: DbTarget[] = args.includes("--target")
    ? args.includes("prod")
      ? ["prod"]
      : args.includes("all")
        ? ["local", "prod"]
        : ["local"]
    : ["local", "prod"];

  console.log(`070 번호 변경: ${OLD_NUMBER} → ${NEW_NUMBER}`);
  console.log(`대상 DB: ${targets.join(", ")}`);

  for (const t of targets) {
    await updateTarget(t);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
