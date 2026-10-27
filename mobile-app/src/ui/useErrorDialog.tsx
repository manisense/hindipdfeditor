import { useCallback, useState, type ReactElement } from 'react';

import { useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { Dialog } from './Dialog';

export type ErrorDialogOptions = {
  /** "Couldn't <verb> …", already passed through tx(). */
  title: string;
  /** Cause plus next step, already passed through tx(). */
  body: string;
  /** Runs after the dialog closes when the person taps Try again. Omit for a single OK. */
  onRetry?: () => void;
};

/**
 * Error dialog state for a screen. Render `errorDialog` once in the tree and call
 * `showError(...)` from any handler; Close and Android back dismiss it.
 */
export function useErrorDialog(): {
  errorDialog: ReactElement;
  showError: (options: ErrorDialogOptions) => void;
} {
  const ui = useUi();
  const tx = useTx();
  const [current, setCurrent] = useState<ErrorDialogOptions | null>(null);
  const close = useCallback(() => setCurrent(null), []);
  const retry = current?.onRetry;

  const errorDialog = (
    <Dialog
      visible={current !== null}
      icon="error"
      iconColor={ui.danger}
      title={current?.title ?? ''}
      body={current?.body ?? ''}
      confirmLabel={retry ? tx('Try again', 'फिर से करें') : tx('OK', 'ठीक है')}
      cancelLabel={retry ? tx('Close', 'बंद करें') : undefined}
      onConfirm={() => {
        close();
        retry?.();
      }}
      onCancel={close}
    />
  );
  return { errorDialog, showError: setCurrent };
}

/** Shared copy for errors every file tool can hit, so each tool words them the same way. */
export function commonErrors(tx: (en: string, hi: string) => string) {
  return {
    open: {
      title: tx("Couldn't open the PDF", 'PDF नहीं खुल सकी'),
      body: tx(
        'It may be password-protected or damaged. Try another copy of the file.',
        'यह पासवर्ड से सुरक्षित या खराब हो सकती है। फ़ाइल की दूसरी कॉपी आज़माएँ।',
      ),
    },
    save: {
      title: tx("Couldn't save the PDF", 'PDF सेव नहीं हो सकी'),
      body: tx(
        "The folder didn't accept the file. Try again and pick another folder.",
        'फ़ोल्डर में फ़ाइल नहीं बन सकी। फिर से करें और दूसरा फ़ोल्डर चुनें।',
      ),
    },
    share: {
      title: tx("Couldn't share the PDF", 'PDF शेयर नहीं हो सकी'),
      body: tx(
        "The share menu didn't open. Try again, or save the PDF to a folder.",
        'शेयर मेनू नहीं खुला। फिर से करें, या PDF को फ़ोल्डर में सेव करें।',
      ),
    },
  };
}
