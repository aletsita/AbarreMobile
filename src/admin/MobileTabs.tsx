import { IonBadge, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { cubeOutline, receiptOutline, scanOutline, settingsOutline, timeOutline } from 'ionicons/icons';
import { Route } from 'react-router-dom';
import { ACTIVE_STATUSES } from '../data/pickup';
import { useApp } from './context/AppContext';
import Inventory from './pages/Inventory/Inventory';
import Orders from './pages/Orders/Orders';
import Scanner from './pages/Scanner/Scanner';
import Sent from './pages/Sent/Sent';
import Settings from './pages/Settings/Settings';

export default function MobileTabs() {
  const { pending, orders } = useApp();
  // Pedidos que este celular puede mover ahora (los que esperan al cliente no cuentan)
  const toDo = orders.filter((o) => ACTIVE_STATUSES.includes(o.status) && !o.issue).length;

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/movil/escaner" component={Scanner} />
        <Route exact path="/movil/inventario" component={Inventory} />
        <Route exact path="/movil/pedidos" component={Orders} />
        <Route exact path="/movil/enviados" component={Sent} />
        <Route exact path="/movil/ajustes" component={Settings} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton tab="escaner" href="/movil/escaner">
          <IonIcon icon={scanOutline} />
          <IonLabel>Escanear</IonLabel>
        </IonTabButton>
        <IonTabButton tab="inventario" href="/movil/inventario">
          <IonIcon icon={cubeOutline} />
          <IonLabel>Inventario</IonLabel>
        </IonTabButton>
        <IonTabButton tab="pedidos" href="/movil/pedidos">
          <IonIcon icon={receiptOutline} />
          <IonLabel>Pedidos</IonLabel>
          {toDo > 0 && <IonBadge color="danger">{toDo}</IonBadge>}
        </IonTabButton>
        <IonTabButton tab="enviados" href="/movil/enviados">
          <IonIcon icon={timeOutline} />
          <IonLabel>Actividad</IonLabel>
          {pending.length > 0 && <IonBadge color="warning">{pending.length}</IonBadge>}
        </IonTabButton>
        <IonTabButton tab="ajustes" href="/movil/ajustes">
          <IonIcon icon={settingsOutline} />
          <IonLabel>Ajustes</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}
