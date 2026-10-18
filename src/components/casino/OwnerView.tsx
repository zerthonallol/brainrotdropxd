import { useEffect, useMemo, useState } from "react"
import { Crown, Gift, Megaphone, RotateCcw, Search, Ticket, Trash2, Wrench } from "lucide-react"

import { CASES } from "@/data/cases"
import { toast } from "sonner"
import { BRAINROTS } from "@/data/brainrots"
import { originalPrice, useLive } from "@/lib/live"
import { getMaintenance, ownerAnnounce, ownerCreatePromo, ownerDeletePromo, ownerGrant, ownerListPromos, ownerSetMaintenance, ownerSetPrice } from "@/lib/owner.functions"
import { useStore } from "@/lib/store"
import { tg } from "@/lib/telegram"
import { BrainrotImg, formatCoins } from "./ui"

export function OwnerView() {
  const store = useStore()
  useLive()
  const [q, setQ] = useState("")
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const list = useMemo(() => BRAINROTS.filter((b) => b.name.toLowerCase().includes(q.toLowerCase())).slice(0, 60), [q])

  const initData = () => {
    const app = tg()
    if (!app) {
      toast.error("Открой приложение в Telegram")
      return null
    }
    return app.initData
  }

  const savePrice = async (id: string, price: number | null) => {
    const d = initData()
    if (!d) return
    setBusy(true)
    try {
      await ownerSetPrice({ data: { initData: d, id, price } })
      await store.refreshSettings()
      setEdits((e) => ({ ...e, [id]: "" }))
      toast.success("Цена обновлена у всех")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }

  const announce = async (value: string | null) => {
    const d = initData()
    if (!d) return
    setBusy(true)
    try {
      await ownerAnnounce({ data: { initData: d, text: value } })
      await store.refreshSettings()
      setText("")
      toast.success(value ? "Плашка показана всем, кроме тебя" : "Плашка убрана")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bd-panel flex items-center gap-3 p-4">
        <div className="grid size-10 place-items-center rounded-xl bg-[var(--bd-gold)]/15 text-[var(--bd-gold)]">
          <Crown className="size-5" />
        </div>
        <div>
          <div className="font-heading font-extrabold">Панель владельца</div>
          <div className="text-xs text-white/50">Изменения применяются у всех пользователей</div>
        </div>
      </div>

      <div className="bd-panel space-y-3 p-4">
        <div className="flex items-center gap-2 font-bold">
          <Megaphone className="size-4 text-[var(--bd-lime)]" /> Плашка об обновлении
        </div>
        {store.announcement && (
          <div className="rounded-xl bg-black/30 p-3 text-xs text-white/70">
            Сейчас: <b className="text-white">{store.announcement.text}</b>
          </div>
        )}
        <textarea
          className="bd-input min-h-20"
          maxLength={300}
          placeholder="Например: Вышло обновление! Добавили мутации и Dragon Cannelloni"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-2">
          <button type="button" className="bd-btn flex-1 py-2.5 text-sm" disabled={busy || !text.trim()} onClick={() => announce(text)}>
            Показать всем
          </button>
          {store.announcement && (
            <button type="button" className="bd-btn-ghost px-4 py-2.5 text-sm font-bold" disabled={busy} onClick={() => announce(null)}>
              Убрать
            </button>
          )}
        </div>
      </div>

      <GrantPanel />
      <MaintenancePanel />
      <PromoPanel />

      <div className="space-y-3">
        <div className="font-heading font-extrabold">Цены брейнротов</div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
          <input className="bd-input pl-9" placeholder="Найти брейнрота" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {list.map((b) => {
          const orig = originalPrice(b.id)
          const changed = b.price !== orig
          const v = edits[b.id] ?? ""
          const n = Number(v)
          return (
            <div key={b.id} className="bd-panel flex items-center gap-2 p-2.5">
              <BrainrotImg b={b} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold">{b.name}</div>
                <div className="text-[11px] text-white/50">
                  {formatCoins(b.price)} 🪙{changed && <span className="text-white/35"> · было {formatCoins(orig)}</span>}
                </div>
              </div>
              <input
                className="bd-input !w-24 !py-1.5 text-xs"
                inputMode="numeric"
                placeholder="Цена"
                value={v}
                onChange={(e) => setEdits((s) => ({ ...s, [b.id]: e.target.value.replace(/\D/g, "") }))}
              />
              <button type="button" className="bd-btn px-3 py-1.5 text-xs" disabled={busy || !(n >= 1)} onClick={() => savePrice(b.id, n)}>
                ОК
              </button>
              {changed && (
                <button type="button" className="bd-btn-ghost grid size-8 place-items-center" disabled={busy} onClick={() => savePrice(b.id, null)} aria-label="Сбросить">
                  <RotateCcw className="size-3.5" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function useInitData() {
  return () => {
    const app = tg()
    if (!app) {
      toast.error("Открой приложение в Telegram")
      return null
    }
    return app.initData
  }
}

function GrantPanel() {
  const initData = useInitData()
  const [target, setTarget] = useState("")
  const [kind, setKind] = useState<"coins" | "case">("coins")
  const [amount, setAmount] = useState("")
  const [caseId, setCaseId] = useState(CASES[0]?.id ?? "")
  const [busy, setBusy] = useState(false)
  const n = Number(amount)
  const submit = async () => {
    const d = initData()
    if (!d) return
    setBusy(true)
    try {
      const r = await ownerGrant({ data: { initData: d, target, kind, amount: n, caseId: kind === "case" ? caseId : null } })
      toast.success(`Выдано ${r.who}`)
      setAmount("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="bd-panel space-y-3 p-4">
      <div className="flex items-center gap-2 font-bold">
        <Gift className="size-4 text-[var(--bd-pink)]" /> Выдать игроку
      </div>
      <input className="bd-input" placeholder="@username или Telegram ID" value={target} onChange={(e) => setTarget(e.target.value.trim())} />
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1">
        {(["coins", "case"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-lg py-2 text-xs font-bold ${kind === k ? "bg-white/12 text-white" : "text-white/50"}`}>
            {k === "coins" ? "Монеты" : "Кейс"}
          </button>
        ))}
      </div>
      {kind === "case" && (
        <select className="bd-input" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
          {CASES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <input
        className="bd-input"
        inputMode="numeric"
        placeholder={kind === "coins" ? "Сколько монет" : "Сколько кейсов"}
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
      />
      <button type="button" className="bd-btn w-full py-2.5 text-sm" disabled={busy || !target || !(n >= 1)} onClick={submit}>
        Выдать {n >= 1 ? (kind === "coins" ? `${formatCoins(n)} монет` : `${n} кейс(ов)`) : ""}
      </button>
      <div className="text-[11px] text-white/40">Игрок получит выдачу в течение ~15 секунд, если он в приложении, или при следующем заходе.</div>
    </div>
  )
}

function MaintenancePanel() {
  const initData = useInitData()
  const [on, setOn] = useState(false)
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    getMaintenance().then((m) => {
      setOn(m.on)
      setText(m.text ?? "")
    })
  }, [])
  const save = async (next: boolean) => {
    const d = initData()
    if (!d) return
    setBusy(true)
    try {
      await ownerSetMaintenance({ data: { initData: d, on: next, text: text || null } })
      setOn(next)
      toast.success(next ? "Тех. перерыв включён для всех, кроме тебя" : "Сайт снова открыт")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="bd-panel space-y-3 p-4">
      <div className="flex items-center gap-2 font-bold">
        <Wrench className="size-4 text-[var(--bd-gold)]" /> Тех. перерыв
        <span className={`ml-auto text-xs ${on ? "text-[var(--bd-gold)]" : "text-white/40"}`}>{on ? "ВКЛЮЧЁН" : "выключен"}</span>
      </div>
      <textarea className="bd-input min-h-16" maxLength={300} placeholder="Текст для игроков (необязательно)" value={text} onChange={(e) => setText(e.target.value)} />
      <button type="button" className={on ? "bd-btn-ghost w-full py-2.5 text-sm font-bold" : "bd-btn w-full py-2.5 text-sm"} disabled={busy} onClick={() => save(!on)}>
        {on ? "Открыть сайт" : "Закрыть сайт на перерыв"}
      </button>
    </div>
  )
}

type Promo = { code: string; coins: number; max_uses: number; uses: number }

function PromoPanel() {
  const initData = useInitData()
  const [list, setList] = useState<Promo[]>([])
  const [code, setCode] = useState("")
  const [coins, setCoins] = useState("")
  const [uses, setUses] = useState("1")
  const [busy, setBusy] = useState(false)
  const load = async () => {
    const d = tg()?.initData
    if (!d) return
    try {
      setList((await ownerListPromos({ data: { initData: d } })) as Promo[])
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    load()
  }, [])
  const create = async () => {
    const d = initData()
    if (!d) return
    setBusy(true)
    try {
      await ownerCreatePromo({ data: { initData: d, code, coins: Number(coins), maxUses: Number(uses) } })
      toast.success(`Промокод ${code} создан`)
      setCode("")
      setCoins("")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }
  const remove = async (c: string) => {
    const d = initData()
    if (!d) return
    await ownerDeletePromo({ data: { initData: d, code: c } })
    await load()
  }
  return (
    <div className="bd-panel space-y-3 p-4">
      <div className="flex items-center gap-2 font-bold">
        <Ticket className="size-4 text-[var(--bd-lime)]" /> Промокоды
      </div>
      <input className="bd-input uppercase" placeholder="КОД (напр. BRAINROT100)" maxLength={32} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} />
      <div className="grid grid-cols-2 gap-2">
        <input className="bd-input" inputMode="numeric" placeholder="Монет" value={coins} onChange={(e) => setCoins(e.target.value.replace(/\D/g, ""))} />
        <input className="bd-input" inputMode="numeric" placeholder="Активаций" value={uses} onChange={(e) => setUses(e.target.value.replace(/\D/g, ""))} />
      </div>
      <button type="button" className="bd-btn w-full py-2.5 text-sm" disabled={busy || code.length < 3 || !(Number(coins) >= 1) || !(Number(uses) >= 1)} onClick={create}>
        Создать промокод
      </button>
      {list.map((p) => (
        <div key={p.code} className="flex items-center gap-2 rounded-xl bg-black/30 p-2.5 text-xs">
          <b className="font-mono">{p.code}</b>
          <span className="text-white/55">+{formatCoins(Number(p.coins))} 🪙</span>
          <span className="ml-auto text-white/45">
            {p.uses}/{p.max_uses}
          </span>
          <button type="button" aria-label="Удалить" className="text-white/40" onClick={() => remove(p.code)}>
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
