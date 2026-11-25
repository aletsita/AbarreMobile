import { IonBadge, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, useIonRouter } from '@ionic/react';
import { cartOutline, personCircleOutline, receiptOutline, storefrontOutline } from 'ionicons/icons';
import { useEffect } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { isActive } from '../api/types';
import { useSession } from '../session/SessionContext';
import { CartProvider, useCart } from './lib/cart';
import { CatalogProvider } from './lib/catalog';
import { startNotify, stopNotify } from './lib/notify';
import { OrdersProvider, useOrders } from './lib/orders';
import CambiarPedido from './pages/CambiarPedido';
import Carrito from './pages/Carrito';
import Confirmar from './pages/Confirmar';
import PedidoCreado from './pages/PedidoCreado';
import Pagar from './pages/Pagar';
import PedidoDetalle from './pages/PedidoDetalle';
import Pedidos from './pages/Pedidos';
import Perfil from './pages/Perfil';
import Producto from './pages/Producto';
import Tienda from './pages/Tienda';
import './client.css';

function ClientTabs() {
  const { count } = useCart();
  const { orders } = useOrders();
  const active = orders.filter(isActive).length;

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

// Notificaciones del sistema: al tocar una se abre el detalle de ese pedido; al salir se limpian
function NotifyBridge() {
  const { onBeforeLogout } = useSession();
  const router = useIonRouter();

  useEffect(() => {
    void startNotify((orderId) => router.push(`/cliente/pedido/${orderId}`)).catch((e) =>
      console.warn('[avisos] No se pudieron activar las notificaciones', e),
    );
    return onBeforeLogout(() => stopNotify());
  }, []);

  return null;
}

export default function ClientApp() {
  const { session } = useSession();

  return (
    <CatalogProvider>
      <CartProvider userId={session!.userId}>
        <OrdersProvider>
          <NotifyBridge />
          <IonRouterOutlet>
            <Route path="/cliente/:tab(tienda|carrito|pedidos|perfil)" render={() => <ClientTabs />} />
            <Route exact path="/cliente/producto/:id" component={Producto} />
            <Route exact path="/cliente/confirmar" component={Confirmar} />
            <Route exact path="/cliente/pedido-creado/:id" component={PedidoCreado} />
            <Route exact path="/cliente/pagar/:id" component={Pagar} />
            <Route exact path="/cliente/pedido/:id" component={PedidoDetalle} />
            <Route exact path="/cliente/pedido/:id/cambiar" component={CambiarPedido} />
            <Route>
              <Redirect to="/cliente/tienda" />
            </Route>
          </IonRouterOutlet>
        </OrdersProvider>
      </CartProvider>
    </CatalogProvider>
  );
}
