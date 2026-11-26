import {
  IonButton,
  IonContent,
  IonFab,
  IonIcon,
  IonPage,
  IonSearchbar,
  IonToolbar,
  useIonActionSheet,
  useIonAlert,
  useIonRouter,
  useIonToast,
} from "@ionic/react";
import {
  alertCircleOutline,
  bagCheckOutline,
  cashOutline,
  checkmarkDoneOutline,
  closeCircleOutline,
  createOutline,
  flameOutline,
  globeOutline,
  hourglassOutline,
  qrCodeOutline,
  timeOutline,
  warningOutline,
} from "ionicons/icons";
import { useEffect, useState } from "react";
import { AppHeader } from "../../../components/AppHeader";
import { EmptyState } from "../../../components/EmptyState";
import { isToday, money, time } from "../../../data/models";
import {
  ACTIVE_STATUSES,
  isPaidOnline,
  ORDER_NEXT_ACTION,
  ORDER_STATUS_LABEL,
  reservedStock,
  type PickupOrder,
} from "../../../data/pickup";
import { shortfallText } from "../../../domain/stock";
import { useApp } from "../../context/AppContext";
import "./Orders.css";

// Filtro de la lista: una etapa a la vez para no buscar los listos hasta abajo
type View = "pendiente" | "preparando" | "listo" | "entregados";

const FILTERS: { id: View; label: string; empty: string; icon: string }[] = [
  {
    id: "pendiente",
    label: "Pendientes",
    empty: "No hay pedidos nuevos por empezar.",
    icon: timeOutline,
  },
  {
    id: "preparando",
    label: "Preparando",
    empty: "No estás preparando ningún pedido.",
    icon: flameOutline,
  },
  {
    id: "listo",
    label: "Listos",
    empty: "Ningún pedido espera a que lo recojan.",
    icon: bagCheckOutline,
  },
  {
    id: "entregados",
    label: "Entregados hoy",
    empty: "Aún no se entregan pedidos hoy.",
    icon: checkmarkDoneOutline,
  },
];

const PREVIEW_ITEMS = 3;
const NEW_MS = 2 * 60000;

function ago(iso: string, now: number) {
  const min = Math.floor((now - Date.parse(iso)) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24
    ? `hace ${h} h`
    : new Date(iso).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
      });
}

