import { useId, useRef } from 'react';
import { Upload } from 'lucide-react';
import clsx from 'clsx';
import styles from './FileUploadField.module.css';

type FileUploadFieldProps = {
    onFileSelect: (file?: File) => void;
    accept?: string;
    label?: string;
    selectedFileName?: string;
    buttonText?: string;
    helperText?: string;
    disabled?: boolean;
    className?: string;
};

export function FileUploadField({
    onFileSelect,
    accept,
    label = 'Subir archivo',
    selectedFileName = 'Ningún archivo seleccionado',
    buttonText = 'Elegir archivo',
    helperText,
    disabled,
    className
}: FileUploadFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const inputId = useId();

    const handleOpenFileDialog = () => {
        if (disabled) {
            return;
        }

        inputRef.current?.click();
    };

    return (
        <div className={clsx(styles.container, className)}>
            <span className={styles.label}>{label}</span>
            <div className={styles.uploadRow}>
                <button
                    type="button"
                    className={styles.uploadButton}
                    onClick={handleOpenFileDialog}
                    disabled={disabled}
                    aria-controls={inputId}
                >
                    <Upload size={14} />
                    <span>{buttonText}</span>
                </button>
                <p className={styles.fileName} title={selectedFileName}>{selectedFileName}</p>
                <input
                    ref={inputRef}
                    id={inputId}
                    className={styles.hiddenFileInput}
                    type="file"
                    accept={accept}
                    onChange={(event) => onFileSelect(event.target.files?.[0])}
                    disabled={disabled}
                />
            </div>
            {helperText && <span className={styles.helperText}>{helperText}</span>}
        </div>
    );
}
