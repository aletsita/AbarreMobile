import { IonIcon, IonModal } from '@ionic/react';
import { cameraOutline, closeCircle, imagesOutline, trashOutline } from 'ionicons/icons';
import { useRef, useState } from 'react';
import { useAppAlert } from '../../components/AppAlert';
import { readPhoto } from '../lib/photo';
import './PhotoPicker.css';

// Foto del producto: con la cámara o de la galería del teléfono
export function PhotoPicker({ value, onChange }: { value?: string; onChange: (photo?: string) => void }) {
  // `capture` abre directo la cámara; sin él, Android ofrece la galería y los archivos
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const showAlert = useAppAlert();

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      void showAlert({ tone: 'warning', title: 'Eso no es una imagen', message: 'Elige una foto en JPG o PNG.', primary: 'Entendido' });
      return;
    }
    try {
      onChange(await readPhoto(file));
    } catch {
      void showAlert({ tone: 'error', title: 'No se pudo leer la foto', message: 'Prueba con otra foto o tómala de nuevo.', primary: 'Entendido' });
    }
  };

  // Se cierra la hoja y luego se abre el selector del sistema (si no, Android lo tapa con la animación)
  const pick = (ref: React.RefObject<HTMLInputElement>) => {
    setOpen(false);
    window.setTimeout(() => ref.current?.click(), 150);
  };

  const input = (ref: React.RefObject<HTMLInputElement>, capture?: 'environment') => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      capture={capture}
      hidden
      onChange={(e) => {
        void onFile(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  return (
    <div className={`photo-pick ${value ? 'has-photo' : ''}`}>
      <button type="button" className="photo-pick-btn" onClick={() => setOpen(true)} aria-label={value ? 'Cambiar foto' : 'Agregar foto'}>
        {value ? (
          <img src={value} alt="Foto del producto" />
        ) : (
          <>
            <IonIcon icon={cameraOutline} />
            <span>Agregar foto</span>
          </>
        )}
      </button>
      {value && (
        <button type="button" className="photo-pick-clear" onClick={() => onChange(undefined)} aria-label="Quitar foto">
          <IonIcon icon={closeCircle} />
        </button>
      )}
      {input(camera, 'environment')}
      {input(gallery)}

      <IonModal isOpen={open} onDidDismiss={() => setOpen(false)} initialBreakpoint={1} breakpoints={[0, 1]} className="photo-sheet">
        <div className="photo-sheet-body">
          <header className="photo-sheet-head">
            {value && <img src={value} alt="" />}
            <span>
              <strong>{value ? 'Cambiar foto' : 'Foto del producto'}</strong>
              <small>Una foto clara ayuda a encontrarlo en la caja y en la app.</small>
            </span>
          </header>
          <div className="photo-sheet-options">
            <button type="button" onClick={() => pick(camera)}>
              <span className="photo-sheet-icon">
                <IonIcon icon={cameraOutline} aria-hidden="true" />
              </span>
              <strong>Tomar foto</strong>
              <small>Con la cámara</small>
            </button>
            <button type="button" onClick={() => pick(gallery)}>
              <span className="photo-sheet-icon is-gallery">
                <IonIcon icon={imagesOutline} aria-hidden="true" />
              </span>
              <strong>Galería</strong>
              <small>Una que ya tengas</small>
            </button>
          </div>
          {value && (
            <button
              type="button"
              className="photo-sheet-remove"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              <IonIcon icon={trashOutline} aria-hidden="true" />
              Quitar foto
            </button>
          )}
          <button type="button" className="photo-sheet-cancel" onClick={() => setOpen(false)}>
            Cancelar
          </button>
        </div>
      </IonModal>
    </div>
  );
}
