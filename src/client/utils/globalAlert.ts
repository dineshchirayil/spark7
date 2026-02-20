import Swal from 'sweetalert2';

declare global {
  interface Window {
    __posAlertInstalled?: boolean;
    __nativeAlert?: (message?: any) => void;
  }
}

const messageToText = (value: any) => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const detectIcon = (text: string): 'success' | 'error' | 'warning' | 'info' => {
  const v = text.toLowerCase();
  if (v.includes('error') || v.includes('failed') || v.includes('fail')) return 'error';
  if (v.includes('warning') || v.includes('warn')) return 'warning';
  if (
    v.includes('success') ||
    v.includes('saved') ||
    v.includes('created') ||
    v.includes('updated') ||
    v.includes('deleted') ||
    v.includes('completed')
  ) {
    return 'success';
  }
  return 'info';
};

export const showAppAlert = (message?: any, title = 'Notice') => {
  const text = messageToText(message);
  void Swal.fire({
    title,
    text,
    icon: detectIcon(text),
    confirmButtonText: 'OK',
    allowOutsideClick: true,
    customClass: {
      popup: 'pos-alert-popup',
      title: 'pos-alert-title',
      confirmButton: 'pos-alert-btn',
    },
    buttonsStyling: false,
  });
};

export const installGlobalAlert = () => {
  if (window.__posAlertInstalled) return;
  window.__posAlertInstalled = true;
  window.__nativeAlert = window.alert.bind(window);
  window.alert = (message?: any) => {
    showAppAlert(message, 'Notification');
  };
};

