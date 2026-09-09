"use client";
import { Fragment, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  CalendarDays,
  Bell,
  ChefHat,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LockKeyhole,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Search,
  Settings,
  Shirt,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { pasteFetch } from "@/lib/client-api";
import {
  disableBirthdayPush,
  enableBirthdayPush,
  getPushStatus,
  isPushSupported,
  testBirthdayPush,
} from "@/lib/push-notifications";

type Food = {
  name: string;
  why: string;
  date: string;
  status: "Da portare" | "Portato";
  note: string;
  initials: string;
  birthdayKey?: string;
  displayName?: string;
};
type Person = [
  name: string,
  initials: string,
  role: "Giocatore" | "Allenatore",
  birthday: string,
  foodCount: number,
  kitCount: number,
  nickname?: string,
];
type AuthInfo = {
  authenticated: boolean;
  personName: string | null;
  role: "captain" | "viewer" | null;
  people: string[];
  captainName: string;
  captainReady: boolean;
};
const people: Person[] = [
  ["Andrea Bianchi", "AB", "Giocatore", "1998-09-12", 3, 2],
  ["Luca Bodini", "LB", "Giocatore", "2003-11-21", 2, 1],
  ["Matteo Ferrari", "MF", "Giocatore", "1999-09-28", 4, 2],
  ["Davide Rossi", "DR", "Giocatore", "2000-10-06", 1, 1],
  ["Marco Zanetti", "MZ", "Giocatore", "1997-01-19", 2, 0],
  ["Coach Nicola", "CN", "Allenatore", "1985-02-03", 2, 0],
];
const initial: Food[] = [
  {
    name: "Matteo Ferrari",
    why: "Compleanno",
    date: "Ven 12 set",
    status: "Da portare",
    note: "",
    initials: "MF",
  },
  {
    name: "Luca Bodini",
    why: "Ritardo allenamento",
    date: "Ven 5 set",
    status: "Portato",
    note: "2 teglie di pizza",
    initials: "LB",
  },
  {
    name: "Coach Nicola",
    why: "Compleanno",
    date: "Mer 27 ago",
    status: "Portato",
    note: "Focacce e bibite",
    initials: "CN",
  },
];
const Avatar = ({ x, big = false }: { x: string; big?: boolean }) => (
  <span className={big ? "avatar big" : "avatar"}>{x}</span>
);
const dayStart = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
const birthdayDate = (birthday: string, year: number) => {
  const [, month, day] = birthday.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const formatBirthday = (birthday: string) => {
  const date = birthdayDate(birthday, 2000);
  return Number.isNaN(date.getTime())
    ? birthday
    : date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
};
const initialsFor = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const displayName = (person: Person) => person[6]?.trim() || person[0];
const sortBySurname = (players: Person[]) =>
  [...players].sort((a, b) => {
    const surname = (person: Person) => person[0].trim().split(/\s+/).at(-1)!;
    const surnameOrder = surname(a).localeCompare(surname(b), "it", {
      sensitivity: "base",
    });
    return (
      surnameOrder ||
      a[0].localeCompare(b[0], "it", { sensitivity: "base" })
    );
  });
export default function Home() {
  const [tab, setTab] = useState("home"),
    [auth, setAuth] = useState<AuthInfo | null>(null),
    [captainName, setCaptainName] = useState("Luca Bodini"),
    [teamName, setTeamName] = useState("Basket Club"),
    [teamNameModal, setTeamNameModal] = useState(false),
    [team, setTeam] = useState(people),
    [foods, setFoods] = useState(initial),
    [kits, setKits] = useState(() =>
      sortBySurname(people.filter((x) => x[2] === "Giocatore")),
    ),
    [kitUndo, setKitUndo] = useState<{
      kits: Person[];
      team: Person[];
    } | null>(null),
    [washingKit, setWashingKit] = useState<string | null>(null),
    [deliveringFood, setDeliveringFood] = useState<string | null>(null),
    [modal, setModal] = useState(false),
    [washModal, setWashModal] = useState(false),
    [washChoice, setWashChoice] = useState(0),
    [editIndex, setEditIndex] = useState<number | null>(null),
    [editFoodIndex, setEditFoodIndex] = useState<number | null>(null),
    [addPerson, setAddPerson] = useState(false),
    [birthdayCalendar, setBirthdayCalendar] = useState(false),
    [teamSearch, setTeamSearch] = useState(""),
    [mobileMenu, setMobileMenu] = useState(false),
    [hydrated, setHydrated] = useState(false),
    [pushStatus, setPushStatus] = useState<"enabled" | "disabled" | "denied" | "unsupported">("unsupported"),
    [toast, setToast] = useState("");
  useEffect(() => {
    if (!mobileMenu) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenu(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("menu-open");
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("menu-open");
    };
  }, [mobileMenu]);
  useEffect(() => {
    const hasOpenModal =
      modal ||
      washModal ||
      editIndex !== null ||
      editFoodIndex !== null ||
      addPerson ||
      birthdayCalendar ||
      teamNameModal;
    if (!hasOpenModal) return;
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [
    addPerson,
    birthdayCalendar,
    editFoodIndex,
    editIndex,
    modal,
    teamNameModal,
    washModal,
  ]);
  useEffect(() => {
    pasteFetch("/api/auth", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setAuth(data);
        setCaptainName(data.captainName || "Luca Bodini");
      })
      .catch(() =>
        setAuth({
          authenticated: false,
          personName: null,
          role: null,
          people: [],
          captainName: "Luca Bodini",
          captainReady: false,
        }),
      );
  }, []);
  useEffect(() => {
    if (!auth?.authenticated) return;
    let active = true;
    const load = async () => {
      const response = await pasteFetch("/api/state"),
        payload = await response.json();
      if (!response.ok) {
        if (response.status === 401)
          setAuth((current) =>
            current
              ? { ...current, authenticated: false, role: null }
              : current,
          );
        return;
      }
      let data = payload.data;
      if (auth.role === "captain" && payload.revision === 0) {
        try {
          const local = localStorage.getItem("terzo-tempo-data");
          if (local) {
            data = JSON.parse(local);
            await pasteFetch("/api/state", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ data, captainName: payload.captainName }),
            });
          }
        } catch {}
      }
      if (!active) return;
      if (Array.isArray(data.team)) setTeam(data.team);
      if (Array.isArray(data.foods)) setFoods(data.foods);
      if (Array.isArray(data.kits)) setKits(data.kits);
      if (typeof data.teamName === "string" && data.teamName.trim())
        setTeamName(data.teamName.trim());
      setCaptainName(payload.captainName || auth.captainName);
      setHydrated(true);
    };
    load().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [auth?.authenticated, auth?.role]);
  useEffect(() => {
    if (!auth?.authenticated) return;
    getPushStatus().then(setPushStatus).catch(() => setPushStatus("unsupported"));
  }, [auth?.authenticated]);
  useEffect(() => {
    if (!hydrated || auth?.role !== "captain") return;
    localStorage.setItem(
      "terzo-tempo-data",
      JSON.stringify({ teamName, team, foods, kits }),
    );
    const timer = setTimeout(() => {
      pasteFetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { teamName, team, foods, kits },
          captainName,
        }),
      }).catch(() => undefined);
    }, 450);
    return () => clearTimeout(timer);
  }, [teamName, team, foods, kits, captainName, hydrated, auth?.role]);
  const today = dayStart(),
    upcomingBirthdays = team
      .map((person) => {
        let date = birthdayDate(person[3], today.getFullYear());
        if (date < today)
          date = birthdayDate(person[3], today.getFullYear() + 1);
        return {
          person,
          date,
          days: Math.round((date.getTime() - today.getTime()) / 86400000),
        };
      })
      .filter((item) => !Number.isNaN(item.date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime()),
    birthdaysToday = upcomingBirthdays.filter((item) => item.days === 0),
    nextBirthday = upcomingBirthdays[0],
    next = kits[0],
    flash = (t: string) => {
      setToast(t);
      setTimeout(() => setToast(""), 2000);
    },
    runLayoutTransition = (update: () => void) => {
      const documentWithTransition = document as Document & {
        startViewTransition?: (callback: () => void) => void;
      };
      if (documentWithTransition.startViewTransition)
        documentWithTransition.startViewTransition(() => flushSync(update));
      else update();
    },
    regenerateKitRound = () => {
      if (auth?.role !== "captain") return;
      setKitUndo({ kits, team });
      setKits(sortBySurname(team.filter((person) => person[2] === "Giocatore")));
      setWashChoice(0);
      flash("Giro divise rigenerato");
    },
    undoKitAction = () => {
      if (auth?.role !== "captain" || !kitUndo) return;
      setKits(kitUndo.kits);
      setTeam(kitUndo.team);
      setKitUndo(null);
      setWashChoice(0);
      flash("Ultima azione annullata");
    },
    washPlayer = (index: number) => {
      if (auth?.role !== "captain" || washingKit) return;
      const washer = kits[index];
      if (!washer) return;
      setWashingKit(washer[0]);
      setWashModal(false);
      setTimeout(() => {
      runLayoutTransition(() => {
      setKitUndo({ kits, team });
      const updated = [...washer] as Person;
      updated[5] = Number(updated[5]) + 1;
      const remaining = kits.filter((_, i) => i !== index);
      setKits([...remaining, updated]);
      setTeam((current) =>
        current.map((person) =>
          person[0] === washer[0]
            ? ([...person.slice(0, 5), Number(person[5]) + 1, person[6]] as Person)
            : person,
        ),
      );
      setWashChoice(0);
      flash(
        "Divise lavate da " +
          displayName(washer) +
          ". Il prossimo turno è di " +
          (remaining[0] ? displayName(remaining[0]) : displayName(washer)),
      );
      });
      setTimeout(() => setWashingKit(null), 500);
      }, 420);
    };
  const toggleBirthdayPush = async () => {
    try {
      if (pushStatus === "enabled") {
        await disableBirthdayPush();
        setPushStatus("disabled");
        flash("Notifiche compleanni disattivate");
      } else {
        await enableBirthdayPush();
        setPushStatus("enabled");
        flash("Notifiche compleanni attivate");
      }
    } catch (error) {
      flash(error instanceof Error ? error.message : "Impossibile aggiornare le notifiche");
      getPushStatus().then(setPushStatus).catch(() => undefined);
    }
  };
  const sendPushTest = async () => {
    try {
      await testBirthdayPush();
      flash("Notifica di test inviata");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Test notifiche non riuscito");
    }
  };
  const nav = [
    ["home", "Panoramica", ClipboardList],
    ["paste", "Paste", ChefHat],
    ["divise", "Divise", Shirt],
    ["squadra", "Squadra", Users],
    ["impostazioni", "Impostazioni", Settings],
  ];
  const removeFood = (index: number) => {
    if (auth?.role !== "captain") return;
    setFoods((current) => current.filter((_, itemIndex) => itemIndex !== index));
    flash("Voce eliminata");
  };
  const updateFood = (index: number, updated: Food) => {
    if (auth?.role !== "captain") return;
    setFoods((current) =>
      current.map((food, itemIndex) =>
        itemIndex === index ? updated : food,
      ),
    );
    flash("Voce aggiornata");
  };
  const mark = (i: number, delivery: string) => {
    if (auth?.role !== "captain" || deliveringFood) return;
    const delivered = foods[i];
    if (!delivered || delivered.status === "Portato") return;
    setDeliveringFood(delivered.name);
    setTimeout(() => {
    runLayoutTransition(() => {
    setFoods((x) =>
      x.map((f, n) =>
        n === i ? { ...f, status: "Portato", note: delivery } : f,
      ),
    );
    setTeam((current) =>
      current.map((person) =>
        person[0] === delivered.name
          ? ([
              ...person.slice(0, 4),
              Number(person[4]) + 1,
              person[5],
              person[6],
            ] as Person)
          : person,
      ),
    );
    setKits((current) =>
      current.map((person) =>
        person[0] === delivered.name
          ? ([
              ...person.slice(0, 4),
              Number(person[4]) + 1,
              person[5],
              person[6],
            ] as Person)
          : person,
      ),
    );
    flash("Spostato nello storico");
    });
    setTimeout(() => setDeliveringFood(null), 500);
    }, 420);
  };
  if (!auth)
    return (
      <div className="auth-loading">
        <span className="auth-ball">●</span>
      </div>
    );
  if (!auth.authenticated)
    return (
      <LoginScreen
        info={auth}
        onLogin={(next) => {
          setHydrated(false);
          setAuth({ ...auth, ...next, authenticated: true });
          setCaptainName(next.captainName || auth.captainName);
        }}
      />
    );
  if (!hydrated)
    return (
      <div className="auth-loading">
        <span className="auth-ball">●</span>
        <small>Caricamento squadra…</small>
      </div>
    );
  const canEdit = auth.role === "captain";
  const normalizedTeamSearch = teamSearch.trim().toLocaleLowerCase("it-IT");
  const visibleTeam = team
    .map((person, index) => ({ person, index }))
    .filter(({ person }) => {
      if (!normalizedTeamSearch) return true;
      return `${person[0]} ${person[2]} ${displayName(person)}`
        .toLocaleLowerCase("it-IT")
        .includes(normalizedTeamSearch);
    })
    .sort((a, b) => Number(a.person[2] === "Allenatore") - Number(b.person[2] === "Allenatore"));
  return (
    <main className="app">
      <aside className={mobileMenu ? "mobile-open" : ""}>
        <div className="brand">
          <img src="team-logo.png" alt="Logo Paste" />
          <b>●</b> PASTE
        </div>
        <small>STAGIONE 2026 / 27</small>
        {nav.map(([id, label, Icon]) => (
          <button
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id as string);
              setMobileMenu(false);
            }}
            key={id as string}
          >
            <Icon size={19} />
            <span>{label as string}</span>
          </button>
        ))}
        <button
          className="club"
          type="button"
          onClick={() => canEdit && setTeamNameModal(true)}
          aria-label={canEdit ? "Modifica nome squadra" : teamName}
        >
          ●{" "}
          <div>
            <strong>{teamName}</strong>
            <em>{canEdit ? "Modifica nome squadra" : "La tua squadra"}</em>
          </div>
          {canEdit && <Pencil className="club-pencil" size={14} />}
        </button>
      </aside>
      {mobileMenu && (
        <button
          className="menu-backdrop"
          aria-label="Chiudi menu"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <section className="content">
        <header>
          <button
            className="mobile-menu-toggle"
            aria-label={mobileMenu ? "Chiudi menu" : "Apri menu"}
            aria-expanded={mobileMenu}
            onClick={() => setMobileMenu((open) => !open)}
          >
            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div>
            <p>{teamName.toUpperCase()}</p>
            <h1>
              {tab === "home"
                ? `Ciao, ${canEdit ? "Capitano" : auth.personName?.split(" ")[0]} 👋`
                : nav.find((x) => x[0] === tab)?.[1]}
            </h1>
          </div>
          <div className="header-actions">
            {canEdit && <span className="role-chip captain">Capitano</span>}
            <button
              className="date date-button"
              onClick={() => setBirthdayCalendar(true)}
              aria-label="Apri calendario compleanni"
            >
              <CalendarDays size={17} />
              {today.toLocaleDateString("it-IT", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </button>
            <button
              className="logout-button"
              aria-label="Esci"
              onClick={async () => {
                await pasteFetch("/api/auth", { method: "DELETE" });
                setHydrated(false);
                setAuth({
                  ...auth,
                  authenticated: false,
                  role: null,
                  personName: null,
                });
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        {toast && (
          <div className="toast">
            <Check size={16} />
            {toast}
          </div>
        )}
        {tab === "home" && (
          <>
            <div className="cards page-enter">
              <Card
                t="DA PORTARE"
                v={String(
                  foods.filter((x) => x.status === "Da portare").length,
                ).padStart(2, "0")}
                d="in attesa"
                c="orange"
                i={<ChefHat />}
                go={() => setTab("paste")}
              />
              <Card
                t="TURNO DIVISE"
                v={(next?.[1] as string) || "—"}
                d={next ? displayName(next) : "Nessun giocatore"}
                c="purple"
                i={<Shirt />}
                go={() => setTab("divise")}
              />
              <Card
                t="PROSSIMO COMPLEANNO"
                v={
                  nextBirthday
                    ? nextBirthday.date.toLocaleDateString("it-IT", {
                        day: "numeric",
                        month: "long",
                      })
                    : "—"
                }
                d={
                  nextBirthday
                    ? displayName(nextBirthday.person)
                    : "Nessuna data inserita"
                }
                c={
                  birthdaysToday.length
                    ? "blue birthday-card celebrating"
                    : "blue birthday-card"
                }
                i={<CalendarDays />}
                go={() => setTab("squadra")}
                celebration={birthdaysToday.length > 0}
              />
            </div>
            <div className="twocol page-enter page-enter-delay-1">
              <article className="panel">
                <div className="head">
                  <div>
                    <p>ALLENAMENTO · VENERDÌ 12</p>
                    <h2>Chi porta da mangiare</h2>
                  </div>
                  <button onClick={() => setTab("paste")}>→</button>
                </div>
                {foods
                  .filter((f) => f.status === "Da portare")
                  .map((f) => (
                    <FoodRow
                      key={`${f.name}-${foods.indexOf(f)}`}
                      f={f}
                      i={foods.indexOf(f)}
                      mark={mark}
                      canEdit={canEdit}
                      moving={deliveringFood === f.name}
                    />
                  ))}
              </article>
              <article className="wash">
                <div className="shirt">
                  <Shirt size={34} />
                </div>
                <small>TURNO DIVISE</small>
                <h2>{next ? displayName(next) : "Nessun giocatore"}</h2>
                {canEdit && (
                  <div className="wash-actions">
                    <button
                      className="washed-button"
                      disabled={!next}
                      onClick={() => washPlayer(0)}
                    >
                      <Check size={16} />
                      Ha lavato
                    </button>
                    <button
                      className="choose-washer"
                      onClick={() => setWashModal(true)}
                    >
                      <Shirt size={16} />
                      Scegli chi lava
                    </button>
                  </div>
                )}
              </article>
            </div>
            <article className="panel birthdays page-enter page-enter-delay-2">
              <div className="head">
                <div>
                  <p>NON DIMENTICARTI</p>
                  <h2>Prossimi compleanni</h2>
                </div>
              </div>
              <div>
                {upcomingBirthdays.slice(0, 3).map(({ person: x, days }) => (
                  <div className="birthday" key={x[0] as string}>
                    <b>
                      {birthdayDate(x[3], 2000).getDate()}
                      <em>
                        {birthdayDate(x[3], 2000)
                          .toLocaleDateString("it-IT", { month: "short" })
                          .toUpperCase()}
                      </em>
                    </b>
                    <Avatar x={x[1] as string} />
                    <span>
                      <strong>{displayName(x)}</strong>
                      <small>
                        {days === 0
                          ? "Oggi 🎉"
                          : days === 1
                            ? "Domani"
                            : `Tra ${days} giorni`}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </>
        )}
        {tab === "paste" && (
          <section className="page page-enter">
            {canEdit && (
              <div className="top" style={{ justifyContent: "flex-start" }}>
                <button onClick={() => setModal(true)}>
                  <Plus size={17} />
                  Aggiungi
                </button>
              </div>
            )}
            <section style={{ marginTop: 26 }}>
              <h3
                style={{
                  margin: 0,
                  background: "#eef1f5",
                  border: "1px solid #e0e5eb",
                  borderBottom: 0,
                  borderRadius: "11px 11px 0 0",
                  padding: "12px 16px",
                  fontSize: 12,
                  letterSpacing: ".1em",
                  color: "#515b6a",
                }}
              >
                DEBITI
              </h3>
              <article
                className="panel table"
                style={{ borderRadius: "0 0 14px 14px" }}
              >
                {foods
                  .filter((f) => f.status === "Da portare")
                  .map((f) => (
                    <FoodRow
                      key={`${f.name}-${foods.indexOf(f)}`}
                      f={f}
                      i={foods.indexOf(f)}
                      mark={mark}
                      canEdit={canEdit}
                      moving={deliveringFood === f.name}
                    />
                  ))}
              </article>
            </section>
            <section style={{ marginTop: 26 }}>
              <h3
                style={{
                  margin: 0,
                  background: "#eef1f5",
                  border: "1px solid #e0e5eb",
                  borderBottom: 0,
                  borderRadius: "11px 11px 0 0",
                  padding: "12px 16px",
                  fontSize: 12,
                  letterSpacing: ".1em",
                  color: "#515b6a",
                }}
              >
                PORTATO
              </h3>
              <article
                className="panel table"
                style={{ borderRadius: "0 0 14px 14px" }}
              >
                {foods
                  .filter((f) => f.status === "Portato")
                  .map((f) => (
                    <FoodRow
                      key={`${f.name}-${foods.indexOf(f)}`}
                      f={f}
                      i={foods.indexOf(f)}
                      mark={mark}
                      canEdit={canEdit}
                      moving={deliveringFood === f.name}
                      edit={() => setEditFoodIndex(foods.indexOf(f))}
                    />
                  ))}
              </article>
            </section>
          </section>
        )}
        {tab === "divise" && (
          <section className="page page-enter">
            {canEdit && (
              <div className="divise-actions">
                <button onClick={regenerateKitRound}>Rigenera giro</button>
                <button onClick={undoKitAction} disabled={!kitUndo}>
                  Annulla
                </button>
              </div>
            )}
            <article className="panel kitlist">
              {kits.map((x, i) => (
                <div
                  className={`kit${i === 0 ? " current" : ""}`}
                  style={{
                    ...(i === 0
                      ? {
                          background: "linear-gradient(110deg,#7657ed,#5435ca)",
                          color: "#fff",
                          minHeight: 92,
                          borderRadius: 14,
                          margin: "10px -12px",
                          padding: "0 18px",
                          boxShadow: "0 10px 24px #6043d22e",
                        }
                      : {}),
                    viewTransitionName:
                      washingKit === x[0] ? "moving-kit" : undefined,
                  }}
                  key={x[0] as string}
                >
                  <small
                    style={
                      i === 0 ? { color: "#fff", fontSize: 16 } : undefined
                    }
                  >
                    {i + 1}
                  </small>
                  <Avatar x={x[1] as string} />
                  <strong
                    style={
                      i === 0 ? { color: "#fff", fontSize: 18 } : undefined
                    }
                  >
                    {displayName(x)}
                  </strong>
                  <span style={i === 0 ? { color: "#e9e4ff" } : undefined}>
                    {i === 0 ? "Tocca a lui" : `Ha lavato ${x[5]} volta/e`}
                  </span>
                  {canEdit && (
                    <button
                      className="done"
                      style={
                        i === 0
                          ? { background: "#fff", color: "#5435ca" }
                          : undefined
                      }
                      onClick={() => washPlayer(i)}
                    >
                      <Check size={15} />
                      Ha lavato
                    </button>
                  )}
                </div>
              ))}
            </article>
          </section>
        )}
        {tab === "squadra" && (
          <section className="page page-enter">
            <div className="top" style={{ justifyContent: "flex-start" }}>
              {canEdit && (
                <button onClick={() => setAddPerson(true)}>
                  <Plus size={17} />
                  Aggiungi persona
                </button>
              )}
              <button
                className="birthday-calendar-button"
                onClick={() => setBirthdayCalendar(true)}
              >
                <CalendarDays size={17} />
                Calendario compleanni
              </button>
              <label className="team-search">
                <Search size={17} />
                <input
                  type="search"
                  value={teamSearch}
                  onChange={(event) => setTeamSearch(event.target.value)}
                  placeholder="Cerca persona"
                  aria-label="Cerca nella squadra"
                />
              </label>
            </div>
            <div className="roster">
              {visibleTeam.map(({ person: x, index: i }, position) => (
                <Fragment key={x[0] as string}>
                  {x[2] === "Allenatore" &&
                    (position === 0 ||
                      visibleTeam[position - 1].person[2] !== "Allenatore") && (
                      <p className="roster-section">Allenatori</p>
                    )}
                <article className="person">
                  <Avatar x={x[1] as string} big />
                  <div>
                    <small
                      style={
                        x[2] === "Giocatore"
                          ? { color: "#15864a", background: "#dcf8e7" }
                          : { color: "#6250ca", background: "#eeeaff" }
                      }
                    >
                      {x[2]}
                    </small>
                      <h3>{displayName(x)}</h3>
                    <span>Compleanno · {formatBirthday(x[3])}</span>
                  </div>
                  <div className="person-stats">
                    <div className="stat">
                      <b>{Number(x[4]) || 0}</b>
                      <span>Paste portate</span>
                    </div>
                    <div className="stat">
                      <b>{Number(x[5]) || 0}</b>
                      <span>Divise lavate</span>
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      className="edit-person"
                      aria-label={`Modifica ${displayName(x)}`}
                      onClick={() => setEditIndex(i)}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                </article>
                </Fragment>
              ))}
              {!visibleTeam.length && (
                <p className="roster-empty">Nessuna persona trovata.</p>
              )}
            </div>
            {canEdit && editIndex !== null && team[editIndex] && (
              <EditPerson
                person={team[editIndex]}
                close={() => setEditIndex(null)}
                save={(updated) => {
                  const oldName = team[editIndex][0];
                  if (oldName === captainName)
                    setCaptainName(String(updated[0]));
                  setTeam((x) =>
                    x.map((p, i) => (i === editIndex ? updated : p)),
                  );
                  setKits((x) =>
                    updated[2] === "Allenatore"
                      ? x.filter((p) => p[0] !== oldName)
                      : x.some((p) => p[0] === oldName)
                        ? x.map((p) => (p[0] === oldName ? updated : p))
                        : [...x, updated],
                  );
                  setFoods((x) =>
                    x.map((food) =>
                      food.name === oldName
                        ? {
                            ...food,
                            name: updated[0] as string,
                            displayName: displayName(updated),
                            initials: updated[1] as string,
                            birthdayKey: food.birthdayKey?.replace(
                              String(oldName),
                              String(updated[0]),
                            ),
                          }
                        : food,
                    ),
                  );
                  setEditIndex(null);
                  flash("Persona aggiornata");
                }}
                remove={
                  team[editIndex][0] === captainName
                    ? undefined
                    : () => {
                        const removed = team[editIndex];
                        setTeam((x) => x.filter((_, i) => i !== editIndex));
                        setKits((x) => x.filter((p) => p[0] !== removed[0]));
                        setFoods((x) =>
                          x.filter((food) => food.name !== removed[0]),
                        );
                        setEditIndex(null);
                        flash(removed[0] + " eliminato");
                      }
                }
              />
            )}
            {canEdit && addPerson && (
              <EditPerson
                person={["", "", "Giocatore", "", 0, 0]}
                mode="new"
                close={() => setAddPerson(false)}
                save={(created) => {
                  setTeam((current) => [...current, created]);
                  if (created[2] === "Giocatore")
                    setKits((current) => [...current, created]);
                  setAddPerson(false);
                  flash("Persona aggiunta");
                }}
              />
            )}
          </section>
        )}
        {tab === "impostazioni" && (
          <section className="settings-page page-enter">
            <article className="panel settings-card">
              <div className="settings-card-title">
                <span className="settings-icon"><Bell size={21} /></span>
                <div>
                  <p>NOTIFICHE</p>
                  <h2>Compleanni della squadra</h2>
                </div>
              </div>
              <p className="settings-description">
                Ricevi una notifica quando è il compleanno di un membro della squadra,
                anche quando Paste non è aperta.
              </p>
              {pushStatus === "unsupported" ? (
                <p className="settings-warning">Questo browser non supporta le notifiche push.</p>
              ) : pushStatus === "denied" ? (
                <p className="settings-warning">Il permesso è bloccato. Riattivalo nelle impostazioni del browser o del dispositivo.</p>
              ) : (
                <div className="settings-actions">
                  <button
                    className={`push-button${pushStatus === "enabled" ? " active" : ""}`}
                    type="button"
                    onClick={toggleBirthdayPush}
                    aria-pressed={pushStatus === "enabled"}
                  >
                    <Bell size={18} />
                    {pushStatus === "enabled" ? "Disattiva notifiche" : "Attiva notifiche"}
                  </button>
                  {pushStatus === "enabled" && (
                    <button className="push-test-button" type="button" onClick={sendPushTest}>
                      Invia test
                    </button>
                  )}
                </div>
              )}
              {pushStatus === "enabled" && <small className="settings-status">Notifiche push attive su questo dispositivo.</small>}
            </article>
          </section>
        )}
        {birthdayCalendar && (
          <BirthdayCalendar
            team={team}
            close={() => setBirthdayCalendar(false)}
          />
        )}
        {canEdit && teamNameModal && (
          <TeamNameModal
            value={teamName}
            close={() => setTeamNameModal(false)}
            save={(name) => {
              setTeamName(name);
              setTeamNameModal(false);
              flash("Nome squadra aggiornato");
            }}
          />
        )}
        {canEdit && modal && (
          <NewFood
            people={team}
            close={() => setModal(false)}
            add={(f) => {
              setFoods((x) => [f, ...x]);
              setModal(false);
              flash("Nuovo debito aggiunto");
            }}
          />
        )}
        {canEdit && editFoodIndex !== null && foods[editFoodIndex] && (
          <EditFood
            food={foods[editFoodIndex]}
            close={() => setEditFoodIndex(null)}
            save={(updated) => {
              updateFood(editFoodIndex, updated);
              setEditFoodIndex(null);
            }}
            remove={() => {
              removeFood(editFoodIndex);
              setEditFoodIndex(null);
            }}
          />
        )}
        {canEdit && washModal && (
          <div className="back" onClick={() => setWashModal(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#fff",
                width: "min(460px,calc(100% - 30px))",
                borderRadius: 20,
                padding: 26,
                boxShadow: "0 24px 80px #0005",
                position: "relative",
              }}
            >
              <button
                className="close"
                onClick={() => setWashModal(false)}
                style={{
                  position: "absolute",
                  right: 16,
                  top: 16,
                  border: 0,
                  background: "#eef1f5",
                  borderRadius: 9,
                  width: 36,
                  height: 36,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <X size={19} />
              </button>
              <p
                style={{
                  margin: "0 0 7px",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: ".12em",
                  color: "#8d96a5",
                }}
              >
                ASSEGNA LE DIVISE
              </p>
              <h2 style={{ margin: "0 45px 7px 0" }}>Chi le lava?</h2>
              <span
                style={{
                  display: "block",
                  color: "#697386",
                  fontSize: 14,
                  marginBottom: 18,
                }}
              >
                Seleziona un giocatore e conferma.
              </span>
              <div
                style={{
                  maxHeight: 310,
                  overflowY: "auto",
                  display: "grid",
                  gap: 8,
                  paddingRight: 5,
                }}
              >
                {kits.map((x, i) => (
                  <button
                    key={x[0] as string}
                    onClick={() => setWashChoice(i)}
                    style={{
                      border:
                        washChoice === i
                          ? "2px solid #6948e8"
                          : "1px solid #e1e5ec",
                      background: washChoice === i ? "#f1edff" : "#fff",
                      borderRadius: 12,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <Avatar x={x[1] as string} />
                    <strong style={{ flex: 1, color: "#172033" }}>
                      {displayName(x)}
                    </strong>
                    <span
                      style={{
                        width: 19,
                        height: 19,
                        borderRadius: "50%",
                        border:
                          washChoice === i
                            ? "6px solid #6948e8"
                            : "2px solid #bdc4cf",
                      }}
                    />
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 9,
                  marginTop: 20,
                }}
              >
                <button
                  onClick={() => setWashModal(false)}
                  style={{
                    border: 0,
                    background: "#eef1f5",
                    borderRadius: 9,
                    padding: "11px 15px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Annulla
                </button>
                <button
                  onClick={() => washPlayer(washChoice)}
                  style={{
                    border: 0,
                    background: "#6948e8",
                    color: "#fff",
                    borderRadius: 9,
                    padding: "11px 16px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Conferma
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
function LoginScreen({
  info,
  onLogin,
}: {
  info: AuthInfo;
  onLogin: (next: AuthInfo) => void;
}) {
  const [teamCode, setTeamCode] = useState(""),
    [codeVerified, setCodeVerified] = useState(false),
    [availablePeople, setAvailablePeople] = useState<string[]>([]),
    [loginCaptainName, setLoginCaptainName] = useState(info.captainName),
    [captainReady, setCaptainReady] = useState(info.captainReady),
    [personName, setPersonName] = useState(""),
    [password, setPassword] = useState(""),
    [passwordConfirm, setPasswordConfirm] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const isCaptain = personName === loginCaptainName;
  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="login-logo">
          <b>●</b> PASTE
        </div>
        <div>
          <h1>Gestionale paste e divise</h1>
        </div>
      </section>
      <form
        className="login-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          if (isCaptain && !captainReady && password !== passwordConfirm) {
            setError("Le password sono diverse: riscrivile uguali");
            return;
          }
          setLoading(true);
          try {
            if (!codeVerified) {
              const response = await pasteFetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "team-check", teamCode }),
              });
              const data = await response.json();
              if (!response.ok)
                throw new Error(data.error || "Codice squadra non corretto");
              setAvailablePeople(data.people || []);
              setLoginCaptainName(data.captainName || "Luca Bodini");
              setCaptainReady(Boolean(data.captainReady));
              setCodeVerified(true);
              return;
            }
            const response = await pasteFetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                teamCode,
                personName,
                password,
                passwordConfirm,
              }),
            });
            const data = await response.json();
            if (!response.ok)
              throw new Error(data.error || "Accesso non riuscito");
            onLogin({ ...info, ...data });
          } catch (reason) {
            setError(
              reason instanceof Error ? reason.message : "Accesso non riuscito",
            );
          } finally {
            setLoading(false);
          }
        }}
      >
        <div className="login-lock">
          <LockKeyhole size={24} />
        </div>
        <p>ACCESSO SQUADRA</p>
        <h2>Bentornato</h2>
        <span className="login-copy">
          {codeVerified
            ? "Codice corretto. Ora scegli il tuo nome."
            : "Inserisci il codice della squadra per continuare."}
        </span>
        <label>
          Codice squadra
          <input
            autoFocus
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            value={teamCode}
            onChange={(event) => {
              setTeamCode(event.target.value.replace(/\D/g, ""));
              setCodeVerified(false);
              setAvailablePeople([]);
              setPersonName("");
              setPassword("");
              setPasswordConfirm("");
              setError("");
            }}
            placeholder="Inserisci il codice"
          />
        </label>
        {codeVerified && (
          <label className="login-reveal">
            Chi sei?
            <select
              required
              autoFocus
              value={personName}
              onChange={(event) => {
                setPersonName(event.target.value);
                setPassword("");
                setPasswordConfirm("");
                setError("");
              }}
            >
              <option value="">Seleziona il tuo nome</option>
              {availablePeople.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        )}
        {isCaptain && (
          <div className="captain-fields">
            <div className="captain-notice">
              <LockKeyhole size={17} />
              <span>
                {captainReady
                  ? "Accesso riservato al capitano"
                  : "Crea la password del capitano"}
              </span>
            </div>
            {!captainReady && (
              <p className="captain-setup-copy">
                È il primo accesso: scegli una nuova password e scrivila uguale
                in entrambi i campi. Verrà salvata solo dopo la conferma.
              </p>
            )}
            <label>
              {captainReady
                ? "Password capitano"
                : "Nuova password capitano"}
              <input
                required
                type="password"
                autoComplete={
                  captainReady ? "current-password" : "new-password"
                }
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Almeno 6 caratteri"
              />
            </label>
            {!captainReady && (
              <label>
                Conferma password
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={passwordConfirm}
                  onChange={(event) => {
                    setPasswordConfirm(event.target.value);
                    setError("");
                  }}
                  placeholder="Ripeti la password"
                />
              </label>
            )}
          </div>
        )}
        {error && <div className="login-error">{error}</div>}
        <button className="login-submit" disabled={loading}>
          {loading
            ? "Accesso…"
            : !codeVerified
              ? "Verifica codice"
              : isCaptain && !captainReady
              ? "Crea password e accedi"
              : "Entra nella squadra"}
        </button>
        <small>La sessione rimarrà attiva su questo dispositivo.</small>
      </form>
    </main>
  );
}
function TeamNameModal({
  value,
  close,
  save,
}: {
  value: string;
  close: () => void;
  save: (name: string) => void;
}) {
  const [name, setName] = useState(value);
  return (
    <div className="back" onClick={close}>
      <form
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          const cleaned = name.trim();
          if (cleaned) save(cleaned);
        }}
      >
        <button type="button" className="close" onClick={close}>
          <X />
        </button>
        <p>NOME SQUADRA</p>
        <h2>Come si chiama la squadra?</h2>
        <label>
          Nome
          <input
            autoFocus
            required
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Es. Basket Villafranca"
          />
        </label>
        <button>Salva nome</button>
      </form>
    </div>
  );
}
function Card(p: {
  t: string;
  v: string;
  d: string;
  c: string;
  i: React.ReactNode;
  go?: () => void;
  celebration?: boolean;
}) {
  return (
    <article
      onClick={p.go}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && p.go) p.go();
      }}
      className={"card " + p.c}
      style={{ cursor: "pointer" }}
      role="button"
      tabIndex={0}
    >
      {p.celebration && (
        <div className="confetti" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <i
              key={index}
              style={{
                left: `${4 + index * 5.4}%`,
                animationDelay: `${index * -0.13}s`,
              }}
            />
          ))}
        </div>
      )}
      <div>
        <p>{p.t}</p>
        <strong>{p.v}</strong>
        <span>{p.d}</span>
      </div>
      <b>{p.i}</b>
    </article>
  );
}
function FoodRow({
  f,
  i,
  mark,
  canEdit,
  edit,
  moving = false,
}: {
  f: Food;
  i: number;
  mark: (i: number, delivery: string) => void;
  canEdit: boolean;
  edit?: () => void;
  moving?: boolean;
}) {
  const due = f.status === "Da portare",
    open = () => {
      const layer = document.createElement("div");
      layer.style.cssText =
        "position:fixed;inset:0;background:#10182899;z-index:99;display:grid;place-items:center;padding:20px";
      const box = document.createElement("div");
      box.style.cssText =
        "width:min(420px,100%);background:#fff;border-radius:20px;padding:28px;box-shadow:0 25px 80px #0005;font-family:Arial";
      box.innerHTML =
        '<div style="font-size:11px;font-weight:800;letter-spacing:.12em;color:#8b95a5;margin-bottom:8px">CONSEGNA CONFERMATA</div><h2 style="margin:0 0 8px;color:#172033">Cosa ha portato?</h2><p style="margin:0 0 18px;color:#6b7482;font-size:14px">La nota verrà salvata nello storico di ' +
        f.name +
        '.</p><input placeholder="Es. 2 teglie di pizza e bibite" style="width:100%;border:1px solid #d9dfe8;border-radius:10px;padding:12px;font-size:15px;box-sizing:border-box"><div style="display:flex;justify-content:flex-end;gap:9px;margin-top:18px"><button data-cancel style="border:0;background:#eef1f5;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer">Annulla</button><button data-save style="border:0;background:#ff6b35;color:#fff;border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer">Salva e sposta</button></div>';
      layer.append(box);
      document.body.append(layer);
      const input = box.querySelector("input")!;
      input.focus();
      box
        .querySelector("[data-cancel]")!
        .addEventListener("click", () => layer.remove());
      box.querySelector("[data-save]")!.addEventListener("click", () => {
        mark(i, input.value.trim() || "Nessuna nota");
        layer.remove();
      });
    };
  return (
    <div
      className="food"
      style={{
        background: "#fff",
        borderRadius: 10,
        padding: "14px 12px",
        margin: "8px 0",
        border: "1px solid #e0e5eb",
        viewTransitionName: moving ? "moving-food" : undefined,
      }}
    >
      <Avatar x={f.initials} />
      <div>
        <strong>{f.displayName || f.name}</strong>
        <span>
          {f.why} · {f.date}
        </span>
        {f.note && <em>{f.note}</em>}
      </div>
      {due && canEdit ? (
        <button className="done" onClick={open}>
          <Check size={16} />
          Conferma consegna
        </button>
      ) : due ? (
        <b className="pending">Da portare</b>
      ) : (
        <b className="ok">Ha portato</b>
      )}
      {canEdit && edit && (
        <button
          className="edit-person"
          aria-label={`Modifica voce di ${f.displayName || f.name}`}
          onClick={edit}
        >
          <Pencil size={16} />
        </button>
      )}
    </div>
  );
}
function NewFood({
  people,
  close,
  add,
}: {
  people: Person[];
  close: () => void;
  add: (x: Food) => void;
}) {
  const [n, setN] = useState(""),
    [r, setR] = useState("");
  return (
    <div className="back">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const person = people.find((item) => item[0] === n);
          if (person)
            add({
              name: person[0],
              displayName: displayName(person),
              why: r || "Evento speciale",
              date: new Date().toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "short",
              }),
              status: "Da portare",
              note: "",
              initials: person[1],
            });
        }}
      >
        <button type="button" className="close" onClick={close}>
          <X />
        </button>
        <p>NUOVO DEBITO</p>
        <h2>Chi deve portare?</h2>
        <label>
          Nome
          <select
            autoFocus
            required
            value={n}
            onChange={(e) => setN(e.target.value)}
          >
            <option value="">Seleziona una persona</option>
            {people.map((person) => (
              <option key={person[0]} value={person[0]}>
                {displayName(person)} ({person[2]})
              </option>
            ))}
          </select>
        </label>
        <label>
          Motivo
          <input
            value={r}
            onChange={(e) => setR(e.target.value)}
            placeholder="Es. compleanno, ritardo..."
          />
        </label>
        <button>Aggiungi alla lista</button>
      </form>
    </div>
  );
}
function EditFood({
  food,
  close,
  save,
  remove,
}: {
  food: Food;
  close: () => void;
  save: (food: Food) => void;
  remove: () => void;
}) {
  const [name, setName] = useState(food.name),
    [why, setWhy] = useState(food.why),
    [date, setDate] = useState(food.date),
    [note, setNote] = useState(food.note),
    [status, setStatus] = useState<Food["status"]>(food.status),
    [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="back" onClick={close}>
      <form
        className="edit-form"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          save({
            ...food,
            name: name.trim(),
            displayName:
              name.trim() === food.name ? food.displayName : name.trim(),
            initials: initialsFor(name.trim()),
            why: why.trim() || "Evento speciale",
            date: date.trim(),
            note: note.trim(),
            status,
          });
        }}
      >
        <button type="button" className="close" onClick={close}>
          <X />
        </button>
        <p>MODIFICA VOCE</p>
        <h2>Dettagli di cosa ha portato</h2>
        <label>
          Nome
          <input
            autoFocus
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Motivo
          <input
            value={why}
            onChange={(event) => setWhy(event.target.value)}
          />
        </label>
        <label>
          Data
          <input
            value={date}
            onChange={(event) => setDate(event.target.value)}
            placeholder="Es. Ven 12 set"
          />
        </label>
        <label>
          Cosa ha portato
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Es. 2 teglie di pizza"
          />
        </label>
        <label>
          Stato
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as Food["status"])}
          >
            <option>Da portare</option>
            <option>Portato</option>
          </select>
        </label>
        <div className="edit-actions">
          {confirmDelete ? (
            <div className="delete-confirm">
              <span>Eliminare definitivamente?</span>
              <button type="button" onClick={() => setConfirmDelete(false)}>
                No
              </button>
              <button type="button" onClick={remove}>
                Sì, elimina
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="delete-person"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={16} />
              Elimina
            </button>
          )}
          <button className="save-person">
            <Check size={16} />
            Salva modifiche
          </button>
        </div>
      </form>
    </div>
  );
}
function EditPerson({
  person,
  close,
  save,
  remove,
  mode = "edit",
}: {
  person: Person;
  close: () => void;
  save: (x: Person) => void;
  remove?: () => void;
  mode?: "edit" | "new";
}) {
  const parts = (person[0] as string).split(" "),
    [name, setName] = useState(parts.slice(0, -1).join(" ") || parts[0]),
    [surname, setSurname] = useState(parts.length > 1 ? parts.at(-1)! : ""),
    [nickname, setNickname] = useState(person[6] || ""),
    [birthday, setBirthday] = useState(person[3] as string),
    [role, setRole] = useState<Person[2]>(person[2]),
    [foodCount, setFoodCount] = useState(Number(person[4]) || 0),
    [kitCount, setKitCount] = useState(Number(person[5]) || 0),
    [confirmDelete, setConfirmDelete] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const full = [name.trim(), surname.trim()].filter(Boolean).join(" ");
    if (full && birthday)
      save([
        full,
        initialsFor(nickname.trim() || full),
        role,
        birthday,
        Math.max(0, foodCount),
        Math.max(0, kitCount),
        nickname.trim(),
      ]);
  };
  return (
    <div className="back" onClick={close}>
      <form
        className="edit-form"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <button type="button" className="close" onClick={close}>
          <X />
        </button>
        <p>{mode === "new" ? "NUOVA PERSONA" : "MODIFICA PERSONA"}</p>
        <h2>
          {mode === "new" ? "Aggiungi alla squadra" : "Dati della squadra"}
        </h2>
        <div className="edit-grid">
          <label>
            Nome
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome"
            />
          </label>
          <label>
            Cognome
            <input
              value={surname}
              required
              onChange={(e) => setSurname(e.target.value)}
              placeholder="Cognome"
            />
          </label>
        </div>
        <label>
          Soprannome
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Es. Bobo"
          />
        </label>
        <label>
          Data di nascita
          <input
            type="date"
            required
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
          />
        </label>
        <label>
          Ruolo
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Person[2])}
          >
            <option>Giocatore</option>
            <option>Allenatore</option>
          </select>
        </label>
        <div className="edit-grid">
          <label>
            Volte ha portato
            <input
              type="number"
              min="0"
              step="1"
              value={foodCount}
              onChange={(e) => setFoodCount(Number(e.target.value))}
            />
          </label>
          <label>
            Volte ha lavato le divise
            <input
              type="number"
              min="0"
              step="1"
              value={kitCount}
              onChange={(e) => setKitCount(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="edit-actions">
          {remove && confirmDelete ? (
            <div className="delete-confirm">
              <span>Eliminare definitivamente?</span>
              <button type="button" onClick={() => setConfirmDelete(false)}>
                No
              </button>
              <button type="button" onClick={remove}>
                Sì, elimina
              </button>
            </div>
          ) : remove ? (
            <button
              type="button"
              className="delete-person"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={16} />
              Elimina
            </button>
          ) : (
            <span />
          )}
          <button className="save-person">
            <Check size={16} />
            {mode === "new" ? "Aggiungi persona" : "Salva modifiche"}
          </button>
        </div>
      </form>
    </div>
  );
}
function BirthdayCalendar({
  team,
  close,
}: {
  team: Person[];
  close: () => void;
}) {
  const now = new Date(),
    [month, setMonth] = useState(now.getMonth()),
    [year, setYear] = useState(now.getFullYear()),
    months = [
      "Gennaio",
      "Febbraio",
      "Marzo",
      "Aprile",
      "Maggio",
      "Giugno",
      "Luglio",
      "Agosto",
      "Settembre",
      "Ottobre",
      "Novembre",
      "Dicembre",
    ],
    weekdays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"],
    years = Array.from(
      { length: 41 },
      (_, index) => now.getFullYear() - 20 + index,
    ),
    daysInMonth = new Date(year, month + 1, 0).getDate(),
    leadingDays = (new Date(year, month, 1).getDay() + 6) % 7,
    birthdays = team.reduce<Record<number, Person[]>>((days, person) => {
      const [, birthMonth, birthDay] = person[3].split("-").map(Number);
      if (birthMonth === month + 1) (days[birthDay] ||= []).push(person);
      return days;
    }, {}),
    changeMonth = (direction: number) => {
      const next = new Date(year, month + direction, 1);
      setMonth(next.getMonth());
      setYear(next.getFullYear());
    };
  return (
    <div className="back calendar-back" onClick={close}>
      <section
        className="birthday-calendar"
        onClick={(event) => event.stopPropagation()}
        aria-label="Calendario compleanni"
      >
        <button
          className="close"
          onClick={close}
          aria-label="Chiudi calendario"
        >
          <X size={19} />
        </button>
        <div className="calendar-heading">
          <div>
            <p>COMPLEANNI DELLA SQUADRA</p>
            <h2>Calendario compleanni</h2>
          </div>
          <div className="calendar-controls">
            <button
              onClick={() => changeMonth(-1)}
              aria-label="Mese precedente"
            >
              <ChevronLeft size={19} />
            </button>
            <select
              aria-label="Seleziona mese"
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {months.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="Seleziona anno"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {years.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <button onClick={() => changeMonth(1)} aria-label="Mese successivo">
              <ChevronRight size={19} />
            </button>
          </div>
        </div>
        <div className="calendar-grid calendar-weekdays">
          {weekdays.map((day) => (
            <b key={day}>{day}</b>
          ))}
        </div>
        <div className="calendar-grid calendar-days">
          {Array.from({ length: leadingDays }, (_, index) => (
            <span className="calendar-empty" key={`empty-${index}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1,
              isToday =
                day === now.getDate() &&
                month === now.getMonth() &&
                year === now.getFullYear();
            return (
              <div
                className={`calendar-day${isToday ? " today" : ""}${birthdays[day] ? " has-birthday" : ""}`}
                key={day}
              >
                <strong>{day}</strong>
                {birthdays[day]?.map((person) => (
                  <span key={person[0]} title={displayName(person)}>
                    🎂 {displayName(person).split(" ")[0]}
                  </span>
                ))}
              </div>
            );
          })}
          {Array.from(
            { length: 42 - leadingDays - daysInMonth },
            (_, index) => (
              <span className="calendar-empty" key={`trailing-empty-${index}`} />
            ),
          )}
        </div>
      </section>
    </div>
  );
}
