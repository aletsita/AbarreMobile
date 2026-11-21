import { IonButton, IonContent, IonIcon, IonLabel, IonPage, IonSegment, IonSegmentButton, useIonActionSheet, useIonAlert, useIonRouter, useIonToast } from '@ionic/react';
import { alertCircleOutline, bagCheckOutline, closeCircleOutline, createOutline, flameOutline, hourglassOutline, qrCodeOutline, timeOutline, warningOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { AppHeader } from '../../../components/AppHeader';
import { EmptyState } from '../../../components/EmptyState';
import { isToday, money, time } from '../../../data/models';
import { ACTIVE_STATUSES, ORDER_NEXT_ACTION, ORDER_STATUS_LABEL, reservedStock, type PickupOrder } from '../../../data/pickup';
import { useApp } from '../../context/AppContext';
import './Orders.css';

type View = 'curso' | 'entregados';

const SECTIONS = [
  { status: 'pendiente', title: 'Pendientes', icon: timeOutline },
  { status: 'preparando', title: 'Preparando', icon: flameOutline },
  { status: 'listo', title: 'Listos para recoger', icon: bagCheckOutline },
] as const;

const PREVIEW_ITEMS = 3;
const NEW_MS = 2 * 60000;

function ago(iso: string, now: number) {
  const min = Math.floor((now - Date.parse(iso)) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `hace ${h} h` : new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// Pide y recoge desde el celular de la tienda: preparar los pedidos y entregarlos escaneando el QR del cliente
export default function Orders() {
  const { orders, products, advanceOrder, reportShortage, cancelOrder, online, serverStatus, thisDevice } = useApp();
  const [sheet] = useIonActionSheet();
  const [alert] = useIonAlert();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const [view, setView] = useState<View>('curso');
  const [now, setNow] = useState(Date.now());
  const connected = online && serverStatus === 'conectado' && !!thisDevice;

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const delivered = orders
    .filter((o) => o.status === 'entregado' && isToday(o.deliveredAt ?? o.updatedAt))
    .sort((a, b) => Date.parse(b.deliveredAt ?? b.updatedAt) - Date.parse(a.deliveredAt ?? a.updatedAt));

  const shortage = (o: PickupOrder) => {
    const reserved = reservedStock(orders, o.id);
    return o.items.some((i) => {
      const p = products.find((x) => x.id === i.productId);
      return !p || p.stock - (reserved[i.productId] ?? 0) < i.qty;
    });
  };

  const act = (o: PickupOrder) => {
    if (!connected) {
      void toast({ message: 'Necesitas conexión con la caja para mover pedidos.', duration: 2500, color: 'warning', position: 'top', cssClass: 'toast-app' });
      return;
    }
    if (o.status === 'listo') return router.push(`/movil/entregar?pedido=${encodeURIComponent(o.id)}`);
    advanceOrder(o.id);
    void toast({
      message: o.status === 'pendiente' ? `${o.folio}: empezaste a prepararlo` : `${o.folio} listo. Le avisamos a ${o.customer.name}.`,
      duration: 2000,
      color: 'success',
      position: 'top',
      cssClass: 'toast-app',
    });
  };

  const done = (message: string) => void toast({ message, duration: 2500, color: 'success', position: 'top', cssClass: 'toast-app' });

  // Igual que en la caja: si se agotó algo se avisa al cliente y el pedido sigue; si no, se cancela con un motivo
  const problem = (o: PickupOrder) => {
    if (!connected) {
      void toast({ message: 'Necesitas conexión con la caja para mover pedidos.', duration: 2500, color: 'warning', position: 'top', cssClass: 'toast-app' });
      return;
    }
    void sheet({
      header: `Problema con ${o.folio}`,
      buttons: [
        { text: o.issue ? 'Actualizar lo que se agotó' : 'Se agotó un producto', icon: alertCircleOutline, handler: () => askShortage(o) },
        { text: 'Cancelar el pedido', icon: closeCircleOutline, role: 'destructive', handler: () => askCancel(o) },
        { text: 'Volver', role: 'cancel' },
      ],
    });
  };

  const askShortage = (o: PickupOrder) =>
    void alert({
      header: '¿Qué se agotó?',
      message: 'El pedido no se cancela: le avisamos al cliente para que elija otro producto, lo quite o cancele.',
      inputs: o.items.map((i) => ({ type: 'checkbox' as const, label: `${i.qty}× ${i.name}`, value: i.productId, checked: !!o.issue?.missing.includes(i.productId) })),
      buttons: [
        { text: 'Volver', role: 'cancel' },
        {
          text: 'Avisar al cliente',
          handler: (missing: string[]) => {
            if (!missing?.length) return false;
            reportShortage(o.id, missing);
            done(`Le avisamos a ${o.customer.name}`);
          },
        },
      ],
    });

  const askCancel = (o: PickupOrder) =>
    void alert({
      header: `¿Cancelar ${o.folio}?`,
      message: 'Escribe el motivo; el cliente lo verá en su app. Sus piezas dejan de estar apartadas.',
      inputs: [{ name: 'note', type: 'textarea', placeholder: 'Ej. Hoy no abrimos por la tarde.', attributes: { maxlength: 200 } }],
      buttons: [
        { text: 'Volver', role: 'cancel' },
        {
          text: 'Cancelar pedido',
          role: 'destructive',
          handler: ({ note }: { note?: string }) => {
            if (!note?.trim()) return false;
            cancelOrder(o.id, note);
            done(`${o.folio} cancelado. Le avisamos a ${o.customer.name}.`);
          },
        },
      ],
    });

  const card = (o: PickupOrder) => {
    const rest = o.items.length - PREVIEW_ITEMS;
    const fresh = o.status === 'pendiente' && now - Date.parse(o.createdAt) < NEW_MS;
    const missing = !o.issue && shortage(o);
    return (
      <li key={o.id} className={`mo-card ${o.issue ? 'is-waiting' : ''} ${fresh ? 'is-new' : ''}`}>
        <div className="mo-card-top">
          <strong>{o.folio}</strong>
          <span className="muted">{ago(o.createdAt, now)}</span>
          <strong className="money mo-total">{money(o.total)}</strong>
        </div>
        <span className="mo-who">{o.customer.name}</span>
        <ul className="mo-items">
          {o.items.slice(0, PREVIEW_ITEMS).map((i) => (
            <li key={i.productId} className={o.issue?.missing.includes(i.productId) ? 'is-out' : ''}>
              <b>{i.qty}×</b> {i.name}
            </li>
          ))}
          {rest > 0 && <li className="muted">y {rest} más</li>}
        </ul>
        {o.note && <p className="mo-note">“{o.note}”</p>}
        {o.issue && <span className="mo-flag is-waiting"><IonIcon icon={hourglassOutline} />Esperando al cliente: se agotó un producto</span>}
        {missing && <span className="mo-flag is-warn"><IonIcon icon={warningOutline} />Falta existencia</span>}
        {o.editedAt && !o.issue && <span className="mo-flag is-edited"><IonIcon icon={createOutline} />El cliente cambió productos</span>}
        {!o.issue && (
          <IonButton expand="block" className="mo-act" color={o.status === 'listo' ? 'success' : 'primary'} fill={o.status === 'listo' ? 'solid' : 'outline'} onClick={() => act(o)}>
            {o.status === 'listo' && <IonIcon slot="start" icon={qrCodeOutline} />}
            {o.status === 'listo' ? 'Escanear QR y entregar' : ORDER_NEXT_ACTION[o.status as keyof typeof ORDER_NEXT_ACTION]}
          </IonButton>
        )}
        <IonButton expand="block" fill="clear" color="danger" size="small" className="mo-problem" onClick={() => problem(o)}>
          <IonIcon slot="start" icon={alertCircleOutline} />
          Problema con el pedido
        </IonButton>
      </li>
    );
  };

  return (
    <IonPage>
      <AppHeader title="Pedidos">
        <div className="mo-tabs">
          <IonSegment value={view} onIonChange={(e) => setView(e.detail.value as View)}>
            <IonSegmentButton value="curso">
              <IonLabel>En curso · {active.length}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="entregados">
              <IonLabel>Entregados hoy · {delivered.length}</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>
      </AppHeader>
      <IonContent>
        <div className="page-pad is-narrow stack">
          {!thisDevice && <p className="mo-off">Vincula este celular con la caja para ver y entregar los pedidos.</p>}
          {thisDevice && !connected && <p className="mo-off">Sin conexión con la caja. Lo que ves puede no estar al día.</p>}

          {view === 'curso' ? (
            <>
              <IonButton expand="block" className="btn-lg" disabled={!connected} onClick={() => router.push('/movil/entregar')}>
                <IonIcon slot="start" icon={qrCodeOutline} />
                Entregar con el QR del cliente
              </IonButton>
              {active.length === 0 ? (
                <EmptyState art="cart" title="No hay pedidos por entregar" text="Los pedidos que hagan tus clientes desde la app aparecen aquí." />
              ) : (
                SECTIONS.map((sec) => {
                  const list = active.filter((o) => o.status === sec.status).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
                  if (!list.length) return null;
                  return (
                    <section key={sec.status} className={`mo-sec is-${sec.status}`}>
                      <h2 className="mo-sec-title">
                        <IonIcon icon={sec.icon} aria-hidden="true" />
                        {sec.title}
                        <span className="mo-count">{list.length}</span>
                      </h2>
                      <ul className="mo-list">{list.map(card)}</ul>
                    </section>
                  );
                })
              )}
            </>
          ) : delivered.length === 0 ? (
            <EmptyState art="cart" title="Aún no se entregan pedidos hoy" />
          ) : (
            <ul className="mo-done">
              {delivered.map((o) => (
                <li key={o.id}>
                  <span>
                    <strong>{o.folio} · {o.customer.name}</strong>
                    <small className="muted">{ORDER_STATUS_LABEL[o.status]} · {time(o.deliveredAt ?? o.updatedAt)}</small>
                  </span>
                  <strong className="money">{money(o.total)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
