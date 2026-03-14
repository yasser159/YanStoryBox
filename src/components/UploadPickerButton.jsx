import { useRef } from 'react';

function openNativeFilePicker(input) {
  if (!input) return;

  try {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
  } catch {
    // Fall back to click() when showPicker is unavailable or blocked.
  }

  input.click();
}

export function UploadPickerButton({
  accept,
  multiple = false,
  disabled = false,
  onFilesSelected,
  className = '',
  inputTestId,
  buttonTestId,
  children,
}) {
  const inputRef = useRef(null);

  const handleButtonClick = () => {
    if (disabled) return;
    openNativeFilePicker(inputRef.current);
  };

  const handleInputChange = async (event) => {
    const files = event.target.files;
    await onFilesSelected?.(files);
    event.target.value = '';
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleInputChange}
        className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
        tabIndex={-1}
        aria-hidden="true"
        data-testid={inputTestId}
      />
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={disabled}
        className={className}
        data-testid={buttonTestId}
      >
        {children}
      </button>
    </div>
  );
}
