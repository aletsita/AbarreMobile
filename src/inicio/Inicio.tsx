import { IonContent, IonIcon, IonPage, useIonRouter } from '@ionic/react';
import { bagHandleOutline, chevronForward, storefrontOutline } from 'ionicons/icons';
import { BrandLogo, BrandWord } from '../components/Brand';
import './Inicio.css';

// Primera pantalla sin sesión: cada quien elige su camino. Cambiar de rol después exige cerrar sesión.
export default function Inicio() {
  const router = useIonRouter();

  return (
    <IonPage>
      <IonContent fullscreen className="ini">
        <div className="ini-wrap">
          <div className="ini-brand">
            <BrandLogo size={64} />
            <h1><BrandWord /></h1>
            <p>Tu tiendita de siempre, ahora también desde tu celular</p>
          </div>

          <div className="ini-options">
            <button type="button" className="ini-option is-client" onClick={() => router.push('/cliente/entrar')}>
              <span className="ini-option-icon"><IonIcon icon={bagHandleOutline} /></span>
              <span className="ini-option-text">
                <strong>Soy cliente</strong>
                <small>Pide tu súper y pasa a recogerlo. Inicia sesión o crea tu cuenta.</small>
              </span>
              <IonIcon className="ini-go" icon={chevronForward} />
            </button>
            <button type="button" className="ini-option" onClick={() => router.push('/movil/vincular')}>
              <span className="ini-option-icon"><IonIcon icon={storefrontOutline} /></span>
              <span className="ini-option-text">
                <strong>Soy de la tienda</strong>
                <small>Vincula este celular con la caja escaneando el QR o con el código.</small>
              </span>
              <IonIcon className="ini-go" icon={chevronForward} />
            </button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