// Pide y recoge desde el celular de la tienda: preparar los pedidos y entregarlos escaneando el QR del cliente
export default function Orders() {
  const {
    orders,
    products,
    advanceOrder,
    reportShortage,
    cancelOrder,
    online,
    serverStatus,
    thisDevice,
  } = useApp();
  const [sheet] = useIonActionSheet();
  const [alert] = useIonAlert();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const [chosen, setChosen] = useState<View>();
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(Date.now());
  const connected = online && serverStatus === "conectado" && !!thisDevice;

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const delivered = orders
    .filter(
      (o) => o.status === "entregado" && isToday(o.deliveredAt ?? o.updatedAt),
    )
    .sort(
      (a, b) =>
        Date.parse(b.deliveredAt ?? b.updatedAt) -
        Date.parse(a.deliveredAt ?? a.updatedAt),
    );

  // Búsqueda por folio, cliente o producto; los contadores de los filtros ya la toman en cuenta
  const q = query.trim().toLowerCase();
  const matches = (o: PickupOrder) =>
    !q ||
    o.folio.toLowerCase().includes(q) ||
    o.customer.name.toLowerCase().includes(q) ||
    o.items.some((i) => i.name.toLowerCase().includes(q));
  const byStatus = (s: View) =>
    (s === "entregados"
      ? delivered
      : active
          .filter((o) => o.status === s)
          .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    ).filter(matches);
  const count = (s: View) => byStatus(s).length;
  // Sin elegir: la etapa que más urge con pedidos (nuevos, luego los que esperan al cliente, luego en preparación)
  const view: View =
    chosen ??
    (["pendiente", "listo", "preparando"] as View[]).find(
      (s) => count(s) > 0,
    ) ??
    "pendiente";
  const list = byStatus(view);
  const filter = FILTERS.find((f) => f.id === view)!;

  const shortage = (o: PickupOrder) => {
    const reserved = reservedStock(orders, o.id);
    return o.items.some((i) => {
      const p = products.find((x) => x.id === i.productId);
      return !p || p.stock - (reserved[i.productId] ?? 0) < i.qty;
    });
  };

  const [busy, setBusy] = useState<string>();

  const act = async (o: PickupOrder) => {
    if (busy) return;
    if (!connected) {
      void toast({
        message: "Necesitas conexión con la caja para mover pedidos.",
        duration: 2500,
        color: "warning",
        position: "top",
        cssClass: "toast-app",
      });
      return;
    }
    if (o.status === "listo")
      return router.push(`/movil/entregar?pedido=${encodeURIComponent(o.id)}`);
    setBusy(o.id);
    const r = await advanceOrder(o.id);
    setBusy(undefined);
    if (!r.ok) {
      // El servidor no dejó: el pedido se queda donde estaba y se dice qué falta
      void toast({
        message: r.shortages?.length
          ? `No se puede empezar ${o.folio}. ${shortfallText(r.shortages)}`
          : r.message,
        duration: 6000,
        color: "danger",
        position: "top",
        cssClass: "toast-app",
      });
      return;
    }
    void toast({
      message:
        o.status === "pendiente"
          ? `${o.folio}: empezaste a prepararlo`
          : `${o.folio} listo. Le avisamos a ${o.customer.name}.`,
      duration: 2000,
      color: "success",
      position: "top",
      cssClass: "toast-app",
    });
  };

  const done = (message: string) =>
    void toast({
      message,
      duration: 2500,
      color: "success",
      position: "top",
      cssClass: "toast-app",
    });
  const failed = (message: string) =>
    void toast({
      message,
      duration: 4000,
      color: "danger",
      position: "top",
      cssClass: "toast-app",
    });

  // Igual que en la caja: si se agotó algo se avisa al cliente y el pedido sigue; si no, se cancela con un motivo
  const problem = (o: PickupOrder) => {
    if (!connected) {
      void toast({
        message: "Necesitas conexión con la caja para mover pedidos.",
        duration: 2500,
        color: "warning",
        position: "top",
        cssClass: "toast-app",
      });
      return;
    }
    void sheet({
      header: `Problema con ${o.folio}`,
      buttons: [
        {
          text: o.issue ? "Actualizar lo que se agotó" : "Se agotó un producto",
          icon: alertCircleOutline,
          handler: () => askShortage(o),
        },
        {
          text: "Cancelar el pedido",
          icon: closeCircleOutline,
          role: "destructive",
          handler: () => askCancel(o),
        },
        { text: "Volver", role: "cancel" },
      ],
    });
  };

  const askShortage = (o: PickupOrder) =>
    void alert({
      header: "¿Qué se agotó?",
      message:
        "El pedido no se cancela: le avisamos al cliente para que elija otro producto, lo quite o cancele.",
      inputs: o.items.map((i) => ({
        type: "checkbox" as const,
        label: `${i.qty}× ${i.name}`,
        value: i.productId,
        checked: !!o.issue?.missing.includes(i.productId),
      })),
      buttons: [
        { text: "Volver", role: "cancel" },
        {
          text: "Avisar al cliente",
          handler: (missing: string[]) => {
            if (!missing?.length) return false;
            void reportShortage(o.id, missing).then((r) =>
              r.ok ? done(`Le avisamos a ${o.customer.name}`) : failed(r.message),
            );
          },
        },
      ],
    });

  const askCancel = (o: PickupOrder) =>
    void alert({
      header: `¿Cancelar ${o.folio}?`,
      message:
        "Escribe el motivo; el cliente lo verá en su app. Sus piezas dejan de estar apartadas.",
      inputs: [
        {
          name: "note",
          type: "textarea",
          placeholder: "Ej. Hoy no abrimos por la tarde.",
          attributes: { maxlength: 200 },
        },
      ],
      buttons: [
        { text: "Volver", role: "cancel" },
        {
          text: "Cancelar pedido",
          role: "destructive",
          handler: ({ note }: { note?: string }) => {
            if (!note?.trim()) return false;
            void cancelOrder(o.id, note).then((r) =>
              r.ok ? done(`${o.folio} cancelado. Le avisamos a ${o.customer.name}.`) : failed(r.message),
            );
          },
        },
      ],
    });

  const card = (o: PickupOrder) => {
    const rest = o.items.length - PREVIEW_ITEMS;
    const fresh =
      o.status === "pendiente" && now - Date.parse(o.createdAt) < NEW_MS;
    const missing = !o.issue && shortage(o);
    return (
      <li
        key={o.id}
        className={`mo-card ${o.issue ? "is-waiting" : ""} ${fresh ? "is-new" : ""}`}
      >
        <div className="mo-card-top">
          <strong>{o.folio}</strong>
          <span className="muted">{ago(o.createdAt, now)}</span>
          <strong className="money mo-total">{money(o.total)}</strong>
        </div>
        <span className="mo-who">{o.customer.name}</span>
        <ul className="mo-items">
          {o.items.slice(0, PREVIEW_ITEMS).map((i) => (
            <li
              key={i.productId}
              className={o.issue?.missing.includes(i.productId) ? "is-out" : ""}
            >
              <b>{i.qty}×</b> {i.name}
            </li>
          ))}
          {rest > 0 && <li className="muted">y {rest} más</li>}
        </ul>
        {o.note && <p className="mo-note">“{o.note}”</p>}
        <div className="mo-flags">
          {o.issue && (
            <span className="mo-flag is-waiting">
              <IonIcon icon={hourglassOutline} />
              Esperando al cliente: se agotó un producto
            </span>
          )}
          {missing && (
            <span className="mo-flag is-warn">
              <IonIcon icon={warningOutline} />
              Falta existencia
            </span>
          )}
          {o.editedAt && !o.issue && (
            <span className="mo-flag is-edited">
              <IonIcon icon={createOutline} />
              El cliente cambió productos
            </span>
          )}
          {ACTIVE_STATUSES.includes(o.status) &&
            (isPaidOnline(o) ? (
              <span className="mo-flag is-paid">
                <IonIcon icon={globeOutline} />
                Pagado en línea
              </span>
            ) : (
              <span className="mo-flag is-cash">
                <IonIcon icon={cashOutline} />
                Se paga al recoger
              </span>
            ))}
        </div>
        {!o.issue && (
          <IonButton
            expand="block"
            className="mo-act"
            color={o.status === "listo" ? "success" : "primary"}
            fill={o.status === "listo" ? "solid" : "outline"}
            disabled={busy === o.id}
            onClick={() => void act(o)}
          >
            {o.status === "listo" && (
              <IonIcon slot="start" icon={qrCodeOutline} />
            )}
            {o.status === "listo"
              ? "Escanear QR y entregar"
              : ORDER_NEXT_ACTION[o.status as keyof typeof ORDER_NEXT_ACTION]}
          </IonButton>
        )}
        <IonButton
          expand="block"
          fill="clear"
          color="danger"
          size="small"
          className="mo-problem"
          onClick={() => problem(o)}
        >
          <IonIcon slot="start" icon={alertCircleOutline} />
          Problema con el pedido
        </IonButton>
      </li>
    );
  };

  return (
    <IonPage>
      <AppHeader title="Pedidos">
        {/* Buscador y filtros en filas separadas, cada una con su fondo: no se enciman con la lista */}
        <IonToolbar className="mo-bar">
          <IonSearchbar
            className="mo-search"
            value={query}
            onIonInput={(e) => setQuery(e.detail.value ?? "")}
            placeholder="Folio, cliente o producto"
            aria-label="Buscar pedidos"
          />
        </IonToolbar>
        <IonToolbar className="mo-bar is-filters">
          <div
            className="mo-filters"
            role="tablist"
            aria-label="Etapa de los pedidos"
          >
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={view === f.id}
                className={`mo-filter is-${f.id} ${view === f.id ? "is-active" : ""}`}
                onClick={() => setChosen(f.id)}
              >
                <IonIcon icon={f.icon} aria-hidden="true" />
                {f.label}
                <span className="mo-count">{count(f.id)}</span>
              </button>
            ))}
          </div>
        </IonToolbar>
      </AppHeader>
      <IonContent>
        <div className="page-pad is-narrow stack mo-page">
          {!thisDevice && (
            <p className="mo-off">
              Vincula este celular con la caja para ver y entregar los pedidos.
            </p>
          )}
          {thisDevice && !connected && (
            <p className="mo-off">
              Sin conexión con la caja. Lo que ves puede no estar al día.
            </p>
          )}

          {list.length === 0 ? (
            <EmptyState
              art={q ? "search" : "cart"}
              title={
                q
                  ? "Ningún pedido coincide"
                  : `Sin pedidos ${filter.label.toLowerCase()}`
              }
              text={
                q
                  ? "Revisa el folio o el nombre, o busca en otra etapa."
                  : active.length || view === "entregados"
                    ? filter.empty
                    : "Los pedidos que hagan tus clientes desde la app aparecen aquí."
              }
            />
          ) : view === "entregados" ? (
            <ul className="mo-done">
              {list.map((o) => (
                <li key={o.id}>
                  <span>
                    <strong>
                      {o.folio} · {o.customer.name}
                    </strong>
                    <small className="muted">
                      {ORDER_STATUS_LABEL[o.status]} ·{" "}
                      {time(o.deliveredAt ?? o.updatedAt)}
                    </small>
                  </span>
                  <strong className="money">{money(o.total)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mo-list">{list.map(card)}</ul>
          )}
        </div>

        {/* Escanear el QR del cliente para entregar: siempre a la mano, abajo */}
        <IonFab
          slot="fixed"
          vertical="bottom"
          horizontal="center"
          className="mo-fab"
        >
          <button
            type="button"
            className="mo-scan"
            disabled={!connected}
            onClick={() => router.push("/movil/entregar")}
          >
            <IonIcon icon={qrCodeOutline} aria-hidden="true" />
            Escanear para entregar
          </button>
        </IonFab>
      </IonContent>
    </IonPage>
  );
}
