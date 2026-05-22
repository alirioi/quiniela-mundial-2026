import Swal from 'sweetalert2';

export const showAlert = {
  success: (title: string, text: string) => {
    return Swal.fire({
      icon: 'success',
      title: title.toUpperCase(),
      text,
      background: '#141923',
      color: '#f8fafc',
      confirmButtonColor: '#00A859', // wc-green
      confirmButtonText: 'ACEPTAR',
      customClass: {
        popup: 'border border-slate-800 rounded-2xl',
        title: 'font-sports text-white tracking-wider text-xl',
        htmlContainer: 'text-slate-300 text-sm font-sans'
      }
    });
  },
  error: (title: string, text: string) => {
    return Swal.fire({
      icon: 'error',
      title: title.toUpperCase(),
      text,
      background: '#141923',
      color: '#f8fafc',
      confirmButtonColor: '#FF002E', // wc-red
      confirmButtonText: 'ACEPTAR',
      customClass: {
        popup: 'border border-slate-800 rounded-2xl',
        title: 'font-sports text-white tracking-wider text-xl',
        htmlContainer: 'text-slate-300 text-sm font-sans'
      }
    });
  },
  warning: (title: string, text: string) => {
    return Swal.fire({
      icon: 'warning',
      title: title.toUpperCase(),
      text,
      background: '#141923',
      color: '#f8fafc',
      confirmButtonColor: '#D4AF37', // wc-gold
      confirmButtonText: 'ACEPTAR',
      customClass: {
        popup: 'border border-slate-800 rounded-2xl',
        title: 'font-sports text-white tracking-wider text-xl',
        htmlContainer: 'text-slate-300 text-sm font-sans'
      }
    });
  }
};
