import { useIonToast } from '@ionic/react';
import { useEffect } from 'react';
import { useApp } from '../context/AppContext';

// Aviso cuando sube lo que se hizo sin conexión. Lo que el servidor no aceptó se muestra y ya no se reintenta.
export function SyncToaster() {
  const { lastUpload } = useApp();
  const [toast] = useIonToast();

  useEffect(() => {
    if (!lastUpload) return;
    const { count, rejected, warnings } = lastUpload;
    if (rejected.length) {
      void toast({
        header: count ? `${rejected.length} de ${count} cambios no se aceptaron` : rejected[0].title,
        message: rejected.map((r) => (count ? `${r.title}: ${r.message}` : r.message)).join(' · '),
        duration: 8000,
        color: 'danger',
        position: 'top',
        cssClass: 'toast-app',
        buttons: [{ text: 'Entendido', role: 'cancel' }],
      });
      return;
    }
    void toast({
      message: warnings.length
        ? warnings.map((w) => w.message || w.title).join(' · ')
        : count === 1
          ? 'Se subió 1 cambio pendiente'
          : `Se subieron ${count} cambios pendientes`,
      duration: warnings.length ? 6000 : 2200,
      color: warnings.length ? 'warning' : 'success',
      position: 'top',
      cssClass: 'toast-app',
    });
  }, [lastUpload]);

  return null;
}
