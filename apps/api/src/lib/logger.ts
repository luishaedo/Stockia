type LogPayload = Record<string, unknown>;

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const emit = (level: LogLevel, message: string, payload?: LogPayload) => {
    const logRecord = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...payload
    };

    const line = JSON.stringify(logRecord);

    if (level === 'error') {
        console.error(line);
        return;
    }

    if (level === 'warn') {
        console.warn(line);
        return;
    }

    console.log(line);
};

export const logger = {
    info(payload: LogPayload, message: string) {
        emit('info', message, payload);
    },
    warn(payload: LogPayload, message: string) {
        emit('warn', message, payload);
    },
    error(payload: LogPayload, message: string) {
        emit('error', message, payload);
    },
    debug(payload: LogPayload, message: string) {
        emit('debug', message, payload);
    }
};
