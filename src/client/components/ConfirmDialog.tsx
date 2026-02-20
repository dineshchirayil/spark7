import React from 'react';
import '../styles/Modals.css';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ open, title, message, confirmText = 'Yes', cancelText = 'No', onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        {title && <h3 className="modal-title">{title}</h3>}
        <div className="modal-body">{message}</div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>{cancelText}</button>
          <button className="btn-primary" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;