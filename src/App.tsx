import { IonApp, IonRouterOutlet, IonSpinner, setupIonicReact, useIonToast } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Redirect, Route, useLocation } from 'react-router-dom';
import { canEnter, homeFor } from './session/guard';
import { guardedHistory, setGuardRole } from './session/history';
import { SessionProvider, useSession } from './session/SessionContext';
import Entrar from './inicio/Entrar';
import Registro from './inicio/Registro';
import { Splash } from './inicio/Splash';

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
      <Route exact path="/entrar" component={Entrar} />
      <Route exact path="/registro" component={Registro} />
      <Route>
        <Redirect to="/entrar" />
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
  if (role === 'personal') {
    return (
      <Suspense fallback={<Loading />}>
        <AdminApp key={session!.userId} />
      </Suspense>
    );
  }
  return <PublicApp />;
}

function Shell() {
  const { status } = useSession();
  const [splash, setSplash] = useState(true);
  return (
    <>
      <IonApp>
        <IonReactRouter history={guardedHistory}>
          <RoleGate />
        </IonReactRouter>
      </IonApp>
      {splash && <Splash ready={status === 'lista'} onDone={() => setSplash(false)} />}
    </>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
