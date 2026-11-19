import { IonBadge, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { scanOutline, settingsOutline, timeOutline } from 'ionicons/icons';
import { Route } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Scanner from './pages/Scanner/Scanner';
import Sent from './pages/Sent/Sent';
import Settings from './pages/Settings/Settings';

export default function MobileTabs() {
  const { pending } = useApp();

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/movil/escaner" component={Scanner} />
        <Route exact path="/movil/enviados" component={Sent} />
        <Route exact path="/movil/ajustes" component={Settings} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton tab="escaner" href="/movil/escaner">
          <IonIcon icon={scanOutline} />
          <IonLabel>Escanear</IonLabel>
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
