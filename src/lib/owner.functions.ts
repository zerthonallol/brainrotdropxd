import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { authTelegram, isOwner } from "./tg-auth"

export interface PublicSettings {
  priceOverrides: Record<string, number>
  announcement: string | null
  announcementId: string | null
  announcementBy: number | null
}

export const getSettings = createServerFn({ method: "GET" }).handler(async (): Promise<PublicSettings> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
  const { data } = await supabaseAdmin.from("app_settings").select("*").eq("id", 1).maybeSingle()
  return {
    priceOverrides: (data?.price_overrides as Record<string, number> | null) ?? {},
    announcement: data?.announcement ?? null,
    announcementId: data?.announcement_id ?? null,
    announcementBy: data?.announcement_by ?? null,
  }
})

async function requireOwner(initData: string) {
  const u = await authTelegram(initData)
  if (!u || !isOwner(u.id)) throw new Error("Нет доступа")
  return u
}

export const ownerSetPrice = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ initData: z.string().max(4096), id: z.string().max(80), price: z.number().int().min(1).max(100_000_000).nullable() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { data: row } = await supabaseAdmin.from("app_settings").select("price_overrides").eq("id", 1).maybeSingle()
    const map = { ...((row?.price_overrides as Record<string, number> | null) ?? {}) }
    if (data.price === null) delete map[data.id]
    else map[data.id] = data.price
    const { error } = await supabaseAdmin.from("app_settings").upsert({ id: 1, price_overrides: map, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
    return { ok: true, priceOverrides: map }
  })

export const ownerAnnounce = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096), text: z.string().max(300).nullable() }).parse(d))
  .handler(async ({ data }) => {
    const u = await requireOwner(data.initData)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const text = data.text?.trim() || null
    const { error } = await supabaseAdmin.from("app_settings").upsert({
      id: 1,
      announcement: text,
      announcement_id: text ? crypto.randomUUID() : null,
      announcement_by: text ? u.id : null,
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const getMaintenance = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
  const { data } = await supabaseAdmin.from("app_settings").select("maintenance, maintenance_text").eq("id", 1).maybeSingle()
  return { on: Boolean(data?.maintenance), text: data?.maintenance_text ?? null }
})

export const ownerSetMaintenance = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096), on: z.boolean(), text: z.string().max(300).nullable() }).parse(d))
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ maintenance: data.on, maintenance_text: data.text?.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", 1)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

/** Finds a player by Telegram id (digits) or @username. */
async function findPlayer(target: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
  const t = target.trim().replace(/^@/, "")
  if (/^\d+$/.test(t)) {
    const { data } = await supabaseAdmin.from("players").select("tg_id, username, first_name").eq("tg_id", Number(t)).maybeSingle()
    return data ?? { tg_id: Number(t), username: null, first_name: "" }
  }
  const { data } = await supabaseAdmin.from("players").select("tg_id, username, first_name").ilike("username", t).limit(1).maybeSingle()
  return data
}

export const ownerGrant = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        initData: z.string().max(4096),
        target: z.string().min(1).max(64),
        kind: z.enum(["coins", "case"]),
        amount: z.number().int().min(1).max(1_000_000_000_000),
        caseId: z.string().max(80).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const p = await findPlayer(data.target)
    if (!p) throw new Error("Игрок не найден — он должен хоть раз зайти в приложение")
    if (data.kind === "case" && !data.caseId) throw new Error("Выбери кейс")
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { error } = await supabaseAdmin.from("pending_grants").insert({
      tg_id: p.tg_id,
      kind: data.kind,
      amount: data.amount,
      case_id: data.kind === "case" ? data.caseId : null,
    })
    if (error) throw new Error(error.message)
    return { ok: true, who: p.username ? `@${p.username}` : `ID ${p.tg_id}` }
  })

const PROMO_RE = /^[A-Z0-9_-]{3,32}$/

export const ownerListPromos = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096) }).parse(d))
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { data: rows } = await supabaseAdmin.from("promo_codes").select("*").order("created_at", { ascending: false }).limit(100)
    return rows ?? []
  })

export const ownerCreatePromo = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        initData: z.string().max(4096),
        code: z.string().max(32),
        coins: z.number().int().min(1).max(1_000_000_000_000),
        maxUses: z.number().int().min(1).max(1_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const code = data.code.trim().toUpperCase()
    if (!PROMO_RE.test(code)) throw new Error("Код: 3–32 символа, латиница/цифры/_/-")
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { error } = await supabaseAdmin.from("promo_codes").insert({ code, coins: data.coins, max_uses: data.maxUses })
    if (error) throw new Error(error.code === "23505" ? "Такой промокод уже есть" : error.message)
    return { ok: true }
  })

export const ownerDeletePromo = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096), code: z.string().max(32) }).parse(d))
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    await supabaseAdmin.from("promo_codes").delete().eq("code", data.code)
    return { ok: true }
  })
