import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

const AlertActionsContext = createContext(null);
const AlertStateContext = createContext(null);

// Global event bus for non-React contexts (e.g. utility scripts like exportUtils.js)
let globalAlertHandler = null;
let globalConfirmHandler = null;

export const brandAlert = (message, title = '', type = 'info') => {
  if (globalAlertHandler) {
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
    resolve: null
  });

  const showAlert = useCallback(({ message, title = '', type = 'info', confirmText = 'Got it' }) => {
    return new Promise((resolve) => {
      // Auto-derive sensible title if omitted
      let derivedTitle = title;
      if (!derivedTitle) {
        switch (type) {
          case 'success': derivedTitle = 'Success'; break;
          case 'error': derivedTitle = 'Error Encountered'; break;
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
        cancelText: '',
        isDanger: false,
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
        resolve
      });
    });
  }, []);

  const showSuccess = useCallback((message, title = 'Success') => {
    return showAlert({ message, title, type: 'success', confirmText: 'Awesome' });
  }, [showAlert]);

  const showError = useCallback((message, title = 'Error') => {
    return showAlert({ message, title, type: 'error', confirmText: 'Dismiss' });
  }, [showAlert]);

  const showWarning = useCallback((message, title = 'Attention') => {
    return showAlert({ message, title, type: 'warning', confirmText: 'Understood' });
  }, [showAlert]);

  const handleClose = useCallback((result = false) => {
    setModalState(prev => {
      if (prev.resolve) {
        prev.resolve(result);
      }
      return { ...prev, isOpen: false, resolve: null };
    });
  }, []);

  // Connect global non-React triggers
  useEffect(() => {
    globalAlertHandler = ({ message, title, type }) => {
      return showAlert({ message, title, type });
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
