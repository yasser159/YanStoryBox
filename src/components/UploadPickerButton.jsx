import { logEvent } from '../lib/logger';

export function UploadPickerButton({
  accept,
  multiple = false,
  disabled = false,
  onFilesSelected,
  className = '',
  inputTestId,
  buttonTestId,
  logPrefix = 'upload_button',
  children,
}) {
  const handleInputChange = async (event) => {
    const files = event.target.files;
    logEvent('info', `${logPrefix}.files_selected`, {
      accept,
      multiple,
      fileCount: files?.length || 0,
      buttonTestId,
      inputTestId,
    });
    await onFilesSelected?.(files);
    event.target.value = '';
  };

  return (
    <label className={`relative inline-flex overflow-hidden ${className}`} data-testid={buttonTestId}>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleInputChange}
        onClick={() => {
          logEvent('info', `${logPrefix}.picker_clicked`, {
            accept,
            multiple,
            disabled,
            buttonTestId,
            inputTestId,
          });
        }}
        className="absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-wait"
        data-testid={inputTestId}
      />
      <span className="pointer-events-none inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </label>
  );
}
