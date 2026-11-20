import { IonBadge, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, useIonRouter } from '@ionic/react';
import { cartOutline, personCircleOutline, receiptOutline, storefrontOutline } from 'ionicons/icons';
import { useEffect, useRef } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { api } from '../api';
import { useSession } from '../session/SessionContext';
import { stopSimAuto } from './components/SimPanel';
import { CartProvider, useCart } from './lib/cart';
import { CatalogProvider } from './lib/catalog';
import { OrdersProvider, useOrders } from './lib/orders';
import { startPush, stopPush } from './lib/push';
import Carrito from './pages/Carrito';
import Confirmar from './pages/Confirmar';
import PedidoCreado from './pages/PedidoCreado';
import PedidoDetalle from './pages/PedidoDetalle';
import Pedidos from './pages/Pedidos';
import Perfil from './pages/Perfil';
import Producto from './pages/Producto';
import Tienda from './pages/Tienda';
import './client.css';

function ClientTabs() {
  const { count } = useCart();
  const { orders } = useOrders();
  const active = orders.filter((o) => o.status !== 'entregado').length;

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/cliente/tienda" component={Tienda} />
        <Route exact path="/cliente/carrito" component={Carrito} />
        <Route exact path="/cliente/pedidos" component={Pedidos} />
        <Route exact path="/cliente/perfil" component={Perfil} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton tab="tienda" href="/cliente/tienda">
          <IonIcon icon={storefrontOutline} />
          <IonLabel>Tienda</IonLabel>
        </IonTabButton>
        <IonTabButton tab="carrito" href="/cliente/carrito">
          <IonIcon icon={cartOutline} />
          <IonLabel>Carrito</IonLabel>
          {count > 0 && <IonBadge color="secondary">{count}</IonBadge>}
        </IonTabButton>
        <IonTabButton tab="pedidos" href="/cliente/pedidos">
          <IonIcon icon={receiptOutline} />
          <IonLabel>Mis pedidos</IonLabel>
          {active > 0 && <IonBadge color="warning">{active}</IonBadge>}
        </IonTabButton>
        <IonTabButton tab="perfil" href="/cliente/perfil">
          <IonIcon icon={personCircleOutline} />
          <IonLabel>Perfil</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}

// Notificaciones: token al servidor al entrar, aviso en la app en primer plano,
// y al tocar la notificación del sistema se abre el detalle de ese pedido
function PushBridge() {
  const { onBeforeLogout } = useSession();
  const { incoming } = useOrders();
  const router = useIonRouter();
  const incomingRef = useRef(incoming);
  incomingRef.current = incoming;

  useEffect(() => {
    void startPush({
      onReceived: (orderId) => {
        api.order(orderId).then((o) => incomingRef.current(o), () => undefined);
      },
      onOpen: (orderId) => router.push(`/cliente/pedido/${orderId}`),
    }).catch((e) => console.warn('[push] No se pudieron activar las notificaciones', e));
    const off = onBeforeLogout(async () => {
      stopSimAuto();
      await stopPush();
    });
    return () => {
      off();
      stopSimAuto();
    };
  }, []);

  return null;
}

export default function ClientApp() {
  const { session } = useSession();

  return (
    <CatalogProvider>
      <CartProvider userId={session!.userId}>
        <OrdersProvider>
          <PushBridge />
          <IonRouterOutlet>
            <Route path="/cliente/:tab(tienda|carrito|pedidos|perfil)" render={() => <ClientTabs />} />
            <Route exact path="/cliente/producto/:id" component={Producto} />
            <Route exact path="/cliente/confirmar" component={Confirmar} />
            <Route exact path="/cliente/pedido-creado/:id" component={PedidoCreado} />
            <Route exact path="/cliente/pedido/:id" component={PedidoDetalle} />
            <Route>
              <Redirect to="/cliente/tienda" />
            </Route>
          </IonRouterOutlet>
        </OrdersProvider>
      </CartProvider>
    </CatalogProvider>
  );
}
