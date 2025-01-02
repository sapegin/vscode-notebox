(function () {
  // Debounce delay for sending the textarea value back to the extension
  const SAVE_DELAY = 100;

  const debounce = (callback, wait) => {
    let timeoutId = null;
    return (...args) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        callback(...args);
      }, wait);
    };
  };

  // eslint-disable-next-line no-undef
  const vscode = acquireVsCodeApi();
  const textarea = document.querySelector('#textarea');

  const submitTextareaValue = debounce(() => {
    vscode.postMessage({
      type: 'webview->extension',
      data: textarea.value,
    });
  }, SAVE_DELAY);

  textarea.addEventListener('input', () => {
    submitTextareaValue();
  });

  // Handle messages from the extension
  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      // We receive the new value from the extension
      case 'extension->webview': {
        textarea.value = message.value;
        break;
      }
    }
  });
})();
