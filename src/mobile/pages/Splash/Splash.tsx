import { IonButton, IonContent, IonIcon, IonPage } from '@ionic/react';
import { arrowForward, barcodeOutline, cloudOfflineOutline, desktopOutline } from 'ionicons/icons';
import { BrandLogo, BrandWord } from '../../../components/Brand';
import { APP_SLOGAN } from '../../../config';
import { useApp } from '../../../context/AppContext';
import './Splash.css';

export default function Splash() {
  const { thisDevice } = useApp();
  return (
    <IonPage>
      <IonContent fullscreen className="splash" scrollY={false}>
        <div className="splash-wrap">
          <div className="splash-brand">
            <BrandLogo size={72} />
            <h1><BrandWord /></h1>
            <p>{APP_SLOGAN}</p>
          </div>

          <ul className="splash-points">
            <li><span><IonIcon icon={barcodeOutline} aria-hidden="true" /></span> Lee códigos con la cámara o escríbelos</li>
            <li><span><IonIcon icon={desktopOutline} aria-hidden="true" /></span> Lo que escaneas llega al instante a la caja</li>
            <li><span><IonIcon icon={cloudOfflineOutline} aria-hidden="true" /></span> Sigue funcionando aunque se vaya el internet</li>
          </ul>

          <div className="splash-actions">
            <IonButton
              expand="block"
              className="btn-xl"
              routerLink={thisDevice ? '/movil/escaner' : '/movil/vincular'}
              routerDirection="root"
            >
              {thisDevice ? 'Abrir escáner' : 'Comenzar'}
              <IonIcon slot="end" icon={arrowForward} />
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
