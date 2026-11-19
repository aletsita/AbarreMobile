export function deviceModel() {
  const ua = navigator.userAgent;
  const android = ua.match(/Android [\d.]+;\s*([^;)]+?)(?:\sBuild|\))/);
  if (android && android[1] && !/^K$/.test(android[1])) return android[1].trim();
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS/i.test(ua)) return 'Mac';
  return 'Navegador';
}

export function defaultDeviceName() {
  const model = deviceModel();
  return /iPhone|iPad/.test(model) ? `Mi ${model}` : 'Mi celular';
}
