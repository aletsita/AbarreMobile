import { IonRouterOutlet } from '@ionic/react';
import { useEffect } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { useSession } from '../session/SessionContext';
import { SyncToaster } from './components/SyncToaster';
import { AppProvider, useApp } from './context/AppContext';
import MobileTabs from './MobileTabs';
import Link from './pages/Link/Link';
import NewProduct from './pages/NewProduct/NewProduct';
import ProductEdit from './pages/ProductEdit/ProductEdit';
import Splash from './pages/Splash/Splash';

// La sesión de dispositivo sigue al vínculo con la caja: empieza al vincularse y termina al desvincularse
function DeviceSession() {
  const { thisDevice } = useApp();
  const { session, startDevice, logout } = useSession();

  useEffect(() => {
    if (thisDevice && !session) startDevice(thisDevice.id, thisDevice.name);
    else if (!thisDevice && session?.role === 'dispositivo') void logout('desvinculado');
  }, [thisDevice?.id, session?.role]);

  return null;
}

// Parte de la tienda: las mismas pantallas y rutas que antes (escáner, actividad, ajustes, productos)
export default function AdminApp() {
  return (
    <AppProvider>
      <DeviceSession />
      <IonRouterOutlet>
        <Route exact path="/movil/bienvenida" component={Splash} />
        <Route exact path="/movil/vincular" component={Link} />
        <Route exact path="/movil/producto-nuevo" component={NewProduct} />
        <Route exact path="/movil/producto/:id" component={ProductEdit} />
        <Route path="/movil/:tab(escaner|enviados|ajustes)" render={() => <MobileTabs />} />
        <Route exact path="/movil">
          <Redirect to="/movil/bienvenida" />
        </Route>

        <Route>
          <Redirect to="/movil/bienvenida" />
        </Route>
      </IonRouterOutlet>
      <SyncToaster />
    </AppProvider>
  );
}
