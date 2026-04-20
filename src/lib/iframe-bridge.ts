// Module-level bridge for sending messages to the active iframe
let sender: ((msg: object) => void) | null = null;

export function setIframeSender(fn: ((msg: object) => void) | null) {
  sender = fn;
}

export function sendToIframe(msg: object) {
  if (sender) {
    sender(msg);
  } else {
    const iframe = document.querySelector('iframe[title^="Slide"]') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage(msg, '*');
  }
}
