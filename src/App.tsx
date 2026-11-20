import { IonApp, IonRouterOutlet, IonSpinner, setupIonicReact, useIonToast } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { lazy, Suspense, useEffect } from 'react';
import { Redirect, Route, useLocation } from 'react-router-dom';
import { canEnter, homeFor, STAFF_LINK_PATH } from './session/guard';
import { guardedHistory, setGuardRole } from './session/history';
import { SessionProvider, useSession } from './session/SessionContext';
import Inicio from './inicio/Inicio';
import Entrar from './inicio/Entrar';
import Registro from './inicio/Registro';

setupIonicReact({ mode: 'md' });

// Cada rol carga su propio paquete de código. Una sesión de cliente nunca descarga ni ejecuta
// el de la tienda (escáner, inventario, vinculación), y viceversa.
const AdminApp = lazy(() => import('./admin/AdminApp'));
const ClientApp = lazy(() => import('./client/ClientApp'));

function Loading() {
  return (
    <div className="app-loading" role="status">
      <IonSpinner name="crescent" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

function PublicApp() {
  return (
    <IonRouterOutlet>
      <Route exact path="/inicio" component={Inicio} />
      <Route exact path="/cliente/entrar" component={Entrar} />
      <Route exact path="/cliente/registro" component={Registro} />
      <Route>
        <Redirect to="/inicio" />
      </Route>
    </IonRouterOutlet>
  );
}

// Guardián de rutas: decide el árbol de pantallas por el rol de la sesión
function RoleGate() {
  const { status, session, notice, clearNotice } = useSession();
  const { pathname } = useLocation();
  const [toast] = useIonToast();

  useEffect(() => {
    if (!notice) return;
    void toast({ message: notice, duration: 3500, color: 'warning', position: 'top', cssClass: 'toast-app' });
    clearNotice();
  }, [notice]);

  const role = session?.role ?? null;
  setGuardRole(role, status === 'lista');
  if (status === 'cargando') return <Loading />;
  // Al abrir la app con una URL ajena o al cambiar de rol (entrar, salir, sesión vencida)
  if (!canEnter(role, pathname)) return <Redirect to={homeFor(role)} />;

  if (role === 'cliente') {
    return (
      <Suspense fallback={<Loading />}>
        <ClientApp key={session!.userId} />
      </Suspense>
    );
  }
  // Sin sesión solo se carga la parte de la tienda si eligieron «Soy de la tienda» (vincular)
  if (role === 'dispositivo' || pathname === STAFF_LINK_PATH) {
    return (
      <Suspense fallback={<Loading />}>
        <AdminApp />
      </Suspense>
    );
  }
  return <PublicApp />;
}

export default function App() {
  return (
    <SessionProvider>
      <IonApp>
        <IonReactRouter history={guardedHistory}>
          <RoleGate />
        </IonReactRouter>
      </IonApp>
    </SessionProvider>
  );
}
