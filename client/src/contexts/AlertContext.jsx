import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { formatSteError } from '../utils/steError';

const AlertActionsContext = createContext(null);
const AlertStateContext = createContext(null);

// Global event bus for non-React contexts (e.g. utility scripts like exportUtils.js)
let globalAlertHandler = null;
let globalConfirmHandler = null;

export const brandAlert = (message, title = '', type = 'info') => {
  if (globalAlertHandler) {
    if (type === 'error') {
      const ste = formatSteError(message, title);
      return globalAlertHandler({ 
        message: ste.formattedText, 
        title: ste.title, 
        type: 'error',
        confirmText: ste.actionButtonText || 'Dismiss',
        steDetails: ste,
        onAction: ste.onAction
      });
    }
    return globalAlertHandler({ message, title, type });
  }
  console.log(`[Alert - ${type}] ${title ? title + ': ' : ''}${message}`);
  return Promise.resolve();
};

export const brandConfirm = (message, title = '', isDanger = false) => {
  if (globalConfirmHandler) {
    return globalConfirmHandler({ message, title, isDanger });
  }
  return Promise.resolve(window.confirm(message));
};

export function AlertProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info', // 'success' | 'error' | 'warning' | 'info' | 'confirm'
    confirmText: 'Got it',
    cancelText: 'Cancel',
    isDanger: false,
    steDetails: null,
    onAction: null,
    resolve: null
  });

  const showAlert = useCallback(({ 
    message, 
    title = '', 
    type = 'info', 
    confirmText = 'Got it',
    cancelText = '',
    steDetails = null,
    onAction = null
  }) => {
    return new Promise((resolve) => {
      // Auto-derive sensible title if omitted
      let derivedTitle = title;
      if (!derivedTitle) {
        switch (type) {
          case 'success': derivedTitle = 'Success'; break;
          case 'error': derivedTitle = 'System Error'; break;
          case 'warning': derivedTitle = 'Attention'; break;
          default: derivedTitle = 'Notice'; break;
        }
      }

      setModalState({
        isOpen: true,
        title: derivedTitle,
        message: String(message || ''),
        type,
        confirmText,
        cancelText,
        isDanger: false,
        steDetails,
        onAction,
        resolve
      });
    });
  }, []);

  const showConfirm = useCallback(({ 
    message, 
    title = 'Please Confirm', 
    confirmText = 'Confirm', 
    cancelText = 'Cancel', 
    isDanger = false 
  }) => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        title,
        message: String(message || ''),
        type: 'confirm',
        confirmText,
        cancelText,
        isDanger,
        steDetails: null,
        onAction: null,
        resolve
      });
    });
  }, []);

  const showSuccess = useCallback((message, title = 'Success') => {
    return showAlert({ message, title, type: 'success', confirmText: 'Awesome' });
  }, [showAlert]);

  const showError = useCallback((messageOrError, title = '') => {
    // Format any error into ASD-STE100 (Simplified Technical English)
    const ste = formatSteError(messageOrError, title);
    const requiresAction = Boolean(ste.onAction);

    return showAlert({
      message: ste.formattedText,
      title: ste.title,
      type: 'error',
      confirmText: ste.actionButtonText || 'Dismiss',
      cancelText: requiresAction ? 'Dismiss' : '',
      steDetails: ste,
      onAction: ste.onAction
    });
  }, [showAlert]);

  const showWarning = useCallback((message, title = 'Attention') => {
    return showAlert({ message, title, type: 'warning', confirmText: 'Understood' });
  }, [showAlert]);

  const handleClose = useCallback((result = false) => {
    setModalState(prev => {
      // If confirmed and an action handler is attached (e.g. sign out, reload), execute it
      if (result && typeof prev.onAction === 'function') {
        try {
          prev.onAction();
        } catch (actionErr) {
          console.error('[AlertContext] Action execution error:', actionErr);
        }
      }
      if (prev.resolve) {
        prev.resolve(result);
      }
      return { 
        ...prev, 
        isOpen: false, 
        resolve: null,
        steDetails: null,
        onAction: null 
      };
    });
  }, []);

  // Connect global non-React triggers
  useEffect(() => {
    globalAlertHandler = ({ message, title, type, confirmText, cancelText, steDetails, onAction }) => {
      return showAlert({ message, title, type, confirmText, cancelText, steDetails, onAction });
    };

    globalConfirmHandler = ({ message, title, isDanger }) => {
      return showConfirm({ message, title, isDanger });
    };

    return () => {
      globalAlertHandler = null;
      globalConfirmHandler = null;
    };
  }, [showAlert, showConfirm]);

  const actions = useMemo(() => ({
    showAlert,
    showConfirm,
    showSuccess,
    showError,
    showWarning,
    handleClose
  }), [showAlert, showConfirm, showSuccess, showError, showWarning, handleClose]);

  return (
    <AlertActionsContext.Provider value={actions}>
      <AlertStateContext.Provider value={modalState}>
        {children}
      </AlertStateContext.Provider>
    </AlertActionsContext.Provider>
  );
}

// Subscribed to by pages/modals: stable actions identity, zero re-renders on alert open/close
export const useAlert = () => {
  const context = useContext(AlertActionsContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

// Subscribed to exclusively by AlertPopup
export const useAlertModal = () => {
  const actions = useContext(AlertActionsContext);
  const modalState = useContext(AlertStateContext);
  if (!actions || !modalState) {
    throw new Error('useAlertModal must be used within an AlertProvider');
  }
  return { modalState, ...actions };
};
