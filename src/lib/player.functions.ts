import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { authTelegram as auth } from "./tg-auth"

export const loadPlayer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096) }).parse(d))
  .handler(async ({ data }) => {
    const u = await auth(data.initData)
    if (!u) return { ok: false, state: null as string | null }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { data: row } = await supabaseAdmin.from("players").select("state").eq("tg_id", u.id).maybeSingle()
    return { ok: true, state: row?.state ? JSON.stringify(row.state) : null }
  })

export const savePlayer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096), state: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data }) => {
    const u = await auth(data.initData)
    if (!u) return { ok: false }
    if (JSON.stringify(data.state).length > 500_000) return { ok: false }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { error } = await supabaseAdmin.from("players").upsert({
      tg_id: u.id,
      first_name: u.first_name ?? "",
      username: u.username ?? null,
      state: data.state as never,
      updated_at: new Date().toISOString(),
    })
    if (error) console.error("savePlayer", error.message)
    return { ok: !error }
  })

export const redeemPromo = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096), code: z.string().min(1).max(32) }).parse(d))
  .handler(async ({ data }) => {
    const u = await auth(data.initData)
    if (!u) throw new Error("Открой приложение в Telegram")
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { data: coins, error } = await supabaseAdmin.rpc("redeem_promo", { _code: data.code.trim(), _tg_id: u.id })
    if (error) throw new Error(error.message)
    return { coins: Number(coins) }
  })

/** Returns and marks as claimed everything the developer granted to this player. */
export const claimGrants = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096) }).parse(d))
  .handler(async ({ data }) => {
    const u = await auth(data.initData)
    if (!u) return []
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { data: rows } = await supabaseAdmin
      .from("pending_grants")
      .update({ claimed_at: new Date().toISOString() })
      .eq("tg_id", u.id)
      .is("claimed_at", null)
      .select("id, kind, amount, case_id")
    return (rows ?? []).map((r) => ({ id: r.id, kind: r.kind as "coins" | "case", amount: Number(r.amount), caseId: r.case_id }))
  })

export const reportDrop = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ initData: z.string().max(4096), brainrotId: z.string().max(80), source: z.enum(["Кейс", "Апгрейд", "Crash", "Dice"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const u = await auth(data.initData)
    if (!u) return { ok: false }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    await supabaseAdmin.from("live_drops").insert({
      tg_id: u.id,
      user_name: u.username ? u.username : (u.first_name ?? "Игрок"),
      brainrot_id: data.brainrotId,
      source: data.source,
    })
    return { ok: true }
  })

export const getLiveDrops = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
  const { data } = await supabaseAdmin.from("live_drops").select("id, user_name, brainrot_id, source").order("created_at", { ascending: false }).limit(20)
  return (data ?? []).map((r) => ({ key: String(r.id), user: r.user_name, brainrotId: r.brainrot_id, source: r.source }))
})
