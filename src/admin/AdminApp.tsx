import { IonRouterOutlet } from '@ionic/react';
import { Redirect, Route } from 'react-router-dom';
import { SyncToaster } from './components/SyncToaster';
import { useSession } from '../session/SessionContext';
import { AppProvider, useApp } from './context/AppContext';
import MobileTabs from './MobileTabs';
import Link from './pages/Link/Link';
import NewProduct from './pages/NewProduct/NewProduct';
import Deliver from './pages/Orders/Deliver';
import ProductEdit from './pages/ProductEdit/ProductEdit';

// Al entrar el personal: si el celular no está vinculado con la caja, primero se vincula
function Home() {
  const { thisDevice } = useApp();
  return <Redirect to={thisDevice ? '/movil/escaner' : '/movil/vincular'} />;
}

// Parte de la tienda (personal con sesión): escáner, actividad, ajustes, productos y vinculación
export default function AdminApp() {
  const { session } = useSession();
  return (
    <AppProvider employee={session?.name} tiendaId={session?.tiendaId ?? null}>
      <IonRouterOutlet>
        <Route exact path="/movil/inicio" component={Home} />
        <Route exact path="/movil/vincular" component={Link} />
        <Route exact path="/movil/producto-nuevo" component={NewProduct} />
        <Route exact path="/movil/producto/:id" component={ProductEdit} />
        <Route exact path="/movil/entregar" component={Deliver} />
        <Route path="/movil/:tab(escaner|inventario|pedidos|enviados|ajustes)" render={() => <MobileTabs />} />
        <Route>
          <Redirect to="/movil/inicio" />
        </Route>
      </IonRouterOutlet>
      <SyncToaster />
    </AppProvider>
  );
}
