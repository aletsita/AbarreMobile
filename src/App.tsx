import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import { SyncToaster } from './components/SyncToaster';
import { AppProvider } from './context/AppContext';
import MobileTabs from './mobile/MobileTabs';
import Splash from './mobile/pages/Splash/Splash';
import Link from './mobile/pages/Link/Link';
import NewProduct from './mobile/pages/NewProduct/NewProduct';
import ProductEdit from './mobile/pages/ProductEdit/ProductEdit';

setupIonicReact({ mode: 'md' });

export default function App() {
  return (
    <AppProvider>
      <IonApp>
        <IonReactRouter>
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
        </IonReactRouter>
        <SyncToaster />
      </IonApp>
    </AppProvider>
  );
}
