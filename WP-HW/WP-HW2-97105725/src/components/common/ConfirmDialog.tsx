import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "normal" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "normal",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      footer={
        <>
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button onClick={onConfirm} variant={tone === "danger" ? "danger" : "primary"}>
            {confirmLabel}
          </Button>
        </>
      }
      onClose={onCancel}
      open={open}
      title={title}
    >
      <p className="dialog-message">{message}</p>
    </Modal>
  );
}
